import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.platform!=='win32')throw Error('Build the Windows installer on Windows.');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const candidate=JSON.parse(fs.readFileSync(path.join(root,'dist/package-report.json'),'utf8'));
const dependencies=JSON.parse(fs.readFileSync(path.join(root,'resources/installer/dependencies.json'),'utf8'));
const cache=path.join(root,'.build/installer-tools'),output=path.join(root,'dist/installers');
const environment={...process.env};delete environment.PSModulePath;
fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(output,{recursive:true});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const entry of candidate.files){
  const file=path.resolve(candidate.output,entry.file);
  if(!file.startsWith(path.resolve(candidate.output)+path.sep)||hash(file)!==entry.sha256)throw Error('Packaged file changed: '+entry.file);
}
const packaged=JSON.parse(fs.readFileSync(path.join(candidate.output,'runtime/resources/app/package.json'),'utf8'));
if(packaged.version!==manifest.version)throw Error('Package version changed; rebuild the portable package.');
async function download(dependency){
  const file=path.join(cache,dependency.file);
  if(!fs.existsSync(file)){
    const response=await fetch(dependency.url,{signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw Error('Download failed: '+response.status+' '+dependency.file);
    const temporary=file+'.partial';
    fs.writeFileSync(temporary,Buffer.from(await response.arrayBuffer()));
    if(hash(temporary)!==dependency.sha256)throw Error('Download checksum mismatch: '+dependency.file);
    fs.renameSync(temporary,file);
  }
  if(hash(file)!==dependency.sha256)throw Error('Cached dependency checksum mismatch: '+dependency.file);
  return file;
}
function run(file,args){
  const result=spawnSync(file,args,{cwd:root,stdio:'inherit',windowsHide:true,env:environment});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(path.basename(file)+' failed: '+result.status);
}
const driver=await download(dependencies.driver);
const compilerRoot=path.join(cache,'inno-'+dependencies.compiler.version);
let compiler=[path.join(compilerRoot,'ISCC.exe'),path.join(compilerRoot,'bin/ISCC.exe')].find(fs.existsSync);
if(!compiler){
  const installer=await download(dependencies.compiler);
  run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/install-compiler.ps1'),'-Installer',installer,'-Destination',compilerRoot]);
  compiler=[path.join(compilerRoot,'ISCC.exe'),path.join(compilerRoot,'bin/ISCC.exe')].find(fs.existsSync);
}
if(!compiler)throw Error('Installer compiler was not installed.');
const stem='Function-Elite-OpenTKL-'+manifest.version+'-windows-x64';
run(compiler,['/Q',`/DAppVersion=${manifest.version}`,`/DPackageRoot=${candidate.output}`,`/DDriverInstaller=${driver}`,`/DOutputRoot=${output}`,`/DOutputName=${stem}-Setup`,path.join(root,'installer/opentkl.iss')]);
const portable=path.join(output,stem+'-Portable.zip');
if(fs.existsSync(portable))fs.unlinkSync(portable);
const archived=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Compress-Archive -LiteralPath $env:OPENTKL_PACKAGE -DestinationPath $env:OPENTKL_ZIP -CompressionLevel Optimal'],{
  cwd:root,stdio:'inherit',windowsHide:true,env:{...environment,OPENTKL_PACKAGE:candidate.output,OPENTKL_ZIP:portable},
});
if(archived.error)throw archived.error;if(archived.status!==0)throw Error('Portable ZIP creation failed.');
const files=[path.join(output,stem+'-Setup.exe'),portable];
const checksums=files.map(file=>hash(file)+'  '+path.basename(file)).join('\n')+'\n';
fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),checksums);
const report={status:'built',version:manifest.version,signed:false,driver:{version:dependencies.driver.version,sha256:dependencies.driver.sha256},files:files.map(file=>({file,sha256:hash(file),bytes:fs.statSync(file).size})),installedOrDriverExecuted:false};
fs.writeFileSync(path.join(root,'reports/installer-build.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
