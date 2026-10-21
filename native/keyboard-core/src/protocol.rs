//! Function Elite 2.2.14 keyboard protocol. Reconstructed from the retained CAM
//! device-class/protocol evidence and independently checked firmware functions.
//! Named normal reads and validated, journaled settings operations only.
use crate::windows::Hid;
use serde_json::{json, Value};

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
pub struct Keyboard {
    hid: Hid,
    journal: Vec<Value>,
    firmware: String,
    path: String,
    active_read: Option<u8>,
    authorized_write: Option<(u8, Vec<u8>)>,
}
impl Keyboard {
    pub fn open(path: &str) -> Result<Self, String> {
        Ok(Self {
            hid: Hid::open(path)?,
            journal: Vec::new(),
            firmware: String::new(),
            path: path.into(),
            active_read: None,
            authorized_write: None,
        })
    }
    fn allowed(&self, command: u8, arguments: &[u8]) -> bool {
        if self
            .authorized_write
            .as_ref()
            .is_some_and(|(c, a)| *c == command && a == arguments)
        {
            return true;
        }
        match (command, arguments) {
            (1 | 0x44 | 0x61 | 0x63, []) => true,
            (0x88, [2, slot]) => *slot < 4 || *slot == 255,
            (0x40, [channel]) => *channel < 2,
            (0x56 | 0x58 | 0x5a, [slot]) => *slot < 5 || *slot == 255,
            (0x5c | 0x73 | 0x31 | 0x34 | 0x38, [slot]) => *slot < 5,
            (0x51 | 0x97, [slot, key, layer]) => *slot < 5 && *key < 138 && *layer < 2,
            (0x75, [0x21, selector]) => {
                [0xfa, 0xfb, 0xf8, 0xfe, 0xff].contains(selector)
                    || self.active_read == Some(*selector)
            }
            _ => false,
        }
    }
    fn query(&mut self, command: u8, arguments: &[u8]) -> Result<Vec<u8>, String> {
        if !self.allowed(command, arguments) {
            return Err("Keyboard request outside implemented contract".into());
        }
        let requests = outgoing(command, arguments)?;
        let request = requests[0];
        let mut sent = Vec::new();
        let mut fragment_acks = Vec::new();
        for (index, mut frame) in requests.iter().copied().enumerate() {
            self.hid
                .transfer(&mut frame, true)
                .map_err(|e| format!("Command {:02x}: {}", command, e))?;
            sent.push(hex(&frame));
            if index + 1 < requests.len() {
                let mut ack = [0u8; 64];
                self.hid.transfer(&mut ack, false)?;
                if ack[0] != 0x43 || ack[1] & 0x40 == 0 {
                    return Err("Invalid outgoing fragment acknowledgement".into());
                }
                fragment_acks.push(hex(&ack));
            }
        }
        let lighting = [0x31, 0x34, 0x38, 0x51, 0x97].contains(&command);
        let mut decoder = Frames::new(if lighting { 4090 } else { 1024 });
        let mut frames = Vec::new();
        for _ in 0..if lighting { 78 } else { 20 } {
            let mut frame = [0u8; 64];
            self.hid.transfer(&mut frame, false).map_err(|e| {
                format!(
                    "Command {:02x}, response frame {}: {}",
                    command,
                    frames.len(),
                    e
                )
            })?;
            frames.push(hex(&frame));
            if decoder.push(&frame)? {
                let result = decoder.bytes;
                self.journal.push(json!({"command":command,"selector":if arguments.len()==2 {arguments[1] as i32}else{-1},
                    "arguments":hex(arguments),"request":hex(&request),"requests":sent,"fragmentAcknowledgements":fragment_acks,"frames":frames,"payloadLength":result.len(),"response":hex(&result)}));
                return Ok(result);
            }
        }
        Err("Keyboard response frame limit exceeded".into())
    }
    fn byte(&mut self, command: u8, arguments: &[u8]) -> Result<u8, String> {
        let result = self.query(command, arguments)?;
        if result.len() != 1 {
            return Err(format!(
                "Command {:02x}: expected one-byte response",
                command
            ));
        }
        Ok(result[0])
    }
    fn field(&mut self, command: u8, slot: u8) -> Result<u8, String> {
        let result = self.query(command, &[slot])?;
        if result.len() != 3 || result[0] != 1 || result[1] != slot {
            return Err("Invalid keyboard profile field response".into());
        }
        Ok(result[2])
    }
    fn matrix(&mut self, selector: u8) -> Result<Vec<(u8, u16)>, String> {
        let result = self.query(0x75, &[0x21, selector])?;
        if result.len() != 290 || result[0] != 1 || result[1] != 96 {
            return Err("Invalid keyboard sensor matrix".into());
        }
        Ok(result[2..]
            .chunks_exact(3)
            .map(|r| (r[0], u16::from_be_bytes([r[1], r[2]])))
            .collect())
    }
    fn profile_index(&mut self) -> Result<u8, String> {
        let result = self.byte(0x44, &[])?;
        if result > 4 {
            return Err("Invalid active keyboard profile".into());
        }
        Ok(result)
    }
    fn same_profile(&mut self, slot: u8) -> Result<(), String> {
        if self.profile_index()? != slot {
            return Err("Keyboard profile changed during read; capture discarded".into());
        }
        Ok(())
    }
    fn state(&mut self) -> Result<Value, String> {
        let active = self.profile_index()?;
        let keys = self.byte(0x40, &[0])?;
        let ring = self.byte(0x40, &[1])?;
        if keys > 100 || ring > 100 {
            return Err("Invalid keyboard brightness".into());
        }
        let mut profiles = Vec::new();
        for slot in 0..5 {
            profiles.push(json!({"wireIndex":slot,"field0":self.field(0x5c,slot)?,"field3":self.field(0x56,slot)?,
                "field4":self.field(0x58,slot)?,"field5":self.field(0x5a,slot)?,"field7":self.field(0x73,slot)?}));
        }
        let a = self.query(0x61, &[])?;
        let b = self.query(0x63, &[])?;
        if a.len() != 2 || b.len() != 2 {
            return Err("Invalid keyboard timer response".into());
        }
        self.same_profile(active)?;
        Ok(
            json!({"activeProfileIndex":active,"brightnessChannels":[keys,ring],"profiles":profiles,
            "timerWords":[u16::from_le_bytes([a[0],a[1]]),u16::from_le_bytes([b[0],b[1]])]}),
        )
    }
    fn sensors(&mut self) -> Result<Value, String> {
        let baseline = self.matrix(0xfa)?;
        let pressed = self.matrix(0xfb)?;
        let scale = self.matrix(0xf8)?;
        let threshold = self.matrix(0xfe)?;
        let current = self.matrix(0xff)?;
        let mut keys = Vec::new();
        for i in 0..96 {
            let id = current[i].0;
            if [baseline[i].0, pressed[i].0, scale[i].0, threshold[i].0]
                .iter()
                .any(|s| *s != id)
            {
                return Err("Keyboard sensor matrix identities differ".into());
            }
            let (b, p, s) = (baseline[i].1, pressed[i].1, scale[i].1);
            if id == 255 || b == 0 || b >= p || p == 65535 || s == 0 || s == 65535 {
                continue;
            }
            keys.push(json!({"sensorId":id,"matrixIndex":i,"adc":current[i].1,"baseline":b,"pressed":p,"scale":s,"threshold":threshold[i].1}));
        }
        Ok(json!({"supportedCount":keys.len(),"keys":keys}))
    }
    fn lighting(&mut self) -> Result<Value, String> {
        let active = self.profile_index()?;
        let mut profiles = Vec::new();
        for slot in 0..5 {
            let mut layers = Vec::new();
            for (command, kind) in [(0x31, "Base"), (0x34, "Ring"), (0x38, "Reactive")] {
                let response = self.query(command, &[slot])?;
                if response.len() < 2
                    || response[1] != slot
                    || !(1..=2).contains(&response[0])
                    || response[0] == 2 && response.len() != 2
                {
                    return Err("Invalid stored keyboard lighting response".into());
                }
                layers.push(json!({"command":command,"kind":kind,"status":response[0],"data":hex(&response[2..])}));
            }
            profiles.push(json!({"wireIndex":slot,"layers":layers}));
        }
        self.same_profile(active)?;
        Ok(json!({"activeProfileIndex":active,"profiles":profiles}))
    }
    fn actuation(&mut self) -> Result<Value, String> {
        let active = self.profile_index()?;
        // Both firmware's active-slot getter and threshold reader compare the
        // byte at 0x2000c705. A matching selector reads the in-memory table.
        self.active_read = Some(active);
        let response = self.query(0x75, &[0x21, active]);
        self.active_read = None;
        let response = response?;
        self.same_profile(active)?;
        if response.len() != 482 || response[0] != 1 || response[1] != 96 {
            return Err("Invalid keyboard actuation matrix".into());
        }
        let records:Vec<Value>=response[2..].chunks_exact(5).enumerate().map(|(i,r)|json!({"sensorId":r[0],"matrixIndex":i,"word":u32::from_be_bytes([r[1],r[2],r[3],r[4]])})).collect();
        let actuations = crate::actuation::decode(&records)?;
        Ok(json!({"activeProfileIndex":active,"records":records,"actuations":actuations}))
    }
    fn change_field(&mut self, change: crate::mutation::FieldChange) -> Result<Value, String> {
        self.same_profile(change.active)?;
        let read = |keyboard: &mut Self| {
            if change.getter == 0x44 {
                keyboard.profile_index()
            } else if change.getter == 0x40 {
                keyboard.byte(change.getter, &[change.selector])
            } else {
                keyboard.field(change.getter, change.slot)
            }
        };
        let before = read(self)?;
        if before != change.expected {
            return Err("Keyboard setting changed since backup; refresh before editing".into());
        }
        self.same_profile(change.active)?;
        if before == change.value {
            return Ok(
                json!({"outcome":"unchanged","field":change.field,"before":before,"after":before,"mutationAttempted":false}),
            );
        }
        let arguments = if change.getter == 0x44 {
            vec![change.value]
        } else {
            vec![change.selector, change.value]
        };
        self.authorized_write = Some((change.setter, arguments.clone()));
        let acknowledgement = self.query(change.setter, &arguments);
        self.authorized_write = None;
        // A failed/ambiguous transaction is never silently retried. Its receipt
        // survives in the host journal and requires a fresh read before editing.
        let verification = (|| -> Result<u8, String> {
            let ack = acknowledgement?;
            if ack != change.acknowledgement() {
                return Err(format!("Unexpected setting acknowledgement: {}", hex(&ack)));
            }
            self.same_profile(if change.getter == 0x44 {
                change.value
            } else {
                change.active
            })?;
            let after = read(self)?;
            if after != change.value {
                return Err(format!(
                    "Setting readback mismatch: expected {}, found {}",
                    change.value, after
                ));
            }
            Ok(after)
        })();
        Ok(match verification {
            Ok(after) => {
                json!({"outcome":"applied","field":change.field,"wireIndex":change.slot,"before":before,"after":after,"mutationAttempted":true})
            }
            Err(error) => {
                json!({"outcome":"uncertain","field":change.field,"wireIndex":change.slot,"before":before,"requested":change.value,"error":error,"mutationAttempted":true})
            }
        })
    }
    fn apply_actuation(&mut self, request: Value) -> Result<Value, String> {
        crate::actuation::validate_edit(&request)?;
        let slot = request["wireIndex"].as_u64().unwrap() as u8;
        let before = self.actuation()?;
        if before["activeProfileIndex"] != slot {
            return Err("Active hardware profile changed".into());
        }
        let edits = request["keys"].as_array().unwrap();
        let mut arguments = vec![0x20, slot, edits.len() as u8];
        for edit in edits {
            let id = edit["physicalKey"].as_u64().unwrap();
            let current = before["actuations"]
                .as_array()
                .unwrap()
                .iter()
                .find(|k| k["physicalKey"] == id)
                .ok_or("Actuation physical key missing")?;
            if current["rawWord"] != edit["expectedWord"] {
                return Err("Actuation changed since backup; refresh".into());
            }
            let word = edit["word"].as_u64().unwrap() as u32;
            let wire = current["sensorId"]
                .as_u64()
                .ok_or("Missing firmware key mapping")?;
            arguments.push(wire as u8);
            arguments.extend(word.to_be_bytes());
        }
        self.same_profile(slot)?;
        self.authorized_write = Some((0x75, arguments.clone()));
        let acknowledgement = self.query(0x75, &arguments);
        self.authorized_write = None;
        let verification = (|| -> Result<Value, String> {
            if acknowledgement? != vec![1] {
                return Err("Actuation setter rejected transaction".into());
            }
            let after = self.actuation()?;
            for key in before["actuations"].as_array().unwrap() {
                let id = key["physicalKey"].as_u64().unwrap();
                let expected = edits
                    .iter()
                    .find(|e| e["physicalKey"] == id)
                    .map(|e| &e["word"])
                    .unwrap_or(&key["rawWord"]);
                let found = after["actuations"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .find(|k| k["physicalKey"] == id)
                    .ok_or("Actuation readback key missing")?;
                if &found["rawWord"] != expected {
                    return Err(format!(
                        "Actuation readback mismatch on physical key {}",
                        id
                    ));
                }
            }
            Ok(after)
        })();
        Ok(match verification {
            Ok(after) => {
                json!({"outcome":"applied","mutationAttempted":true,"before":before,"after":after})
            }
            Err(error) => {
                json!({"outcome":"uncertain","mutationAttempted":true,"error":error,"before":before})
            }
        })
    }
    fn apply_runtime_lighting(&mut self, request: Value) -> Result<Value, String> {
        crate::lighting::validate_runtime(&request)?;
        self.same_profile(request["expectedActive"].as_u64().unwrap() as u8)?;
        let command = 0x30;
        let mut arguments = vec![255];
        arguments.extend(crate::lighting::bytes(&request["data"])?);
        self.authorized_write = Some((command, arguments.clone()));
        let response = self.query(command, &arguments);
        self.authorized_write = None;
        let acknowledgement = response?;
        if acknowledgement != vec![1, 255] {
            return Err(format!("Live {} lighting update rejected: {}", request["layer"].as_str().unwrap(), hex(&acknowledgement)));
        }
        Ok(json!({"outcome":"acknowledged","mutationAttempted":true,"temporary":true}))
    }
    fn apply_lighting(&mut self, request: Value) -> Result<Value, String> {
        crate::lighting::validate(&request)?;
        let slot = request["wireIndex"].as_u64().unwrap() as u8;
        let active = request["expectedActive"].as_u64().unwrap() as u8;
        let (getter, setter, clear) = match request["layer"].as_str().unwrap() {
            "Base" => (0x31, 0x30, 0x32),
            "Ring" => (0x34, 0x33, 0x35),
            _ => (0x38, 0x37, 0x39),
        };
        self.same_profile(active)?;
        let before = self.query(getter, &[slot])?;
        if before.len() < 2 || before[1] != slot || ![1, 2].contains(&before[0]) {
            return Err("Invalid lighting backup response".into());
        }
        if before[2..] != crate::lighting::bytes(&request["expectedData"])? {
            return Err("Lighting changed since backup; refresh".into());
        }
        let bytes = crate::lighting::bytes(&request["data"])?;
        if before[2..] == bytes {
            return Ok(json!({"outcome":"unchanged","mutationAttempted":false}));
        }
        let (command, arguments) = if bytes.is_empty() {
            (clear, vec![slot, 0])
        } else {
            let mut arguments = vec![slot];
            arguments.extend(&bytes);
            (setter, arguments)
        };
        self.authorized_write = Some((command, arguments.clone()));
        let ack = self.query(command, &arguments);
        self.authorized_write = None;
        let verification = (|| -> Result<Vec<u8>, String> {
            if ack? != vec![1, slot] {
                return Err("Lighting setter rejected transaction".into());
            }
            self.same_profile(active)?;
            let after = self.query(getter, &[slot])?;
            if after.len() < 2 || after[1] != slot || after[2..] != bytes {
                return Err("Lighting readback mismatch".into());
            }
            Ok(after)
        })();
        Ok(match verification {
            Ok(after) => {
                json!({"outcome":"applied","mutationAttempted":true,"after":hex(&after[2..])})
            }
            Err(error) => {
                json!({"outcome":"uncertain","mutationAttempted":true,"error":error,"before":hex(&before[2..])})
            }
        })
    }
    /// Compare the exact stored record, change one layer/level, then read it back.
    fn apply_software_actuation(&mut self, request: Value) -> Result<Value, String> {
        crate::actuation::validate_software(&request)?;
        self.same_profile(4)?;
        let mut arguments = vec![0x20, 0xff, 88];
        for key in request["keys"].as_array().unwrap() {
            arguments.push(crate::remap::canonical(
                key["physicalKey"].as_u64().unwrap(),
            )?);
            arguments.extend((key["word"].as_u64().unwrap() as u32).to_be_bytes());
        }
        self.authorized_write = Some((0x75, arguments.clone()));
        let result = self.query(0x75, &arguments);
        self.authorized_write = None;
        let verify = (|| -> Result<(), String> {
            if result? != vec![1] {
                return Err("Software actuation setter rejected the profile".into());
            }
            self.same_profile(4)?;
            Ok(())
        })();
        Ok(match verify {
            Ok(()) => {
                json!({"outcome":"acknowledged","mutationAttempted":true,"actuationReadbackAvailable":false,"persistentActuationWrite":false,"keys":88})
            }
            Err(error) => json!({"outcome":"uncertain","mutationAttempted":true,"error":error}),
        })
    }
    fn apply_snap(&mut self, request: Value) -> Result<Value, String> {
        crate::snap::validate(&request)?;
        let logical = request["wireIndex"].as_u64().unwrap() as u8;
        let slot = if logical == 4 { 255 } else { logical };
        let active = request["expectedActive"].as_u64().unwrap() as u8;
        if logical == 4 && active != 4 {
            return Err("Software snap requires the active software slot".into());
        }
        self.same_profile(active)?;
        let before = self.query(0x88, &[2, slot])?;
        if before.len() != 18
            || before[..3] != [1, slot, 3]
            || before[3..] != crate::lighting::bytes(&request["expectedData"])?
        {
            return Err("Snap settings changed or invalid backup".into());
        }
        let data = crate::lighting::bytes(&request["data"])?;
        if before[3..] == data {
            return Ok(json!({"outcome":"unchanged","mutationAttempted":false}));
        }
        let mut arguments = vec![1, slot, 3];
        arguments.extend(&data);
        self.authorized_write = Some((0x88, arguments.clone()));
        let ack = self.query(0x88, &arguments);
        self.authorized_write = None;
        let verified = (|| -> Result<(), String> {
            if ack? != vec![1] {
                return Err("Snap setter rejected transaction".into());
            }
            self.same_profile(active)?;
            let after = self.query(0x88, &[2, slot])?;
            if after.len() != 18 || after[..3] != [1, slot, 3] || after[3..] != data {
                return Err("Snap readback mismatch".into());
            }
            Ok(())
        })();
        Ok(match verified {
            Ok(()) => json!({"outcome":"applied","mutationAttempted":true,"after":hex(&data)}),
            Err(error) => json!({"outcome":"uncertain","mutationAttempted":true,"error":error}),
        })
    }
    fn apply_remap(&mut self, request: Value) -> Result<Value, String> {
        crate::remap::validate_edit(&request)?;
        let slot = request["wireIndex"].as_u64().unwrap() as u8;
        let active = request["expectedActive"].as_u64().unwrap() as u8;
        let wire = crate::remap::canonical(request["physicalKey"].as_u64().unwrap())?;
        let layer = u8::from(request["fnLayer"].as_bool().unwrap());
        let (getter, setter, clear) = if request["level"] == 0 {
            (0x51, 0x50, 0x52)
        } else {
            (0x97, 0x96, 0x98)
        };
        self.same_profile(active)?;
        let args = [slot, wire, layer];
        let before = self.query(getter, &args)?;
        if before.len() < 2 || before[1] != slot || ![1, 2].contains(&before[0]) {
            return Err("Invalid remap backup response".into());
        }
        if before[2..] != crate::lighting::bytes(&request["expectedData"])? {
            return Err("Remap changed since backup; refresh".into());
        }
        let bytes = crate::remap::record(&request["data"])?;
        if before[2..] == bytes {
            return Ok(json!({"outcome":"unchanged","mutationAttempted":false}));
        }
        let mut arguments = args.to_vec();
        let command = if bytes.is_empty() {
            arguments.push(0);
            clear
        } else {
            arguments.extend(&bytes);
            setter
        };
        self.authorized_write = Some((command, arguments.clone()));
        let ack = self.query(command, &arguments);
        self.authorized_write = None;
        let verified = (|| -> Result<Value, String> {
            if ack? != vec![1, slot] {
                return Err("Remap setter rejected transaction".into());
            }
            self.same_profile(active)?;
            let after = self.query(getter, &args)?;
            if after.len() < 2
                || after[1] != slot
                || ![1, 2].contains(&after[0])
                || after[2..] != bytes
            {
                return Err("Remap readback mismatch".into());
            }
            Ok(
                json!({"data":hex(&after[2..]),"physicalKey":request["physicalKey"],"level":request["level"],"fnLayer":request["fnLayer"]}),
            )
        })();
        Ok(match verified {
            Ok(after) => json!({"outcome":"applied","mutationAttempted":true,"after":after}),
            Err(error) => {
                json!({"outcome":"uncertain","mutationAttempted":true,"before":hex(&before[2..]),"error":error})
            }
        })
    }
    fn apply_remaps(&mut self, request: Value) -> Result<Value, String> {
        crate::remap::validate_batch(&request)?;
        let records = request.as_array().unwrap();
        let active = records[0]["expectedActive"].as_u64().unwrap() as u8;
        self.same_profile(active)?;
        let mut changes = Vec::new();
        // Compare every record before the first write; the host journals originals before calling us.
        for record in records {
            let slot = record["wireIndex"].as_u64().unwrap() as u8;
            let args = vec![slot, crate::remap::canonical(record["physicalKey"].as_u64().unwrap())?, u8::from(record["fnLayer"].as_bool().unwrap())];
            let (getter, setter, clear) = if record["level"] == 0 { (0x51,0x50,0x52) } else { (0x97,0x96,0x98) };
            let before = self.query(getter, &args)?;
            if before.len() < 2 || before[1] != slot || ![1,2].contains(&before[0]) || before[2..] != crate::lighting::bytes(&record["expectedData"])? {
                return Err("Remap transaction changed since backup".into());
            }
            let data = crate::remap::record(&record["data"])?;
            if before[2..] != data { changes.push((slot,args,getter,setter,clear,data)); }
        }
        let mut attempted = false;
        let result = (|| -> Result<(), String> {
            for (slot,args,_,setter,clear,data) in &changes {
                self.same_profile(active)?;
                let mut arguments = args.clone();
                let command = if data.is_empty() { arguments.push(0); *clear } else { arguments.extend(data); *setter };
                self.authorized_write = Some((command, arguments.clone()));
                attempted = true;
                let acknowledgement = self.query(command, &arguments);
                self.authorized_write = None;
                if acknowledgement? != vec![1,*slot] { return Err("Remap transaction setter rejected".into()); }
            }
            for (slot,args,getter,_,_,data) in &changes {
                let after = self.query(*getter, args)?;
                if after.len() < 2 || after[1] != *slot || ![1,2].contains(&after[0]) || after[2..] != *data {
                    return Err("Remap transaction readback mismatch".into());
                }
            }
            self.same_profile(active)?;
            Ok(())
        })();
        Ok(match result {
            Ok(()) => json!({"outcome":if attempted {"applied"} else {"unchanged"},"mutationAttempted":attempted,"verifiedRecords":records.len()}),
            Err(error) => json!({"outcome":"uncertain","mutationAttempted":attempted,"error":error}),
        })
    }
    fn read_remaps(&mut self, request: Value) -> Result<Value, String> {
        crate::remap::validate_read(&request)?;
        let slot = request["wireIndex"].as_u64().unwrap() as u8;
        let active = self.profile_index()?;
        let mut records = Vec::new();
        for physical in request["physicalKeys"].as_array().unwrap() {
            let id = physical.as_u64().unwrap();
            let canonical = crate::remap::canonical(id)?;
            for (level, command) in [(0, 0x51), (1, 0x97)] {
                for layer in 0..2 {
                    let data = self.query(command, &[slot, canonical, layer])?;
                    if data.len() < 2
                        || data[1] != slot
                        || ![1, 2].contains(&data[0])
                        || data[0] == 2 && data.len() != 2
                    {
                        return Err(format!(
                            "Invalid remap response command {:02x} key {} layer {}: {}",
                            command,
                            canonical,
                            layer,
                            hex(&data)
                        ));
                    }
                    records.push(json!({"physicalKey":id,"canonicalKey":canonical,"level":level,"fnLayer":layer==1,"status":data[0],"data":hex(&data[2..])}));
                }
            }
        }
        self.same_profile(active)?;
        Ok(
            json!({"wireIndex":slot,"activeProfileIndex":active,"records":records,"runtimeEnableMapRefreshed":true}),
        )
    }
    pub fn execute(
        mut self,
        mode: &str,
        change: Option<crate::mutation::FieldChange>,
        edit: Option<Value>,
    ) -> Result<Value, String> {
        let version = self.query(1, &[])?;
        if !(4..=61).contains(&version.len()) {
            return Err("Invalid keyboard firmware response".into());
        }
        self.firmware = format!("{}.{}.{}", version[0], version[1], version[2]);
        if mode != "--version" && (self.firmware != "2.2.14" || version[3] != 0) {
            return Err(format!(
                "Keyboard decoding verified only for 2.2.14; found {}",
                self.firmware
            ));
        }
        let mut value = match mode {
            "--connection" => {
                let active = self.profile_index()?;
                let keys = self.byte(0x40, &[0])?;
                let ring = self.byte(0x40, &[1])?;
                let game = self.field(0x56, active)?;
                let fn_lock = self.field(0x58, active)?;
                if keys > 100 || ring > 100 || game > 1 || fn_lock > 1 {
                    return Err("Invalid live keyboard settings".into());
                }
                self.same_profile(active)?;
                json!({"activeProfileIndex":active,"brightnessChannels":[keys,ring],"gameModeEnabled":game==1,"fnLockEnabled":fn_lock==1})
            }
            "--version" => json!({"versionBytes":version,"devicePath":self.path}),
            "--state" => self.state()?,
            "--snap" => {
                let mut profiles = Vec::new();
                let active = self.profile_index()?;
                for slot in 0..4 {
                    let response = self.query(0x88, &[2, slot])?;
                    profiles.push(json!({"wireIndex":slot,"response":hex(&response)}));
                }
                if active == 4 {
                    let response = self.query(0x88, &[2, 255])?;
                    profiles.push(json!({"wireIndex":4,"response":hex(&response)}));
                }
                self.same_profile(active)?;
                json!({"activeProfileIndex":active,"profiles":profiles})
            }
            "--sensors" => self.sensors()?,
            "--current" => {
                let matrix = self.matrix(0xff)?;
                json!({"keys":matrix.iter().map(|(id,adc)|json!({"sensorId":id,"adc":adc})).collect::<Vec<_>>()})
            }
            "--lighting" => self.lighting()?,
            "--actuation" => self.actuation()?,
            "--apply-field" => {
                self.change_field(change.ok_or("Missing validated setting request")?)?
            }
            "--apply-actuation" => {
                self.apply_actuation(edit.ok_or("Missing validated actuation request")?)?
            }
            "--apply-lighting" => {
                self.apply_lighting(edit.ok_or("Missing validated lighting request")?)?
            }
            "--apply-runtime-lighting" => {
                self.apply_runtime_lighting(edit.ok_or("Missing live lighting request")?)?
            }
            "--apply-software-actuation" => {
                self.apply_software_actuation(edit.ok_or("Missing software actuation")?)?
            }
            "--apply-snap" => self.apply_snap(edit.ok_or("Missing snap edit")?)?,
            "--apply-remap" => self.apply_remap(edit.ok_or("Missing remap edit")?)?,
            "--apply-remaps" => self.apply_remaps(edit.ok_or("Missing remap transaction")?)?,
            "--remaps" => self.read_remaps(edit.ok_or("Missing remap read request")?)?,
            _ => return Err("Unsupported keyboard operation".into()),
        };
        let object = value.as_object_mut().ok_or("Invalid native response")?;
        let mutation = mode.starts_with("--apply-");
        let attempted = object
            .get("mutationAttempted")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        object.extend(json!({"status":"ok","firmware":self.firmware,"devicePath":self.path,"readOnly":!mutation,"settingsWritePerformed":attempted,
            "reportIoPerformed":true,"nativeLanguage":"Rust","transactions":self.journal,"elapsedMs":self.hid.elapsed()}).as_object().unwrap().clone());
        Ok(value)
    }
}

fn outgoing(command: u8, arguments: &[u8]) -> Result<Vec<[u8; 64]>, String> {
    if arguments.len() > 4088 {
        return Err("Keyboard output payload exceeds protocol limit".into());
    }
    let mut payload = vec![command];
    payload.extend(arguments);
    let count = payload.len().div_ceil(61);
    Ok(payload
        .chunks(61)
        .enumerate()
        .map(|(index, data)| {
            let mut frame = [0u8; 64];
            frame[0] = 0x43;
            frame[1] = data.len() as u8 | if index == 0 { 0x80 } else { 0 };
            frame[2] = (count - index - 1) as u8;
            frame[3..3 + data.len()].copy_from_slice(data);
            frame
        })
        .collect())
}

/// Stateful decoder shared by real HID transactions and offline protocol tests.
struct Frames {
    bytes: Vec<u8>,
    countdown: Option<u8>,
    acknowledgements: usize,
    maximum: usize,
}
impl Frames {
    fn new(maximum: usize) -> Self {
        Self {
            bytes: Vec::new(),
            countdown: None,
            acknowledgements: 0,
            maximum,
        }
    }
    fn push(&mut self, frame: &[u8; 64]) -> Result<bool, String> {
        if frame[0] != 0x43 {
            return Err("Unexpected keyboard report ID".into());
        }
        if frame[1] & 0x40 != 0 {
            self.acknowledgements += 1;
            if self.acknowledgements > 8 {
                return Err("Excess keyboard acknowledgements".into());
            }
            return Ok(false);
        }
        let count = (frame[1] & 0x3f) as usize;
        if !(1..=61).contains(&count) {
            return Err("Invalid keyboard response length".into());
        }
        match self.countdown {
            None if frame[1] & 0x80 == 0 => {
                return Err("Missing keyboard first-frame marker".into())
            }
            Some(previous) if frame[1] & 0x80 != 0 || previous == 0 || frame[2] != previous - 1 => {
                return Err("Keyboard response countdown changed".into())
            }
            _ => (),
        }
        if self.bytes.len() + count > self.maximum {
            return Err("Keyboard response exceeds payload limit".into());
        }
        self.countdown = Some(frame[2]);
        self.bytes.extend_from_slice(&frame[3..3 + count]);
        Ok(frame[2] == 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn multi_report_output_keeps_every_byte_and_countdown() {
        let data = vec![0x24; 443];
        let frames = outgoing(0x75, &data).unwrap();
        assert_eq!(frames.len(), 8);
        let mut decoder = Frames::new(4090);
        for (index, frame) in frames.iter().enumerate() {
            assert_eq!(frame[2] as usize, frames.len() - index - 1);
            decoder.push(frame).unwrap();
        }
        let mut expected = vec![0x75];
        expected.extend(data);
        assert_eq!(decoder.bytes, expected);
        assert!(outgoing(0x75, &vec![0; 4089]).is_err());
    }
    #[test]
    fn captured_replies_decode_exactly() {
        for file in [
            "sensor-read.json",
            "state-read.json",
            "lighting-read.json",
            "actuation-read.json",
        ] {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../resources/keyboard/protocol")
                .join(file);
            let capture: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
            for transaction in capture["transactions"].as_array().unwrap() {
                let mut decoder = Frames::new(4097);
                let mut finished = false;
                for encoded in transaction["frames"].as_array().unwrap() {
                    let encoded = encoded.as_str().unwrap();
                    let mut frame = [0u8; 64];
                    for i in 0..64 {
                        frame[i] = u8::from_str_radix(&encoded[2 * i..2 * i + 2], 16).unwrap();
                    }
                    finished = decoder.push(&frame).unwrap();
                }
                assert!(finished);
                assert_eq!(
                    decoder.bytes.len() as u64,
                    transaction["payloadLength"].as_u64().unwrap()
                );
                if let Some(expected) = transaction["response"].as_str() {
                    assert_eq!(hex(&decoder.bytes), expected);
                }
            }
        }
    }
    #[test]
    fn malformed_frames_are_rejected() {
        for (id, flags) in [(0, 0x81), (0x43, 0x80), (0x43, 0xbe), (0x43, 1)] {
            let mut frame = [0u8; 64];
            frame[0] = id;
            frame[1] = flags;
            assert!(Frames::new(1024).push(&frame).is_err());
        }
        let mut frame = [0u8; 64];
        frame[0] = 0x43;
        frame[1] = 0x81;
        frame[2] = 2;
        let mut decoder = Frames::new(1024);
        assert!(!decoder.push(&frame).unwrap());
        frame[1] = 1;
        frame[2] = 0;
        assert!(decoder.push(&frame).is_err());
        frame[1] = 0x81;
        assert!(Frames::new(0).push(&frame).is_err());
    }
}
