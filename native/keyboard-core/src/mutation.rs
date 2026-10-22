//! Narrow normal-setting operations. No caller can supply a USB command.
//! Expected values prevent applying a stale editor snapshot to changed hardware.
use serde_json::Value;

pub fn profile_slot(value: &Value) -> Result<u8, String> {
    if value.as_object().is_none_or(|row| row.len() != 1 || !row.contains_key("wireIndex")) {
        return Err("Expected one profile slot".into());
    }
    value["wireIndex"].as_u64().filter(|slot| *slot < 5).map(|slot| slot as u8).ok_or("Invalid profile slot".into())
}

pub struct FieldChange {
    pub field: String,
    pub slot: u8,
    pub active: u8,
    pub expected: u8,
    pub value: u8,
    pub getter: u8,
    pub setter: u8,
    pub selector: u8,
}

impl FieldChange {
    pub fn parse(value: &Value) -> Result<Self, String> {
        let object = value.as_object().ok_or("Expected setting request")?;
        let names = [
            "field",
            "wireIndex",
            "expectedActive",
            "expectedValue",
            "value",
        ];
        if object.len() != names.len() || object.keys().any(|key| !names.contains(&key.as_str())) {
            return Err("Unknown or missing setting fields".into());
        }
        let number = |key: &str, maximum: u64| -> Result<u8, String> {
            value[key]
                .as_u64()
                .filter(|n| *n <= maximum)
                .map(|n| n as u8)
                .ok_or(format!("Invalid setting {}", key))
        };
        let field = value["field"].as_str().ok_or("Missing setting name")?;
        let slot = number("wireIndex", 4)?;
        let (getter, setter, selector, maximum) = match field {
            "brightnessKeys" => (0x40, 0x41, 0, 100),
            "brightnessRing" => (0x40, 0x41, 1, 100),
            "pollingRate" => (0x5c, 0x5d, slot, 6),
            "gameMode" => (0x56, 0x57, slot, 1),
            "fnLock" => (0x58, 0x59, slot, 1),
            "idleMinutes" => (0x5a, 0x5b, slot, 100),
            "activeProfile" => (0x44, 0x45, 0, 4),
            _ => return Err("Unsupported setting name".into()),
        };
        Ok(Self {
            field: field.into(),
            slot,
            active: number("expectedActive", 4)?,
            expected: number("expectedValue", maximum)?,
            value: number("value", maximum)?,
            getter,
            setter,
            selector,
        })
    }

    pub fn acknowledgement(&self) -> Vec<u8> {
        if self.getter == 0x40 || self.getter == 0x44 {
            vec![1]
        } else {
            vec![1, self.slot]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn named_fields_have_only_reviewed_commands() {
        for (field, command, limit) in [
            ("brightnessKeys", 0x41, 100),
            ("brightnessRing", 0x41, 100),
            ("pollingRate", 0x5d, 6),
            ("gameMode", 0x57, 1),
            ("idleMinutes", 0x5b, 100),
        ] {
            let request = json!({"field":field,"wireIndex":0,"expectedActive":0,"expectedValue":0,"value":limit});
            assert_eq!(FieldChange::parse(&request).unwrap().setter, command);
            let mut invalid = request.clone();
            invalid["value"] = json!(limit + 1);
            assert!(FieldChange::parse(&invalid).is_err());
        }
    }
    #[test]
    fn malformed_and_raw_operations_are_rejected() {
        let request = json!({"field":"pollingRate","wireIndex":0,"expectedActive":0,"expectedValue":0,"value":0});
        for (key, value) in [
            ("field", json!("raw")),
            ("wireIndex", json!(5)),
            ("value", json!(-1)),
            ("value", json!(1.2)),
        ] {
            let mut invalid = request.clone();
            invalid[key] = value;
            assert!(FieldChange::parse(&invalid).is_err());
        }
        let mut extra = request.clone();
        extra["command"] = json!(0xa0);
        assert!(FieldChange::parse(&extra).is_err());
    }
}
