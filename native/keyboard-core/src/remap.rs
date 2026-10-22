use serde_json::Value;
/// Source-key IDs on USB are sensor/wire IDs, not the firmware's internal indices.
pub fn canonical(id: u64) -> Result<u8, String> {
    let layout: Value = serde_json::from_str(include_str!("../../../resources/keyboard/key-layout.json"))
        .map_err(|e| e.to_string())?;
    layout["sensors"]
        .as_object()
        .unwrap()
        .iter()
        .find(|(_, key)| key["physicalKeyId"] == id)
        .and_then(|(wire, _)| wire.parse::<u8>().ok())
        .filter(|v| *v < 138)
        .ok_or("Physical key has no firmware mapping".into())
}
pub fn validate_read(request: &Value) -> Result<(), String> {
    if request.as_object().is_none_or(|o| {
        o.len() != 2
            || o.keys()
                .any(|k| !["wireIndex", "physicalKeys"].contains(&k.as_str()))
    }) {
        return Err("Invalid remap read request".into());
    }
    request["wireIndex"]
        .as_u64()
        .filter(|v| *v < 5)
        .ok_or("Invalid remap slot")?;
    let keys = request["physicalKeys"]
        .as_array()
        .filter(|k| !k.is_empty() && k.len() <= 4)
        .ok_or("Read remaps in batches of 1–4 keys")?;
    let mut seen = std::collections::HashSet::new();
    for key in keys {
        let id = key.as_u64().ok_or("Invalid remap physical key")?;
        canonical(id)?;
        if !seen.insert(id) {
            return Err("Duplicate physical key".into());
        }
    }
    Ok(())
}

/// Validate the firmware record before permitting its normal settings setter.
pub fn record(value: &Value) -> Result<Vec<u8>, String> {
    let bytes = crate::lighting::bytes(value)?;
    match bytes.first().copied() {
        None => {}
        Some(4) if bytes.len() == 2 && bytes[1] < 128 => {}
        Some(7) if bytes.len() == 2 && [64, 80, 82].contains(&bytes[1]) => {}
        Some(3) if bytes.len() == 2 && bytes[1] < 7 => {}
        Some(5) if bytes.len() == 2 && bytes[1] < 5 => {}
        Some(6) if bytes.len() == 1 => {}
        // CAM's analogue patch uses a one-shot macro with no actions to silence a key.
        Some(1) if bytes == [1, 1, 0, 0, 0, 0, 0] => {}
        Some(1 | 2) if bytes.len() >= 10 && bytes.len() <= 3079 && (bytes.len() - 7) % 3 == 0 => {
            if bytes[2] != 0 {
                return Err("Randomized macro delays are not supported by this editor".into());
            }
            for action in bytes[7..].chunks_exact(3) {
                let delay = u16::from_le_bytes([action[1], action[2]]);
                if !(20..=1000).contains(&delay) {
                    return Err("Macro delay must be 20–1000 ms".into());
                }
            }
        }
        _ => return Err("Unsupported remap record".into()),
    }
    Ok(bytes)
}
pub fn validate_edit(request: &Value) -> Result<(), String> {
    let fields = [
        "wireIndex",
        "expectedActive",
        "physicalKey",
        "level",
        "fnLayer",
        "expectedData",
        "data",
    ];
    if request
        .as_object()
        .is_none_or(|o| o.len() != fields.len() || o.keys().any(|k| !fields.contains(&k.as_str())))
    {
        return Err("Invalid remap edit request".into());
    }
    for field in ["wireIndex", "expectedActive"] {
        request[field]
            .as_u64()
            .filter(|v| *v < 5)
            .ok_or("Invalid remap slot")?;
    }
    canonical(
        request["physicalKey"]
            .as_u64()
            .ok_or("Invalid remap physical key")?,
    )?;
    request["level"]
        .as_u64()
        .filter(|v| *v < 2)
        .ok_or("Invalid remap level")?;
    request["fnLayer"].as_bool().ok_or("Invalid remap layer")?;
    crate::lighting::bytes(&request["expectedData"])?;
    record(&request["data"])?;
    Ok(())
}

pub fn validate_batch(request: &Value) -> Result<(), String> {
    let records = request.as_array().filter(|r| !r.is_empty() && r.len() <= 16)
        .ok_or("Remap transaction requires 1–16 records")?;
    let mut seen = std::collections::HashSet::new();
    for record in records {
        validate_edit(record)?;
        if record["wireIndex"] != records[0]["wireIndex"] || record["expectedActive"] != records[0]["expectedActive"] {
            return Err("Remap transaction must use one profile".into());
        }
        let key = (record["physicalKey"].as_u64().unwrap(), record["level"].as_u64().unwrap(), record["fnLayer"].as_bool().unwrap());
        if !seen.insert(key) { return Err("Duplicate remap transaction record".into()); }
    }
    Ok(())
}

/// The firmware's RAM table contains packed records, not stored per-key records.
pub fn runtime_table(value: &Value) -> Result<Vec<u8>, String> {
    let bytes = crate::lighting::bytes(value)?;
    if bytes.len() > 2048 { return Err("Runtime mappings exceed the firmware's 2 KB buffer".into()); }
    let mut offset = 0;
    let mut seen = std::collections::HashSet::new();
    while offset < bytes.len() {
        let header = bytes.get(offset..offset + 5).ok_or("Truncated runtime mapping")?;
        if header[1] > 1 || header[2] & 127 >= 127 || !seen.insert((header[1], header[2])) {
            return Err("Invalid or duplicate runtime mapping key/layer".into());
        }
        let length = match header[0] {
            1 | 2 => 5 + u16::from_le_bytes([header[3], header[4]]) as usize,
            3..=7 => 5,
            _ => return Err("Unknown runtime mapping kind".into()),
        };
        let record = bytes.get(offset..offset + length).ok_or("Truncated runtime mapping data")?;
        if header[0] <= 2 {
            let mut stored = vec![header[0]];
            stored.extend_from_slice(&record[5..]);
            record_as_runtime_macro(&stored)?;
        } else if !(match header[0] {
            3 => header[3] < 7 && header[4] == 0,
            4 => header[3] < 127 && header[4] == 0,
            5 => header[3] < 5 && header[4] == 0,
            6 => header[3] == 0 && header[4] == 0,
            7 => [64,80,82].contains(&header[3]) && header[4] == 0,
            _ => false,
        }) { return Err("Unsupported runtime mapping parameters".into()); }
        offset += length;
    }
    Ok(bytes)
}

fn record_as_runtime_macro(bytes: &[u8]) -> Result<(), String> {
    let value = Value::String(bytes.iter().map(|b| format!("{b:02x}")).collect());
    record(&value).map(|_| ())
}

pub fn validate_runtime(request: &Value) -> Result<(), String> {
    let fields = ["expectedActive", "expectedData", "data", "restore", "keys", "snap"];
    let row = request.as_object().ok_or("Invalid runtime mapping request")?;
    if row.len() != fields.len() || row.keys().any(|key| !fields.contains(&key.as_str())) || request["expectedActive"].as_u64().is_none_or(|slot| slot > 4) {
        return Err("Invalid active runtime mapping profile".into());
    }
    runtime_table(&request["expectedData"])?;
    runtime_table(&request["data"])?;
    let restore = request["restore"].as_bool().ok_or("Invalid runtime restore flag")?;
    if restore && request["expectedActive"] == 4 {
        crate::actuation::validate_software(&serde_json::json!({"expectedActive":4,"keys":request["keys"]}))?;
        crate::snap::validate(&serde_json::json!({"wireIndex":4,"expectedActive":4,"expectedData":request["snap"],"data":request["snap"]}))?;
    } else if (!restore && request["expectedActive"] != 4) || !request["keys"].is_null() || !request["snap"].is_null() {
        return Err("Unexpected runtime restore settings".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn runtime_tables_cover_both_levels_and_fn_without_accepting_malformed_records() {
        let table = json!("0600180000060098000006011800000601980000");
        assert_eq!(runtime_table(&table).unwrap().len(), 20);
        for invalid in ["06", "0602180000", "06001800010600180000", "06001800000600180000", "010018ffff", "040018ff00"] {
            assert!(runtime_table(&json!(invalid)).is_err(), "{invalid}");
        }
        let change = json!({"expectedActive":4,"expectedData":"","data":table,"restore":false,"keys":null,"snap":null});
        assert!(validate_runtime(&change).is_ok());
        let mut wrong_slot = change.clone(); wrong_slot["expectedActive"] = json!(0);
        assert!(validate_runtime(&wrong_slot).is_err());
        wrong_slot["restore"] = json!(true);
        assert!(validate_runtime(&wrong_slot).is_ok());
    }
    #[test]
    fn batch_remaps_are_bounded_unique_and_profile_scoped() {
        let first = json!({"wireIndex":4,"expectedActive":4,"physicalKey":26,"level":0,"fnLayer":false,"expectedData":"","data":"01010000000000"});
        assert!(validate_batch(&json!([first])).is_ok());
        assert!(validate_batch(&json!([])).is_err());
        assert!(validate_batch(&json!(vec![first.clone();17])).is_err());
        assert!(validate_batch(&json!([first,first])).is_err());
        let mut other = first.clone(); other["wireIndex"] = json!(0); other["level"] = json!(1);
        assert!(validate_batch(&json!([first,other])).is_err());
    }
    #[test]
    fn physical_modifiers_use_sensor_wire_ids() {
        assert_eq!(canonical(228).unwrap(), 92);
        assert_eq!(canonical(37).unwrap(), 24);
        assert!(canonical(999).is_err());
    }
    #[test]
    fn macro_and_scalar_records_are_bounded() {
        for data in [
            "0418",
            "0306",
            "06",
            "0740",
            "0750",
            "0752",
            "01010000000000983200183200",
        ] {
            assert!(record(&json!(data)).is_ok());
        }
        for data in [
            "04",
            "0380",
            "0700",
            "0751",
            "01010000000000980100180100",
            "zz",
        ] {
            assert!(record(&json!(data)).is_err());
        }
    }
}
