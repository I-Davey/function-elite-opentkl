//! One bounded request at a time; writes are never automatically retried.
use nzxt_keyboard_core::DeviceSession;
use serde_json::{json, Value};
use std::io::{BufRead, Read, Write};
const VERSION: u64 = 1;
const MAX_BYTES: usize = 1_048_576;

/// Validate an envelope before any operation can open a device.
fn arguments(request: &Value) -> Result<Vec<String>, String> {
    if request["protocolVersion"] != VERSION || request["requestId"].as_u64().is_none() {
        return Err("Invalid device host envelope".into());
    }
    let mode = request["operation"].as_str().ok_or("Missing operation")?;
    // The library enforces the full named-operation and payload allowlist.
    let mut args = vec![mode.to_string()];
    if let Some(payload) = request.get("payload") {
        args.push(payload.to_string());
    }
    Ok(args)
}

pub fn serve() -> Result<(), String> {
    let stdin = std::io::stdin();
    let mut reader = stdin.lock();
    let stdout = std::io::stdout();
    let mut writer = stdout.lock();
    writeln!(writer,"{}",json!({"protocolVersion":VERSION,"event":"ready","nativeLanguage":"Rust","maxRequestBytes":MAX_BYTES})).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    let mut session = DeviceSession::default();
    loop {
        let mut line = Vec::new();
        Read::by_ref(&mut reader)
            .take((MAX_BYTES + 1) as u64)
            .read_until(b'\n', &mut line)
            .map_err(|e| e.to_string())?;
        if line.is_empty() {
            break;
        }
        if line.len() > MAX_BYTES {
            return Err("Device host request exceeded limit".into());
        }
        let request: Value = serde_json::from_slice(&line).map_err(|e| e.to_string())?;
        let id = request["requestId"].clone();
        let result = arguments(&request).and_then(|args| session.execute(&args));
        let response = match result {
            Ok(value) => json!({"protocolVersion":VERSION,"requestId":id,"ok":true,"result":value}),
            Err(error) => {
                json!({"protocolVersion":VERSION,"requestId":id,"ok":false,"error":{"code":"DEVICE_OPERATION_FAILED","message":error}})
            }
        };
        let bytes = serde_json::to_vec(&response).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_BYTES {
            return Err("Device host response exceeded limit".into());
        }
        writer.write_all(&bytes).map_err(|e| e.to_string())?;
        writer
            .write_all(b"\n")
            .and_then(|_| writer.flush())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn envelope_rejects_version_and_missing_ids_without_device_io() {
        assert!(
            arguments(&json!({"operation":"--state","requestId":1,"protocolVersion":2})).is_err()
        );
        assert!(arguments(&json!({"operation":"--state","protocolVersion":1})).is_err());
        assert_eq!(
            arguments(&json!({"operation":"--state","requestId":1,"protocolVersion":1})).unwrap(),
            vec!["--state"]
        );
    }
}
