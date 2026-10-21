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
        "--snap",
        "--lighting",
        "--actuation",
        "--apply-field",
        "--apply-actuation",
        "--apply-lighting",
        "--apply-runtime-lighting",
        "--remaps",
        "--apply-remap",
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
            && mode != "--apply-snap"
            && mode != "--apply-software-actuation"
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
        "--apply-snap",
        "--apply-software-actuation",
    ]
    .contains(&mode)
    {
        let value: serde_json::Value =
            serde_json::from_str(arguments.get(1).ok_or("Missing device request")?)
                .map_err(|e| e.to_string())?;
        if mode == "--apply-software-actuation" {
            actuation::validate_software(&value)?;
        } else if mode == "--apply-snap" {
            snap::validate(&value)?;
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

/// A process-local cache for fast sensor reads. No HID handle is retained while idle.
#[derive(Default)]
pub struct DeviceSession {
    cached_path: Option<String>,
    owner_check: Option<std::time::Instant>,
}
impl DeviceSession {
    pub fn execute(&mut self, arguments: &[String]) -> Result<serde_json::Value, String> {
        let runtime = arguments.len() == 2 && arguments[0] == "--apply-runtime-lighting";
        let edit = if runtime {
            let value: serde_json::Value = serde_json::from_str(&arguments[1]).map_err(|e| e.to_string())?;
            lighting::validate_runtime(&value)?;
            Some(value)
        } else { None };
        let fast = runtime || (arguments.len() == 1 && ["--sensors", "--current"].contains(&arguments[0].as_str()));
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
        if fast {
            self.cached_path = result
                .as_ref()
                .ok()
                .and_then(|value| value["devicePath"].as_str().map(String::from));
        } else {
            self.cached_path = None;
        }
        if result.is_err() {
            self.cached_path = None;
            self.owner_check = None;
        }
        result
    }
}

