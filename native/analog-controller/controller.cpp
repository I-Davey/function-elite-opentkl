#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <atomic>
#include <chrono>
#include <cmath>
#include <mutex>
#include <set>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

// ViGEmClient ABI (MIT, Nefarius Software Solutions); licence accompanies the DLL.
struct XUSBReport { USHORT buttons; BYTE leftTrigger,rightTrigger; SHORT lx,ly,rx,ry; };
static_assert(sizeof(XUSBReport)==12,"XUSB report ABI changed");
using Client=void*; using Target=void*;
static HMODULE library=nullptr;
static Client (*allocate)();
static void (*freeClient)(Client);
static ULONG (*connectClient)(Client);
static void (*disconnectClient)(Client);
static Target (*allocateTarget)();
static void (*freeTarget)(Target);
static ULONG (*addTarget)(Client,Target);
static ULONG (*removeTarget)(Client,Target);
static ULONG (*sendReport)(Client,Target,XUSBReport);
static Client client=nullptr;
static Target target=nullptr;
static constexpr ULONG Success=0x20000000;
static std::mutex gate;
static std::atomic<bool> running{false};
static std::thread watchdog;
static XUSBReport report{};
static bool outputEnabled=false,stale=false;
static ULONG lastResult=Success;
static unsigned long long updates=0;
static auto lastInput=std::chrono::steady_clock::now();
static std::string fault;
static std::set<WORD> keyboardHeld;
static auto lastKeyboardInput=std::chrono::steady_clock::now();

// Retain ownership until Windows accepts a release, so the watchdog can retry it.
static bool keyboardLocked(const std::set<WORD>& wanted) {
    for(auto it=keyboardHeld.begin();it!=keyboardHeld.end();) {
        if(wanted.count(*it)){++it;continue;}
        INPUT input{};input.type=INPUT_KEYBOARD;input.ki.wScan=*it&0xff;
        input.ki.dwFlags=KEYEVENTF_SCANCODE|KEYEVENTF_KEYUP|((*it&0xff00)?KEYEVENTF_EXTENDEDKEY:0);
        if(SendInput(1,&input,sizeof(INPUT))!=1)return false;
        it=keyboardHeld.erase(it);
    }
    for(WORD key:wanted) {
        if(keyboardHeld.count(key))continue;
        INPUT input{};input.type=INPUT_KEYBOARD;input.ki.wScan=key&0xff;
        input.ki.dwFlags=KEYEVENTF_SCANCODE|((key&0xff00)?KEYEVENTF_EXTENDEDKEY:0);
        if(SendInput(1,&input,sizeof(INPUT))!=1)return false;
        keyboardHeld.insert(key);
    }
    return true;
}

static void neutralLocked() {
    report={};
    if(client && target) lastResult=sendReport(client,target,report);
}
static void detachLocked() {
    neutralLocked();
    if(target) { removeTarget(client,target); freeTarget(target); target=nullptr; }
    if(client) { disconnectClient(client); freeClient(client); client=nullptr; }
    outputEnabled=false;
}
static std::string code(ULONG value) { std::ostringstream s;s<<"0x"<<std::hex<<value;return s.str(); }
static std::string quote(const std::string& value) {
    std::string out="\"";
    for(char c:value) { if(c=='"'||c=='\\')out+='\\';if(c=='\n')out+="\\n";else out+=c; }
    return out+'"';
}

using napi_env=void*; using napi_value=void*; using napi_callback_info=void*;
using Callback=napi_value (*)(napi_env,napi_callback_info);
static int (*createString)(napi_env,const char*,size_t,napi_value*);
static int (*createFunction)(napi_env,const char*,size_t,Callback,void*,napi_value*);
static int (*setProperty)(napi_env,napi_value,const char*,napi_value);
static int (*getInfo)(napi_env,napi_callback_info,size_t*,napi_value*,napi_value*,void**);
static int (*getString)(napi_env,napi_value,char*,size_t,size_t*);
static int (*getBool)(napi_env,napi_value,bool*);
static int (*cleanupHook)(napi_env,void (*)(void*),void*);
static napi_value text(napi_env env,const std::string& s) { napi_value v=nullptr;createString(env,s.c_str(),s.size(),&v);return v; }
static std::string argument(napi_env env,napi_callback_info info) {
    size_t count=1,length=0; napi_value value=nullptr;getInfo(env,info,&count,&value,nullptr,nullptr);
    if(!count || getString(env,value,nullptr,0,&length) || length>32768)return "";
    std::vector<char> b(length+1);getString(env,value,b.data(),b.size(),&length);return std::string(b.data(),length);
}
static napi_value initialize(napi_env env,napi_callback_info info) {
    std::lock_guard<std::mutex> lock(gate);
    if(library)return text(env,"ready");
    std::string path=argument(env,info);
    int length=MultiByteToWideChar(CP_UTF8,0,path.c_str(),-1,nullptr,0);
    if(length<=1)return text(env,"Missing controller library path");
    std::vector<wchar_t> wide(length);MultiByteToWideChar(CP_UTF8,0,path.c_str(),-1,wide.data(),length);
    library=LoadLibraryExW(wide.data(),nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_SYSTEM32);
    if(!library)return text(env,"Controller library could not load: "+std::to_string(GetLastError()));
#define PROC(variable,name) variable=reinterpret_cast<decltype(variable)>(GetProcAddress(library,name));if(!variable){FreeLibrary(library);library=nullptr;return text(env,"Controller ABI missing " name);}
    PROC(allocate,"vigem_alloc") PROC(freeClient,"vigem_free") PROC(connectClient,"vigem_connect")
    PROC(disconnectClient,"vigem_disconnect") PROC(allocateTarget,"vigem_target_x360_alloc")
    PROC(freeTarget,"vigem_target_free") PROC(addTarget,"vigem_target_add")
    PROC(removeTarget,"vigem_target_remove") PROC(sendReport,"vigem_target_x360_update")
#undef PROC
    return text(env,"ready");
}
static napi_value updateKeys(napi_env env,napi_callback_info info) {
    const auto report=argument(env,info);
    std::set<WORD> wanted;
    if(!report.empty()) {
        std::istringstream input(report);unsigned int value=0;char comma=0;
        while(input>>value) {
            if(!value || value>0xe07f || !(value&0x7f) || (value&0xff)>0x7f || ((value&0xff00)!=0 && (value&0xff00)!=0xe000))return text(env,"Invalid keyboard scan code");
            wanted.insert(static_cast<WORD>(value));
            if(wanted.size()>88)return text(env,"Too many extra keys");
            input>>std::ws;if(input.eof())break;
            if(!(input>>comma)||comma!=','||input.peek()==EOF)return text(env,"Invalid keyboard report");
        }
        if(!input.eof())return text(env,"Invalid keyboard report");
    }
    std::lock_guard<std::mutex> lock(gate);
    if(!keyboardLocked(wanted)) {
        keyboardLocked({});
        return text(env,"Windows blocked extra key output; check the game's administrator permissions");
    }
    lastKeyboardInput=std::chrono::steady_clock::now();return text(env,"updated");
}
static napi_value enable(napi_env env,napi_callback_info info) {
    size_t count=1;napi_value v=nullptr;bool wanted=false;getInfo(env,info,&count,&v,nullptr,nullptr);if(count)getBool(env,v,&wanted);
    std::lock_guard<std::mutex> lock(gate);
    if(!wanted){detachLocked();fault.clear();return text(env,"disabled");}
    if(outputEnabled)return text(env,"enabled");
    if(!library)return text(env,"Controller library is not initialized");
    client=allocate();
    if(!client)return text(env,"Cannot allocate controller client");
    lastResult=connectClient(client);
    if(lastResult!=Success){freeClient(client);client=nullptr;fault="Cannot connect to ViGEmBus: "+code(lastResult);return text(env,fault);}
    target=allocateTarget();
    if(!target){detachLocked();fault="Cannot allocate controller";return text(env,fault);}
    lastResult=addTarget(client,target);
    if(lastResult!=Success){freeTarget(target);target=nullptr;disconnectClient(client);freeClient(client);client=nullptr;fault="Cannot create controller: "+code(lastResult);return text(env,fault);}
    outputEnabled=true;stale=false;fault.clear();lastInput=std::chrono::steady_clock::now();neutralLocked();
    return text(env,"enabled");
}
static napi_value update(napi_env env,napi_callback_info info) {
    std::istringstream input(argument(env,info));std::vector<double> values;double v=0;char comma=0;
    while(input>>v){values.push_back(v);input>>std::ws;if(input.eof())break;if(!(input>>comma)||comma!=','||input.peek()==EOF)return text(env,"Invalid controller axes");}
    if(!input.eof()||(values.size()!=2&&values.size()!=6&&values.size()!=7))return text(env,"Invalid controller report count");
    values.resize(7,0);
    for(size_t i=0;i<6;i++)if(!std::isfinite(values[i])||values[i]>1||values[i]<(i<4?-1.0:0.0))return text(env,"Controller axis outside range");
    constexpr unsigned int allowedButtons=0xF3FF;
    if(!std::isfinite(values[6])||values[6]<0||values[6]>65535||std::floor(values[6])!=values[6])return text(env,"Invalid controller buttons");
    const auto buttons=static_cast<unsigned int>(values[6]);
    if(buttons&~allowedButtons)return text(env,"Unsupported controller buttons");
    auto axis=[](double v){return static_cast<SHORT>(std::lround(v*(v<0?32768:32767)));};
    std::lock_guard<std::mutex> lock(gate);
    if(!outputEnabled)return text(env,"disabled");
    report={};report.buttons=static_cast<USHORT>(buttons);report.lx=axis(values[0]);report.ly=axis(values[1]);report.rx=axis(values[2]);report.ry=axis(values[3]);
    report.leftTrigger=static_cast<BYTE>(std::lround(values[4]*255));report.rightTrigger=static_cast<BYTE>(std::lround(values[5]*255));
    lastResult=sendReport(client,target,report);
    if(lastResult!=Success){fault="Controller update failed: "+code(lastResult);detachLocked();return text(env,fault);}
    lastInput=std::chrono::steady_clock::now();stale=false;++updates;return text(env,"updated");
}
static napi_value status(napi_env env,napi_callback_info) {
    std::lock_guard<std::mutex> lock(gate);std::ostringstream s;
    s<<"{\"enabled\":"<<(outputEnabled?"true":"false")<<",\"connected\":"<<(target?"true":"false")
     <<",\"stale\":"<<(stale?"true":"false")<<",\"updates\":"<<updates<<",\"leftX\":"<<report.lx
     <<",\"leftY\":"<<report.ly<<",\"rightX\":"<<report.rx<<",\"rightY\":"<<report.ry
     <<",\"leftTrigger\":"<<static_cast<int>(report.leftTrigger)<<",\"rightTrigger\":"<<static_cast<int>(report.rightTrigger)
     <<",\"buttonMask\":"<<report.buttons<<",\"error\":"<<quote(fault)<<'}';return text(env,s.str());
}
static void cleanup(void*) {
    running=false;if(watchdog.joinable())watchdog.join();
    std::lock_guard<std::mutex> lock(gate);keyboardLocked({});detachLocked();if(library){FreeLibrary(library);library=nullptr;}
}
extern "C" __declspec(dllexport) int node_api_module_get_api_version_v1(){return 8;}
extern "C" __declspec(dllexport) napi_value napi_register_module_v1(napi_env env,napi_value exports){
    HMODULE host=GetModuleHandleW(nullptr);
#define RESOLVE(variable,name) variable=reinterpret_cast<decltype(variable)>(GetProcAddress(host,name));if(!variable)return exports;
    RESOLVE(createString,"napi_create_string_utf8") RESOLVE(createFunction,"napi_create_function")
    RESOLVE(setProperty,"napi_set_named_property") RESOLVE(getInfo,"napi_get_cb_info")
    RESOLVE(getString,"napi_get_value_string_utf8") RESOLVE(getBool,"napi_get_value_bool") RESOLVE(cleanupHook,"napi_add_env_cleanup_hook")
#undef RESOLVE
    struct Method{const char* name;Callback callback;}methods[]={{"initialize",initialize},{"setEnabled",enable},{"update",update},{"updateKeys",updateKeys},{"status",status}};
    for(auto m:methods){napi_value f=nullptr;createFunction(env,m.name,SIZE_MAX,m.callback,nullptr,&f);setProperty(env,exports,m.name,f);}
    cleanupHook(env,cleanup,nullptr);
    running=true;
    watchdog=std::thread([]{
        while(running) {
            std::this_thread::sleep_for(std::chrono::milliseconds(25));
            std::lock_guard<std::mutex> lock(gate);
            const auto now=std::chrono::steady_clock::now();
            if(outputEnabled && !stale && now-lastInput>std::chrono::milliseconds(250)) { neutralLocked();stale=true; }
            if(!keyboardHeld.empty() && now-lastKeyboardInput>std::chrono::milliseconds(250))keyboardLocked({});
        }
    });
    return exports;
}
