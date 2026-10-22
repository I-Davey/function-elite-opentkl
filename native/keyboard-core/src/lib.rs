//! Reusable user-space Function Elite HE device library. The recovered renderer never receives raw USB
//! access. Only named, firmware-checked keyboard operations cross this boundary.
mod actuation;
mod lighting;
mod mutation;
mod protocol;
mod recorder;
mod remap;
mod snap;
mod windows;
use serde_json::json;

pub fn execute(arguments: &[String]) -> Result<serde_json::Value, String> {
    if arguments.is_empty() || arguments.len() > 2 {
        return Err("Expected one named keyboard operation".into());
    }
    let mode = arguments[0].as_str();
    if ![
        "--enumerate",
        "--version",
        "--connection",
        "--sensors",
        "--current",
        "--state",
        "--profile-state",
        "--profile-lighting",
        "--profile-snap",
        "--snap",
        "--lighting",
        "--actuation",
        "--apply-field",
        "--apply-actuation",
        "--apply-lighting",
        "--apply-runtime-lighting",
        "--remaps",
        "--apply-remap",
        "--apply-remaps",
        "--runtime-remaps",
        "--apply-runtime-remaps",
        "--apply-snap",
        "--apply-software-actuation",
    ]
    .contains(&mode)
    {
        return Err("Unsupported keyboard operation".into());
    }
    let change = if mode == "--apply-field" {
        Some(mutation::FieldChange::parse(
            &serde_json::from_str(arguments.get(1).ok_or("Missing setting request")?)
                .map_err(|e| e.to_string())?,
        )?)
    } else {
        if arguments.len() != 1
            && mode != "--apply-actuation"
            && mode != "--apply-lighting"
            && mode != "--apply-runtime-lighting"
            && mode != "--remaps"
            && mode != "--apply-remap"
            && mode != "--apply-remaps"
            && mode != "--apply-runtime-remaps"
            && mode != "--apply-snap"
            && mode != "--apply-software-actuation"
            && !["--profile-state", "--profile-lighting", "--profile-snap"].contains(&mode)
        {
            return Err("Unexpected operation arguments".into());
        }
        None
    };
    let edit = if [
        "--apply-actuation",
        "--apply-lighting",
        "--apply-runtime-lighting",
        "--remaps",
        "--apply-remap",
        "--apply-remaps",
        "--apply-runtime-remaps",
        "--apply-snap",
        "--apply-software-actuation",
        "--profile-state",
        "--profile-lighting",
        "--profile-snap",
    ]
    .contains(&mode)
    {
        let value: serde_json::Value =
            serde_json::from_str(arguments.get(1).ok_or("Missing device request")?)
                .map_err(|e| e.to_string())?;
        if ["--profile-state", "--profile-lighting", "--profile-snap"].contains(&mode) {
            mutation::profile_slot(&value)?;
        } else if mode == "--apply-software-actuation" {
            actuation::validate_software(&value)?;
        } else if mode == "--apply-snap" {
            snap::validate(&value)?;
        } else if mode == "--apply-runtime-remaps" {
            remap::validate_runtime(&value)?;
        } else if mode == "--apply-remaps" {
            remap::validate_batch(&value)?;
        } else if mode == "--apply-remap" {
            remap::validate_edit(&value)?;
        } else if mode == "--apply-runtime-lighting" {
            lighting::validate_runtime(&value)?;
        } else if mode == "--apply-lighting" {
            lighting::validate(&value)?;
        } else if mode == "--remaps" {
            remap::validate_read(&value)?;
        } else {
            actuation::validate_edit(&value)?;
        }
        Some(value)
    } else {
        None
    };
    let _lock = windows::TransactionLock::acquire()?;
    let interfaces = windows::enumerate()?;
    if mode == "--enumerate" {
        return Ok(json!({"status":"ok","vendorId":0x1e71,"productId":0x212a,
            "interfaces": interfaces,"reportIoPerformed":false,"nativeLanguage":"Rust"}));
    }
    windows::check_other_owners()?;
    let matching: Vec<&serde_json::Value> = interfaces
        .iter()
        .filter(|i| {
            i["usagePage"] == 0xffca
                && i["usage"] == 1
                && i["inputReportLength"] == 64
                && i["outputReportLength"] == 64
        })
        .collect();
    if matching.len() != 1 {
        return Err(format!(
            "Expected one Function Elite vendor interface; found {}",
            matching.len()
        ));
    }
    let path = matching[0]["path"].as_str().ok_or("Missing device path")?;
    protocol::Keyboard::open(path)?.execute(mode, change, edit)
}

/// Record keyboard events only after an explicit user recording action.
pub fn record_macro() -> Result<(), String> {
    recorder::run()
}

/// Reuse the verified interface path; every operation still opens and checks its HID session.
#[derive(Default)]
pub struct DeviceSession {
    cached_path: Option<String>,
    owner_check: Option<std::time::Instant>,
}
impl DeviceSession {
    pub fn execute(&mut self, arguments: &[String]) -> Result<serde_json::Value, String> {
        let edit_mode = arguments.len() == 2 && ["--apply-runtime-lighting", "--remaps", "--apply-remap", "--apply-remaps", "--apply-runtime-remaps"].contains(&arguments[0].as_str());
        let edit = if edit_mode {
            let value: serde_json::Value = serde_json::from_str(&arguments[1]).map_err(|e| e.to_string())?;
            match arguments[0].as_str() {
                "--remaps" => remap::validate_read(&value)?,
                "--apply-remap" => remap::validate_edit(&value)?,
                "--apply-remaps" => remap::validate_batch(&value)?,
                "--apply-runtime-remaps" => remap::validate_runtime(&value)?,
                _ => lighting::validate_runtime(&value)?,
            }
            Some(value)
        } else { None };
        let fast = edit_mode || (arguments.len() == 1 && ["--sensors", "--current", "--connection", "--runtime-remaps"].contains(&arguments[0].as_str()));
        let result = if fast {
            if let Some(path) = self.cached_path.as_deref() {
                (|| {
                    let _lock = windows::TransactionLock::acquire()?;
                    if self
                        .owner_check
                        .is_none_or(|last| last.elapsed().as_secs() >= 1)
                    {
                        windows::check_other_owners()?;
                        self.owner_check = Some(std::time::Instant::now());
                    }
                    protocol::Keyboard::open(path)?.execute(&arguments[0], None, edit)
                })()
            } else {
                execute(arguments)
            }
        } else {
            execute(arguments)
        };
        self.cached_path = result.as_ref().ok()
            .and_then(|value| value["devicePath"].as_str().map(String::from));
        if result.is_err() {
            self.cached_path = None;
            self.owner_check = None;
        }
        result
    }
}

#[cfg(test)]
mod session_tests {
    use super::*;
    #[test]
    fn cached_remap_paths_validate_before_device_access() {
        let mut session = DeviceSession::default();
        session.cached_path = Some("invalid-fixture-path".into());
        for (mode, payload) in [
            ("--remaps", r#"{"wireIndex":9,"physicalKeys":[26]}"#),
            ("--apply-remap", r#"{"wireIndex":4}"#),
            ("--apply-remaps", "[]"),
            ("--apply-runtime-lighting", "{}"),
        ] {
            let error = session.execute(&[mode.into(), payload.into()]).unwrap_err();
            assert!(!error.contains("HID"), "Invalid request reached device access: {error}");
        }
    }
}

