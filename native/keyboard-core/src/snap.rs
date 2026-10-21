//! Three normal snap-override records. Firmware implements LastPressed/EitherOne.
use serde_json::Value;
pub fn validate(request: &Value) -> Result<(), String> {
    let fields = ["wireIndex", "expectedActive", "expectedData", "data"];
    if request
        .as_object()
        .is_none_or(|o| o.len() != 4 || o.keys().any(|k| !fields.contains(&k.as_str())))
    {
        return Err("Invalid snap edit".into());
    }
    request["wireIndex"]
        .as_u64()
        .filter(|v| *v < 5)
        .ok_or("Invalid snap slot")?;
    request["expectedActive"]
        .as_u64()
        .filter(|v| *v < 5)
        .ok_or("Invalid active slot")?;
    if crate::lighting::bytes(&request["expectedData"])?.len() != 15 {
        return Err("Invalid snap backup".into());
    }
    let data = crate::lighting::bytes(&request["data"])?;
    if data.len() != 15 {
        return Err("Expected three snap records".into());
    }
    let mut seen = std::collections::HashSet::new();
    for record in data.chunks_exact(5) {
        if record[0] > 1 || record[1] != 0 || record[2] != 0 || record[3] >= 138 || record[4] >= 138
        {
            return Err("Unsupported snap configuration".into());
        }
        if record[0] == 1 {
            for key in &record[3..] {
                if !seen.insert(key) {
                    return Err("Snap pairs cannot share keys".into());
                }
            }
        }
    }
    Ok(())
}
