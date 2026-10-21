//! Bounds-check complete effect records before the firmware parses them.
use serde_json::Value;
pub fn bytes(value: &Value) -> Result<Vec<u8>, String> {
    let text = value.as_str().ok_or("Invalid lighting data")?;
    if text.len() % 2 != 0 || text.len() > 8176 {
        return Err("Invalid lighting size".into());
    }
    (0..text.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(text.get(i..i + 2).ok_or("Invalid lighting encoding")?, 16)
                .map_err(|_| "Invalid lighting encoding".into())
        })
        .collect()
}
pub fn validate(request: &Value) -> Result<(), String> {
    let object = request.as_object().ok_or("Invalid lighting request")?;
    if object.len() != 5
        || object.keys().any(|key| {
            ![
                "wireIndex",
                "expectedActive",
                "layer",
                "expectedData",
                "data",
            ]
            .contains(&key.as_str())
        })
    {
        return Err("Invalid lighting fields".into());
    }
    for field in ["wireIndex", "expectedActive"] {
        request[field]
            .as_u64()
            .filter(|v| *v < 5)
            .ok_or("Invalid lighting slot")?;
    }
    let layer = request["layer"].as_str().ok_or("Invalid lighting layer")?;
    if !["Base", "Ring", "Reactive"].contains(&layer) {
        return Err("Invalid lighting layer".into());
    }
    // Existing bytes are a compare token; malformed firmware readback must not block recovery.
    bytes(&request["expectedData"])?;
    validate_records(&bytes(&request["data"])?, layer)
}

/// Selector FF feeds the live lighting engine; it never saves a profile to storage.
pub fn validate_runtime(request: &Value) -> Result<(), String> {
    validate(request)?;
    if request["wireIndex"] != 4 || request["expectedData"] != ""
        || request["layer"] != "Base" {
        return Err("Invalid live lighting request".into());
    }
    if bytes(&request["data"])?.is_empty() {
        return Err("Live lighting requires a bounded effect record".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate;
    use serde_json::json;

    #[test]
    fn valid_replacement_can_restore_malformed_existing_lighting() {
        let solid = format!("01{}ff0000", "00".repeat(18));
        let mut request = json!({
            "wireIndex": 3, "expectedActive": 3, "layer": "Base",
            "expectedData": "ff", "data": solid
        });
        assert!(validate(&request).is_ok());
        request["data"] = json!("ff");
        assert!(validate(&request).is_err());
        request["data"] = json!(solid);
        request["expectedData"] = json!("not hex");
        assert!(validate(&request).is_err());
    }
}
fn validate_records<'a>(data: &'a [u8], layer: &str) -> Result<(), String> {
    let mut offset = 0;
    let mut count = 0;
    while offset < data.len() {
        count += 1;
        if count > if layer == "Reactive" { 2 } else { 10 } {
            return Err("Too many lighting zones".into());
        }
        let start = offset;
        let mut take = |n: usize| -> Result<&[u8], String> {
            if offset + n > data.len() {
                return Err("Truncated lighting record".into());
            }
            let result = &data[offset..offset + n];
            offset += n;
            Ok(result)
        };
        let tag = take(1)?[0];
        take(18)?;
        if (layer == "Reactive") != [7, 8, 9].contains(&tag) {
            return Err("Effect belongs to another layer".into());
        }
        let gradient = |take: &mut dyn FnMut(usize) -> Result<&'a [u8], String>,
                        size: usize|
         -> Result<(), String> {
            let n = take(1)?[0] as usize;
            if !(1..=10).contains(&n) {
                return Err("Invalid color stop count".into());
            }
            take(n * size)?;
            Ok(())
        };
        match tag {
            1 => {
                take(3)?;
            }
            2 | 11 => {
                take(1)?;
                gradient(&mut take, 4)?;
            }
            3 | 4 => {
                let attrs = take(2)?;
                if attrs[0] > 100 {
                    return Err("Invalid effect speed".into());
                }
                let mode = attrs[1];
                if tag == 3 && (mode == 3 || mode == 4) {
                    gradient(&mut take, 4)?;
                } else if tag == 4 && mode == 3 {
                    gradient(&mut take, 3)?;
                } else if mode > 1 {
                    return Err("Invalid color mode".into());
                }
            }
            5 => {
                let attrs = take(4)?;
                if attrs[1] > 100 {
                    return Err("Invalid effect speed".into());
                }
                match attrs[3] {
                    3 | 4 => gradient(&mut take, 4)?,
                    2 => {
                        take(3)?;
                    }
                    0 => {}
                    _ => return Err("Invalid wave color".into()),
                }
            }
            10 => {
                let attrs = take(3)?;
                if attrs[1] > 100 {
                    return Err("Invalid effect speed".into());
                }
                match attrs[2] {
                    3 | 4 => gradient(&mut take, 4)?,
                    0 | 1 => {}
                    _ => return Err("Invalid marquee color".into()),
                }
            }
            7 | 9 => {
                let attrs = take(4)?;
                if attrs[0] > 100 || attrs[1] > 5 {
                    return Err("Invalid reactive effect".into());
                }
                match attrs[3] {
                    3 | 4 => gradient(&mut take, 4)?,
                    2 => {
                        take(3)?;
                    }
                    0 | 1 => {}
                    _ => return Err("Invalid reactive color".into()),
                }
            }
            8 => {
                let attrs = take(3)?;
                if attrs[0] > 100 || attrs[1] > 5 {
                    return Err("Invalid fade effect".into());
                }
                match attrs[2] {
                    2 => {
                        take(3)?;
                    }
                    0 | 1 => {}
                    _ => return Err("Invalid fade color".into()),
                }
            }
            _ => return Err("Unknown lighting effect".into()),
        }
        if offset <= start {
            return Err("Invalid effect length".into());
        }
    }
    Ok(())
}
