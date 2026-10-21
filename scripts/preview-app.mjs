import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Browser markup uses the real renderer and an in-memory copy of local profiles.
// Native operations stay unavailable; this server never opens the USB backend.
const app = path.resolve('dist/app');
const profile = path.resolve('../NZXT-HE-Keyboard-Data/profile/profiles.json');
const saved = fs.existsSync(profile) ? JSON.parse(fs.readFileSync(profile, 'utf8')) : {};
const analogueFile = path.resolve('../NZXT-HE-Keyboard-Data/profile/analogue-profiles.json');
const html = fs.readFileSync(path.join(app, 'index.html'), 'utf8')
  .replace('img-src file:', "img-src 'self' file:")
  .replace('font-src file:', "font-src 'self' file:")
  .replace('<script src="./renderer.js">', '<script src="./preview-host.js"></script><script src="./renderer.js">');
const bootstrap = `
let profiles = ${JSON.stringify(saved)};
const unavailable = async () => { throw Error('Keyboard operations are unavailable in browser preview'); };
const noop = () => {};
const defaultOverride = {enabled:false,mode:'toggle',shortcut:[226,225,30],scope:'all',keys:[]};
const defaultFeedback = {enabled:false,activeColor:'#a87dff',suppressedColor:'#57cdb6',overrideColor:'#ffbb55',brightness:.7,fadeMs:80};
const analogueSettings = (saved={}) => ({schemaVersion:2,normalizeSticks:true,bindings:{},...saved,override:{...defaultOverride,...saved.override},feedback:{...defaultFeedback,...saved.feedback}});
let analogue = {profileId:'', settings:analogueSettings(), axes:{lx:0,ly:0,rx:0,ry:0,lt:0,rt:0}, buttons:{}, keyLevels:{}, rawMm:{}, buttonMask:0, running:false, connected:false, error:'', rateHz:0, sampleAgeMs:null, recoveryPending:false, preview:true,overriddenKeys:[],overrideRequested:false,transitioning:false,calibration:null,feedbackError:''};
const analogueProfiles = ${JSON.stringify(saved.analogueProfiles ?? (fs.existsSync(analogueFile) ? JSON.parse(fs.readFileSync(analogueFile, 'utf8')).profiles : {}))};
let library = ${JSON.stringify(saved.profileLibrary ?? {automatic:false,pinned:false,defaultProfileId:'hardware-0',associations:{},names:{}})};
window.keyboardHost = {
  analogueState: async () => analogue,
  analogueProfile: async (id) => { analogue = {...analogue, profileId:id, settings:analogueSettings(analogueProfiles[id])}; return analogue; },
  analogueSave: async (settings,id=analogue.profileId) => { analogueProfiles[id] = settings; if(id===analogue.profileId)analogue = {...analogue,settings}; return analogue; },
  copyAnalogueProfile: async (source,target) => {analogueProfiles[target]=structuredClone(analogueSettings(analogueProfiles[source]));},
  removeAnalogueProfile: async id=>{delete analogueProfiles[id];},
  profileLibrary: async()=>library,
  saveProfileLibrary: async value=>{library=value;return library;},
  applications: async()=>({foreground:null,running:[]}),
  onApplications: ()=>noop,
  browseApplication: unavailable,
  importProfileDocument: async value=>{profiles=value;return true;},
  prepareSoftwareProfile: async()=>{},
  analogueEnable: unavailable,
  analogueShortcutCapture: async () => {},
  analogueCalibrate: unavailable,
  analogueImport: unavailable,
  analogueExport: unavailable,
  lifecycleStatus: async () => ({phase:'ready', pendingTransactions:0, recovery:{status:'complete',reason:null,error:null}}),
  onLifecycleEvent: () => noop,
  read: async () => profiles,
  write: async (value) => { profiles = value; return true; },
  checkpoint: async () => null,
  devices: async () => ({interfaces:[]}),
  connection: unavailable,
  allProfileConfigs: unavailable,
  recoverBackup: unavailable,
  applySoftwareProfile: unavailable,
  releaseSoftwareProfile: unavailable,
  restoreProfile: unavailable,
  applyProfile: unavailable,
  exportProfiles: unavailable,
  importProfiles: unavailable,
  snap: unavailable,
  applySnap: unavailable,
  restoreSnap: unavailable,
  startMacroRecording: unavailable,
  stopMacroRecording: async () => false,
  onMacroEvent: () => noop,
  remaps: unavailable,
  applyRemap: unavailable,
  restoreRemap: unavailable,
  applyActuation: unavailable,
  restoreActuation: unavailable,
  applyLighting: unavailable,
  restoreLighting: unavailable,
  applyField: unavailable,
  restoreField: unavailable,
  monitorPreview: unavailable,
  firmware: unavailable,
  sensors: unavailable,
  state: unavailable,
  actuation: unavailable,
  report: noop,
  diagnostic: noop,
  testReport: noop,
};
`;
const assets = new Map([
  ['/renderer.js', ['renderer.js', 'text/javascript']],
  ['/application.css', ['application.css', 'text/css']],
  ['/sensor-monitor.css', ['sensor-monitor.css', 'text/css']],
]);
http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  response.setHeader('Cache-Control', 'no-store');
  if (pathname === '/' || pathname === '/index.html') {
    response.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}).end(html);
  } else if (pathname === '/preview-host.js') {
    response.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'}).end(bootstrap);
  } else if (assets.has(pathname)) {
    const [file, type] = assets.get(pathname);
    response.writeHead(200, {'Content-Type':type});
    fs.createReadStream(path.join(app, file)).pipe(response);
  } else {
    response.writeHead(404).end();
  }
}).listen(4173, '127.0.0.1', () => console.log('Browser preview: http://127.0.0.1:4173'));
