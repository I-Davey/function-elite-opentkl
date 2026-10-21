//! Recover the original ActuationConfig value schema from HE profile words.
//! Reserved bits remain in the raw record; this module never writes a word.
use serde_json::{json, Value};

/// Validate a small per-key transaction. Reserved firmware bits are retained;
/// callers cannot replace the whole profile or address an unmapped sensor.
pub fn validate_edit(request: &Value) -> Result<(), String> {
    let object = request.as_object().ok_or("Invalid actuation request")?;
    if object.len() != 3
        || object
            .keys()
            .any(|k| !["wireIndex", "expectedActive", "keys"].contains(&k.as_str()))
    {
        return Err("Invalid actuation request fields".into());
    }
    let slot = request["wireIndex"]
        .as_u64()
        .filter(|v| *v < 5)
        .ok_or("Invalid hardware slot")?;
    if request["expectedActive"].as_u64() != Some(slot) {
        return Err("Actuation edit requires the active hardware slot".into());
    }
    let edits = request["keys"]
        .as_array()
        .filter(|v| !v.is_empty() && v.len() <= 10)
        .ok_or("Actuation transaction must contain 1–10 keys")?;
    let layout: Value = serde_json::from_str(include_str!("../../../resources/keyboard/key-layout.json"))
        .map_err(|e| e.to_string())?;
    let mut seen = std::collections::HashSet::new();
    for edit in edits {
        if edit.as_object().is_none_or(|o| {
            o.len() != 3
                || o.keys()
                    .any(|k| !["physicalKey", "expectedWord", "word"].contains(&k.as_str()))
        }) {
            return Err("Invalid actuation key fields".into());
        }
        let id = edit["physicalKey"].as_u64().ok_or("Invalid physical key")?;
        if !seen.insert(id)
            || !layout["sensors"]
                .as_object()
                .unwrap()
                .values()
                .any(|k| k["physicalKeyId"] == id)
        {
            return Err("Unmapped or duplicate actuation key".into());
        }
        let old = edit["expectedWord"]
            .as_u64()
            .filter(|v| *v <= u32::MAX as u64)
            .ok_or("Invalid expected actuation")? as u32;
        let word = edit["word"]
            .as_u64()
            .filter(|v| *v <= u32::MAX as u64)
            .ok_or("Invalid actuation word")? as u32;
        if old & 0xc0c0c0fc != word & 0xc0c0c0fc {
            return Err("Actuation edit changed reserved fields".into());
        }
        if word & 3 > 2
            || ((word >> 8) & 63) >= 40
            || ((word >> 16) & 63) >= 40
            || ((word >> 24) & 63) >= 40
        {
            return Err("Actuation outside firmware capability".into());
        }
    }
    Ok(())
}

pub fn decode(records: &[Value]) -> Result<Vec<Value>, String> {
    let layout: Value = serde_json::from_str(include_str!("../../../resources/keyboard/key-layout.json"))
        .map_err(|e| e.to_string())?;
    let fixture: Value =
        serde_json::from_str(include_str!("../../../resources/keyboard/offline-device.json"))
            .map_err(|e| e.to_string())?;
    let types = fixture["device"]["capabilityData"]["keyRemap"]["validActuationTypes"]
        .as_array()
        .ok_or("Missing keyboard capability types")?;
    let levels = &types
        .iter()
        .find(|t| t["kind"] == "Single")
        .ok_or("Missing Single capability")?["validLevels"];
    let sensitivities = &types
        .iter()
        .find(|t| t["kind"] == "Rapid")
        .ok_or("Missing Rapid capability")?["validSensitivity"];
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    for record in records {
        let sensor = record["sensorId"]
            .as_u64()
            .ok_or("Invalid actuation sensor ID")?;
        let Some(key) = layout["sensors"].get(sensor.to_string()) else {
            continue;
        };
        let physical = key["physicalKeyId"]
            .as_u64()
            .ok_or("Invalid physical key ID")?;
        if !seen.insert(physical) {
            return Err("Duplicate physical actuation key".into());
        }
        let word = record["word"]
            .as_u64()
            .filter(|v| *v <= u32::MAX as u64)
            .ok_or("Invalid HE profile word")? as u32;
        let primary = ((word >> 8) & 63) as usize;
        let secondary = ((word >> 16) & 63) as usize;
        let rapid = ((word >> 24) & 63) as usize;
        let level = |slot: usize| -> Result<Value, String> {
            levels
                .get(slot)
                .cloned()
                .filter(|v| v.is_object())
                .ok_or(format!("Unsupported actuation slot {}", slot))
        };
        let config = match word & 3 {
            0 => json!({"kind":"Single","level":level(primary)?}),
            1 => json!({"kind":"Dual","level1":level(primary)?,"level2":level(secondary)?}),
            2 => {
                json!({"kind":"Rapid","level":level(primary)?,"sensitivity":sensitivities.get(rapid).filter(|v|v.is_object()).ok_or("Unsupported rapid-trigger sensitivity")?})
            }
            _ => return Err("Unsupported actuation mode".into()),
        };
        result.push(json!({"physicalKey":physical,"sensorId":sensor,"label":key["label"],"rawWord":word,
            "levelIndex":primary,"secondLevelIndex":secondary,"rapidSensitivityIndex":rapid,"config":config}));
    }
    if result.len() != 88 {
        return Err(format!(
            "Expected 88 actuation keys, found {}",
            result.len()
        ));
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn capture() -> Value {
        serde_json::from_str(include_str!("../../../resources/keyboard/actuation-read.json")).unwrap()
    }
    #[test]
    fn all_physical_keys_and_original_config_schema() {
        let raw = capture();
        let keys = decode(raw["records"].as_array().unwrap()).unwrap();
        assert_eq!(keys.len(), 88);
        let w = keys.iter().find(|k| k["physicalKey"] == 26).unwrap();
        assert_eq!(w["sensorId"], 34);
        assert_eq!(w["config"]["kind"], "Rapid");
        assert_eq!(w["config"]["level"]["valueMicroMeters"], 600);
        assert_eq!(w["config"]["sensitivity"]["valueMicroMeters"], 560);
        assert!(keys.iter().all(|k| k["config"]["kind"] == "Single"
            || k["config"]["kind"] == "Rapid"
            || k["config"]["kind"] == "Dual"));
    }
    #[test]
    fn malformed_matrix_and_slots_rejected() {
        let raw = capture();
        let records = raw["records"].as_array().unwrap();
        assert!(decode(&records[1..]).is_err());
        let mut duplicate = records.clone();
        duplicate[1] = duplicate[0].clone();
        assert!(decode(&duplicate).is_err());
        for word in [0x3f00u32, 0x3f000002u32, 3u32] {
            let mut invalid = records.clone();
            invalid[0]["word"] = json!(word);
            assert!(decode(&invalid).is_err());
        }
    }
}

/// Software profiles use the documented normal RAM-only selector 0xff. Their
/// complete actuation image comes from the application's own persisted profile.
pub fn validate_software(request: &Value) -> Result<(), String> {
    if request.as_object().is_none_or(|o| {
        o.len() != 2 || !o.contains_key("keys") || !o.contains_key("expectedActive")
    }) || request["expectedActive"] != 4
    {
        return Err("Invalid software actuation request".into());
    }
    let keys = request["keys"]
        .as_array()
        .filter(|keys| keys.len() == 88)
        .ok_or("Software actuation requires all 88 keys")?;
    let mut seen = std::collections::HashSet::new();
    for key in keys {
        if key.as_object().is_none_or(|o| {
            o.len() != 2 || !o.contains_key("physicalKey") || !o.contains_key("word")
        }) {
            return Err("Invalid software key fields".into());
        }
        let id = key["physicalKey"].as_u64().ok_or("Invalid software key")?;
        crate::remap::canonical(id)?;
        if !seen.insert(id) {
            return Err("Duplicate software key".into());
        }
        let word = key["word"]
            .as_u64()
            .filter(|v| *v <= u32::MAX as u64)
            .ok_or("Invalid software actuation word")? as u32;
        if word & 0xc0c0c0fc != 0
            || word & 3 > 2
            || ((word >> 8) & 63) >= 40
            || ((word >> 16) & 63) >= 40
            || ((word >> 24) & 63) >= 40
        {
            return Err("Invalid software actuation configuration".into());
        }
    }
    Ok(())
}
