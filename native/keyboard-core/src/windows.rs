//! Minimal Windows HID boundary reconstructed from the existing independently
//! verified reader. No driver installation, CAM handle borrowing or flash API.
use serde_json::{json, Value};
use std::{
    ffi::c_void,
    mem::{size_of, zeroed},
    ptr::{null, null_mut},
    time::{Duration, Instant},
};
type Handle = *mut c_void;
const INVALID: Handle = -1isize as Handle;
#[repr(C)]
struct Guid {
    a: u32,
    b: u16,
    c: u16,
    d: [u8; 8],
}
#[repr(C)]
struct Interface {
    size: u32,
    guid: Guid,
    flags: u32,
    reserved: usize,
}
#[repr(C)]
struct Attributes {
    size: u32,
    vendor: u16,
    product: u16,
    version: u16,
}
#[repr(C)]
struct Caps {
    usage: u16,
    page: u16,
    input: u16,
    output: u16,
    feature: u16,
    reserved: [u16; 17],
    counts: [u16; 10],
}
#[repr(C)]
struct Overlapped {
    internal: usize,
    internal_high: usize,
    offset: u32,
    offset_high: u32,
    event: Handle,
}
#[repr(C)]
struct ProcessEntry {
    size: u32,
    usage: u32,
    pid: u32,
    heap: usize,
    module: u32,
    threads: u32,
    parent: u32,
    priority: i32,
    flags: u32,
    exe: [u16; 260],
}

#[link(name = "hid")]
extern "system" {
    fn HidD_GetHidGuid(guid: *mut Guid);
    fn HidD_GetAttributes(handle: Handle, attributes: *mut Attributes) -> i32;
    fn HidD_GetPreparsedData(handle: Handle, data: *mut *mut c_void) -> i32;
    fn HidD_FreePreparsedData(data: *mut c_void) -> i32;
    fn HidP_GetCaps(data: *mut c_void, caps: *mut Caps) -> i32;
}
#[link(name = "setupapi")]
extern "system" {
    fn SetupDiGetClassDevsW(
        guid: *const Guid,
        enumerator: *const u16,
        parent: Handle,
        flags: u32,
    ) -> Handle;
    fn SetupDiEnumDeviceInterfaces(
        set: Handle,
        info: Handle,
        guid: *const Guid,
        index: u32,
        data: *mut Interface,
    ) -> i32;
    fn SetupDiGetDeviceInterfaceDetailW(
        set: Handle,
        data: *const Interface,
        detail: *mut c_void,
        size: u32,
        required: *mut u32,
        info: Handle,
    ) -> i32;
    fn SetupDiDestroyDeviceInfoList(set: Handle) -> i32;
}
#[link(name = "kernel32")]
extern "system" {
    fn CreateFileW(
        name: *const u16,
        access: u32,
        share: u32,
        security: Handle,
        creation: u32,
        flags: u32,
        template: Handle,
    ) -> Handle;
    fn CloseHandle(handle: Handle) -> i32;
    fn GetLastError() -> u32;
    fn CreateMutexW(security: Handle, owner: i32, name: *const u16) -> Handle;
    fn ReleaseMutex(handle: Handle) -> i32;
    fn WaitForSingleObject(handle: Handle, millis: u32) -> u32;
    fn CreateEventW(security: Handle, manual: i32, state: i32, name: *const u16) -> Handle;
    fn ReadFile(
        handle: Handle,
        data: *mut c_void,
        count: u32,
        read: *mut u32,
        overlap: *mut Overlapped,
    ) -> i32;
    fn WriteFile(
        handle: Handle,
        data: *const c_void,
        count: u32,
        written: *mut u32,
        overlap: *mut Overlapped,
    ) -> i32;
    fn GetOverlappedResult(
        handle: Handle,
        overlap: *mut Overlapped,
        transferred: *mut u32,
        wait: i32,
    ) -> i32;
    fn CancelIoEx(handle: Handle, overlap: *mut Overlapped) -> i32;
    fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> Handle;
    fn Process32FirstW(snapshot: Handle, entry: *mut ProcessEntry) -> i32;
    fn Process32NextW(snapshot: Handle, entry: *mut ProcessEntry) -> i32;
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
    fn QueryFullProcessImageNameW(
        process: Handle,
        flags: u32,
        name: *mut u16,
        size: *mut u32,
    ) -> i32;
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}
fn error(context: &str) -> String {
    unsafe { format!("{} (Windows {})", context, GetLastError()) }
}
struct Owned(Handle);
impl Owned {
    fn new(handle: Handle, context: &str) -> Result<Self, String> {
        if handle.is_null() || handle == INVALID {
            Err(error(context))
        } else {
            Ok(Self(handle))
        }
    }
}
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}
struct DeviceSet(Handle);
impl Drop for DeviceSet {
    fn drop(&mut self) {
        unsafe {
            SetupDiDestroyDeviceInfoList(self.0);
        }
    }
}
pub struct TransactionLock(Owned);
impl TransactionLock {
    pub fn acquire() -> Result<Self, String> {
        unsafe {
            let handle = Owned::new(
                CreateMutexW(
                    null_mut(),
                    0,
                    wide("Local\\NZXT.HE.Standalone.Vendor.1E71.212A").as_ptr(),
                ),
                "Create keyboard mutex",
            )?;
            match WaitForSingleObject(handle.0, 2500) {
                0 | 128 => Ok(Self(handle)),
                _ => Err("Keyboard interface is busy".into()),
            }
        }
    }
}
impl Drop for TransactionLock {
    fn drop(&mut self) {
        unsafe {
            ReleaseMutex(self.0 .0);
        }
    }
}

pub fn enumerate() -> Result<Vec<Value>, String> {
    unsafe {
        let mut guid: Guid = zeroed();
        HidD_GetHidGuid(&mut guid);
        let raw = SetupDiGetClassDevsW(&guid, null(), null_mut(), 0x12);
        if raw == INVALID {
            return Err(error("Enumerate HID interfaces"));
        }
        let set = DeviceSet(raw);
        let mut devices = Vec::new();
        for index in 0..4096 {
            let mut interface: Interface = zeroed();
            interface.size = size_of::<Interface>() as u32;
            if SetupDiEnumDeviceInterfaces(set.0, null_mut(), &guid, index, &mut interface) == 0 {
                if GetLastError() == 259 {
                    return Ok(devices);
                }
                return Err(error("Read HID interface"));
            }
            let mut required = 0;
            SetupDiGetDeviceInterfaceDetailW(
                set.0,
                &interface,
                null_mut(),
                0,
                &mut required,
                null_mut(),
            );
            if !(8..=65536).contains(&required) {
                return Err("Invalid HID detail length".into());
            }
            let mut detail = vec![0u8; required as usize];
            detail[..4].copy_from_slice(
                &(if size_of::<usize>() == 8 { 8u32 } else { 6u32 }).to_le_bytes(),
            );
            if SetupDiGetDeviceInterfaceDetailW(
                set.0,
                &interface,
                detail.as_mut_ptr().cast(),
                required,
                &mut required,
                null_mut(),
            ) == 0
            {
                return Err(error("Read HID path"));
            }
            let chars: Vec<u16> = detail[4..]
                .chunks_exact(2)
                .map(|p| u16::from_le_bytes([p[0], p[1]]))
                .take_while(|v| *v != 0)
                .collect();
            let path = String::from_utf16(&chars).map_err(|_| "Invalid HID path encoding")?;
            if !path.to_ascii_lowercase().contains("vid_1e71&pid_212a") {
                continue;
            }
            let handle = match Owned::new(
                CreateFileW(wide(&path).as_ptr(), 0, 3, null_mut(), 3, 0, null_mut()),
                "Open HID descriptors",
            ) {
                Ok(handle) => handle,
                Err(message) => {
                    devices.push(json!({"path":path,"error":message}));
                    continue;
                }
            };
            let mut attributes: Attributes = zeroed();
            attributes.size = size_of::<Attributes>() as u32;
            if HidD_GetAttributes(handle.0, &mut attributes) == 0 {
                return Err(error("Read HID attributes"));
            }
            let mut data = null_mut();
            if HidD_GetPreparsedData(handle.0, &mut data) == 0 {
                return Err(error("Read HID descriptors"));
            }
            let mut caps: Caps = zeroed();
            let status = HidP_GetCaps(data, &mut caps);
            HidD_FreePreparsedData(data);
            if status != 0x110000 {
                return Err(format!("HID capability status {:x}", status));
            }
            devices.push(json!({"path":path,"vendorId":attributes.vendor,"productId":attributes.product,"revision":attributes.version,
            "usagePage":caps.page,"usage":caps.usage,"inputReportLength":caps.input,"outputReportLength":caps.output,"featureReportLength":caps.feature,"queryOnly":true}));
        }
        Err("HID enumeration limit exceeded".into())
    }
}

/// Identify competing CAM owners rather than racing their vendor requests.
pub fn check_other_owners() -> Result<(), String> {
    unsafe {
        let snapshot = Owned::new(CreateToolhelp32Snapshot(2, 0), "Enumerate CAM owners")?;
        let mut entry: ProcessEntry = zeroed();
        entry.size = size_of::<ProcessEntry>() as u32;
        let mut found = Process32FirstW(snapshot.0, &mut entry);
        let project = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap();
        let allowed = [
            project.join("runtime/NZXT CAM.exe"),
            project
                .parent()
                .unwrap()
                .join("recovery-transformer/preview-runtime/NZXT CAM.exe"),
        ];
        while found != 0 {
            let count = entry.exe.iter().position(|c| *c == 0).unwrap_or(260);
            if String::from_utf16_lossy(&entry.exe[..count]).eq_ignore_ascii_case("NZXT CAM.exe") {
                let process = Owned::new(
                    OpenProcess(0x1000, 0, entry.pid),
                    "Identify running CAM owner",
                )?;
                let mut buffer = vec![0u16; 32768];
                let mut count = buffer.len() as u32;
                if QueryFullProcessImageNameW(process.0, 0, buffer.as_mut_ptr(), &mut count) == 0 {
                    return Err(error("Identify CAM executable"));
                }
                let name = String::from_utf16_lossy(&buffer[..count as usize]).replace('/', "\\");
                if !allowed.iter().any(|p| {
                    p.to_string_lossy()
                        .replace('/', "\\")
                        .eq_ignore_ascii_case(&name)
                }) {
                    return Err(format!(
                        "Close NZXT CAM before keyboard access (PID {})",
                        entry.pid
                    ));
                }
            }
            found = Process32NextW(snapshot.0, &mut entry);
        }
        Ok(())
    }
}

pub struct Hid {
    handle: Owned,
    started: Instant,
}
impl Hid {
    pub fn open(path: &str) -> Result<Self, String> {
        unsafe {
            let name = wide(path);
            let started = Instant::now();
            let handle = loop {
                let handle = CreateFileW(name.as_ptr(), 0xc0000000, 0, null_mut(), 3, 0x40000000, null_mut());
                if handle != INVALID || GetLastError() != 32 || started.elapsed() >= Duration::from_millis(40) {
                    break Owned::new(handle, "Acquire vendor HID interface")?;
                }
                // Retry only acquisition; no USB command has been sent or can be replayed.
                std::thread::sleep(Duration::from_millis(2));
            };
            Ok(Self {
                handle,
                started: Instant::now(),
            })
        }
    }
    pub fn elapsed(&self) -> u128 {
        self.started.elapsed().as_millis()
    }
    pub fn transfer(&self, report: &mut [u8; 64], writing: bool) -> Result<(), String> {
        unsafe {
            let remaining = Duration::from_secs(5)
                .checked_sub(self.started.elapsed())
                .ok_or("Keyboard session exceeded five seconds")?;
            let event = Owned::new(
                CreateEventW(null_mut(), 1, 0, null()),
                "Create HID transfer event",
            )?;
            let mut overlap = Box::new(Overlapped {
                internal: 0,
                internal_high: 0,
                offset: 0,
                offset_high: 0,
                event: event.0,
            });
            let mut buffer = Box::new(*report);
            let mut transferred = 0;
            let ok = if writing {
                WriteFile(
                    self.handle.0,
                    buffer.as_ptr().cast(),
                    64,
                    &mut transferred,
                    &mut *overlap,
                )
            } else {
                ReadFile(
                    self.handle.0,
                    buffer.as_mut_ptr().cast(),
                    64,
                    &mut transferred,
                    &mut *overlap,
                )
            };
            if ok == 0 {
                if GetLastError() != 997 {
                    return Err(error(if writing {
                        "Send HID report"
                    } else {
                        "Receive HID report"
                    }));
                }
                if WaitForSingleObject(event.0, remaining.as_millis().min(1200) as u32) != 0 {
                    CancelIoEx(self.handle.0, &mut *overlap);
                    if WaitForSingleObject(event.0, 1500) == 0 {
                        GetOverlappedResult(self.handle.0, &mut *overlap, &mut transferred, 0);
                    } else {
                        // Keep pinned storage alive if a broken driver fails to complete
                        // cancellation. This short-lived process exits on the error.
                        std::mem::forget(buffer);
                        std::mem::forget(overlap);
                        std::mem::forget(event);
                    }
                    return Err(format!(
                        "HID {} timed out; session cancelled",
                        if writing { "send" } else { "receive" }
                    ));
                }
                if GetOverlappedResult(self.handle.0, &mut *overlap, &mut transferred, 0) == 0 {
                    return Err(error("Complete HID transfer"));
                }
            }
            if transferred != 64 {
                return Err(format!(
                    "Expected 64-byte HID report, received {}",
                    transferred
                ));
            }
            if !writing {
                *report = *buffer;
            }
            Ok(())
        }
    }
}
