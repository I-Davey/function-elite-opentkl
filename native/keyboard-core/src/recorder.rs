//! Explicit, temporary Windows keyboard recording for the original macro editor.
//! No input injection, HID settings writes or background recording at startup.
use serde_json::json;
use std::ffi::c_void;
use std::io::{BufRead, Write};
use std::sync::{mpsc, OnceLock};

type Handle = *mut c_void;
#[repr(C)]
struct KeyEvent {
    vk: u32,
    scan: u32,
    flags: u32,
    time: u32,
    extra: usize,
}
#[repr(C)]
struct Message {
    hwnd: Handle,
    message: u32,
    wparam: usize,
    lparam: isize,
    time: u32,
    point: [i32; 2],
    private: u32,
}
#[link(name = "user32")]
unsafe extern "system" {
    fn SetWindowsHookExW(
        id: i32,
        callback: unsafe extern "system" fn(i32, usize, isize) -> isize,
        module: Handle,
        thread: u32,
    ) -> Handle;
    fn UnhookWindowsHookEx(hook: Handle) -> i32;
    fn CallNextHookEx(hook: Handle, code: i32, wparam: usize, lparam: isize) -> isize;
    fn PeekMessageW(message: *mut Message, hwnd: Handle, min: u32, max: u32, remove: u32) -> i32;
    fn GetMessageW(message: *mut Message, hwnd: Handle, min: u32, max: u32) -> i32;
    fn PostThreadMessageW(thread: u32, message: u32, wparam: usize, lparam: isize) -> i32;
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetCurrentThreadId() -> u32;
    fn GetModuleHandleW(name: *const u16) -> Handle;
}
static EVENTS: OnceLock<mpsc::Sender<serde_json::Value>> = OnceLock::new();

/// Scan codes preserve physical key identity across Windows keyboard layouts.
pub(crate) fn hid(scan: u32, extended: bool) -> Option<u16> {
    if extended {
        return Some(match scan {
            0x1c => 88,
            0x1d => 228,
            0x35 => 84,
            0x38 => 230,
            0x47 => 74,
            0x48 => 82,
            0x49 => 75,
            0x4b => 80,
            0x4d => 79,
            0x4f => 77,
            0x50 => 81,
            0x51 => 78,
            0x52 => 73,
            0x53 => 76,
            0x5b => 227,
            0x5c => 231,
            0x5d => 101,
            _ => return None,
        });
    }
    let table: [u16; 89] = [
        0, 41, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 45, 46, 42, 43, 20, 26, 8, 21, 23, 28, 24,
        12, 18, 19, 47, 48, 40, 224, 4, 22, 7, 9, 10, 11, 13, 14, 15, 51, 52, 53, 225, 49, 29, 27,
        6, 25, 5, 17, 16, 54, 55, 56, 229, 85, 226, 44, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67,
        83, 71, 95, 96, 97, 86, 92, 93, 94, 87, 89, 90, 91, 98, 99, 70, 0, 100, 68, 69,
    ];
    table.get(scan as usize).copied().filter(|id| *id != 0)
}
/// Windows reserves special virtual keys for Pause, PrintScreen and F13–F24.
pub(crate) fn hid_event(vk: u32, scan: u32, extended: bool) -> Option<u16> {
    match vk {
        0x13 => Some(72),
        0x2c => Some(70),
        0x7c..=0x87 => Some((vk - 0x7c + 104) as u16),
        _ => hid(scan, extended),
    }
}
unsafe extern "system" fn callback(code: i32, wparam: usize, lparam: isize) -> isize {
    if code >= 0 && [0x100, 0x101, 0x104, 0x105].contains(&wparam) {
        let event = unsafe { &*(lparam as *const KeyEvent) };
        if event.flags & 0x10 == 0 {
            if let Some(key) = hid_event(event.vk, event.scan, event.flags & 1 != 0) {
                if let Some(sender) = EVENTS.get() {
                    let _=sender.send(json!({"hidKey":key,"state":if event.flags&0x80==0{"Pressed"}else{"Released"},"timestamp":event.time as f64/1000.0}));
                }
            }
        }
    }
    unsafe { CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam) }
}
pub fn run() -> Result<(), String> {
    let (sender, receiver) = mpsc::channel();
    EVENTS
        .set(sender)
        .map_err(|_| "Recorder already initialized")?;
    let thread = unsafe { GetCurrentThreadId() };
    let mut initial: Message = unsafe { std::mem::zeroed() };
    unsafe { PeekMessageW(&mut initial, std::ptr::null_mut(), 0, 0, 0) };
    let hook = unsafe { SetWindowsHookExW(13, callback, GetModuleHandleW(std::ptr::null()), 0) };
    if hook.is_null() {
        return Err("Windows could not start macro recording".into());
    }
    // Initialize the message queue before announcing readiness or accepting stop.
    let writer = std::thread::spawn(move || {
        for value in receiver {
            println!("{}", value);
            let _ = std::io::stdout().flush();
        }
    });
    println!("{}", json!({"status":"recording","nativeLanguage":"Rust"}));
    let _ = std::io::stdout().flush();
    std::thread::spawn(move || {
        for line in std::io::stdin().lock().lines() {
            if line.as_ref().is_ok_and(|value| value == "quit") {
                break;
            }
        }
        unsafe {
            PostThreadMessageW(thread, 0x12, 0, 0);
        }
    });
    let mut message: Message = unsafe { std::mem::zeroed() };
    while unsafe { GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) } > 0 {}
    unsafe { UnhookWindowsHookEx(hook) };
    // Process exit closes the sender. Never keep the hook alive after EOF/stop.
    drop(writer);
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scan_codes_preserve_modifiers() {
        assert_eq!(hid(0x11, false), Some(26));
        assert_eq!(hid(0x1d, false), Some(224));
        assert_eq!(hid(0x1d, true), Some(228));
        assert_eq!(hid(0x57, false), Some(68));
        assert_eq!(hid(0x58, false), Some(69));
        assert_eq!(hid(0x45, false), Some(83));
        assert_eq!(hid(0x4f, false), Some(89));
        assert_eq!(hid_event(0x13, 0x45, false), Some(72));
    }
}
