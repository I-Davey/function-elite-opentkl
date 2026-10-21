//! CLI compatibility and bounded versioned IPC around the reusable device library.
mod host;
#[cfg(windows)]
mod applications;
use nzxt_keyboard_core::{execute, record_macro, DeviceSession};
use serde_json::json;
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    #[cfg(windows)]
    if args == ["--applications"] || args == ["--watch-applications"] {
        let result = if args == ["--applications"] { applications::snapshot().map(|value|println!("{}",value)) } else { applications::watch() };
        if let Err(error)=result { eprintln!("{}",error); std::process::exit(1); }
        return;
    }
    let result = if args == ["--serve"] {
        host::serve()
    } else if args == ["--record-macro"] {
        record_macro()
    } else if args == ["--serve-sensors"] {
        use std::io::{BufRead, Write};
        let mut session = DeviceSession::default();
        for line in std::io::stdin().lock().lines() {
            let Ok(command) = line else { break };
            if command == "quit" {
                break;
            }
            let result = if ["--sensors", "--current"].contains(&command.as_str()) {
                session.execute(&[command])
            } else {
                Err("Unsupported persistent sensor operation".into())
            };
            let value = result.unwrap_or_else(|error| json!({"status":"error","error":error,"nativeLanguage":"Rust","readOnly":true,"settingsWritePerformed":false}));
            println!("{}", value);
            if std::io::stdout().flush().is_err() {
                break;
            }
        }
        Ok(())
    } else {
        execute(&args).map(|value| println!("{}", value))
    };
    if let Err(error) = result {
        eprintln!("{}", error);
        std::process::exit(1);
    }
}
