//! Read-only Windows application discovery for profile associations.
use serde_json::{json, Value};
use std::{collections::{BTreeMap, HashMap}, ffi::c_void, mem::{size_of, zeroed}, ptr::null_mut};
type Handle = *mut c_void;
#[repr(C)]
struct ProcessEntry { size: u32, usage: u32, pid: u32, heap: usize, module: u32, threads: u32, parent: u32, priority: i32, flags: u32, exe: [u16;260] }
#[link(name="kernel32")]
extern "system" {
    fn CreateToolhelp32Snapshot(flags:u32,pid:u32)->Handle;
    fn Process32FirstW(snapshot:Handle,entry:*mut ProcessEntry)->i32;
    fn Process32NextW(snapshot:Handle,entry:*mut ProcessEntry)->i32;
    fn OpenProcess(access:u32,inherit:i32,pid:u32)->Handle;
    fn QueryFullProcessImageNameW(process:Handle,flags:u32,name:*mut u16,size:*mut u32)->i32;
    fn CloseHandle(handle:Handle)->i32;
}
#[link(name="user32")]
extern "system" {
    fn GetForegroundWindow()->Handle;
    fn GetWindowThreadProcessId(window:Handle,pid:*mut u32)->u32;
    fn GetWindowTextW(window:Handle,text:*mut u16,maximum:i32)->i32;
}
fn image(pid:u32)->Option<String> { unsafe {
    let handle=OpenProcess(0x1000,0,pid);
    if handle.is_null() { return None; }
    let mut buffer=vec![0u16;32768]; let mut count=buffer.len() as u32;
    let ok=QueryFullProcessImageNameW(handle,0,buffer.as_mut_ptr(),&mut count);
    CloseHandle(handle);
    (ok!=0).then(||String::from_utf16_lossy(&buffer[..count as usize]))
} }
fn app(pid:u32,path:String,title:String)->Value {
    let name=path.rsplit('\\').next().unwrap_or(&path).to_owned();
    json!({"pid":pid,"path":path,"name":name,"title":title})
}
fn foreground()->Value { unsafe {
    let window=GetForegroundWindow(); let mut pid=0;
    if window.is_null() { return Value::Null; }
    GetWindowThreadProcessId(window,&mut pid);
    let mut text=[0u16;1024]; let count=GetWindowTextW(window,text.as_mut_ptr(),text.len() as i32).max(0) as usize;
    image(pid).map(|path|app(pid,path,String::from_utf16_lossy(&text[..count]))).unwrap_or(Value::Null)
} }
fn running(cache:&mut HashMap<u32,String>)->Result<Vec<Value>,String> { unsafe {
    let snapshot=CreateToolhelp32Snapshot(2,0);
    if snapshot == -1isize as Handle { return Err("Cannot list running applications".into()); }
    let mut entry:ProcessEntry=zeroed(); entry.size=size_of::<ProcessEntry>() as u32;
    let mut ok=Process32FirstW(snapshot,&mut entry); let mut found=BTreeMap::new(); let mut current=HashMap::new();
    while ok!=0 {
        if let Some(path)=image(entry.pid) {
            found.entry(path.to_lowercase()).or_insert_with(||app(entry.pid,path.clone(),String::new()));
            current.insert(entry.pid,path);
        }
        ok=Process32NextW(snapshot,&mut entry);
    }
    CloseHandle(snapshot); *cache=current;
    Ok(found.into_values().collect())
} }
pub fn snapshot()->Result<Value,String> {
    Ok(json!({"foreground":foreground(),"running":running(&mut HashMap::new())?}))
}
pub fn watch()->Result<(),String> {
    use std::{io::Write,time::{Instant,Duration}};
    let mut cache=HashMap::new(); let mut apps=Vec::new(); let mut last=String::new(); let mut scanned=Instant::now()-Duration::from_secs(3);
    loop {
        if scanned.elapsed()>=Duration::from_secs(2) { apps=running(&mut cache)?; scanned=Instant::now(); }
        let value=json!({"foreground":foreground(),"running":apps}); let encoded=value.to_string();
        if encoded!=last { println!("{}",encoded); if std::io::stdout().flush().is_err() { break; } last=encoded; }
        std::thread::sleep(Duration::from_millis(150));
    }
    Ok(())
}
