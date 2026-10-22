#ifndef AppVersion
  #error AppVersion must be supplied by the build script
#endif

[Setup]
AppId={{DC8D7389-4032-4CA8-AF72-30C98EA04088}
AppName=Function Elite OpenTKL
AppVersion={#AppVersion}
AppPublisher=Function Elite OpenTKL contributors
AppPublisherURL=https://github.com/I-Davey/function-elite-opentkl
AppSupportURL=https://github.com/I-Davey/function-elite-opentkl/issues
DefaultDirName={autopf}\Function Elite OpenTKL
DefaultGroupName=Function Elite OpenTKL
DisableProgramGroupPage=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.19041
OutputDir={#OutputRoot}
OutputBaseFilename={#OutputName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
LicenseFile={#PackageRoot}\LICENSE
SetupIconFile={#PackageRoot}\resources\icons\app.ico
UninstallDisplayIcon={app}\resources\icons\app.ico
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Tasks]
Name: controller; Description: "Enable analogue controls (install ViGEmBus controller driver)"; Check: NeedsControllerDriver
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked
Name: startup; Description: "Start with Windows"; Flags: unchecked

[Files]
Source: "{#PackageRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#DriverInstaller}"; DestName: "ViGEmBus-Setup.exe"; Flags: dontcopy

[Icons]
Name: "{group}\Function Elite OpenTKL"; Filename: "{app}\runtime\Function Elite OpenTKL.exe"; IconFilename: "{app}\resources\icons\opentkl-{#AppVersion}.ico"; AppUserModelID: "FunctionElite.OpenTKL"
Name: "{autodesktop}\Function Elite OpenTKL"; Filename: "{app}\runtime\Function Elite OpenTKL.exe"; IconFilename: "{app}\resources\icons\opentkl-{#AppVersion}.ico"; AppUserModelID: "FunctionElite.OpenTKL"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueName: "Function Elite OpenTKL"; Flags: dontcreatekey uninsdeletevalue
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "Function Elite OpenTKL"; ValueData: """{app}\runtime\Function Elite OpenTKL.exe"" --hidden"; Tasks: startup; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; ValueName: "Function Elite OpenTKL"; Tasks: startup; Flags: deletevalue

[Run]
Filename: "{app}\runtime\Function Elite OpenTKL.exe"; Description: "Open Function Elite OpenTKL"; Flags: nowait postinstall skipifsilent runasoriginaluser; Check: CanLaunch

[Code]
var
  DriverRestart: Boolean;

function NeedsControllerDriver: Boolean;
begin
  Result := not RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\ViGEmBus');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
begin
  Result := '';
  if WizardIsTaskSelected('controller') and NeedsControllerDriver then
  begin
    if not IsAdminInstallMode then
    begin
      Result := 'The analogue controller driver requires administrator access. Run Setup as administrator or untick analogue controls.';
      Exit;
    end;
    ExtractTemporaryFile('ViGEmBus-Setup.exe');
    if not Exec(ExpandConstant('{tmp}\ViGEmBus-Setup.exe'), '/exenoui /qn /norestart', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
      Result := 'Could not start the controller driver installer.'
    else if (ExitCode = 3010) or (ExitCode = 1641) then
      DriverRestart := True
    else if ExitCode <> 0 then
      Result := Format('Controller driver installation failed (code %d).', [ExitCode]);
  end;
end;

function NeedRestart: Boolean;
begin
  Result := DriverRestart;
end;

function CanLaunch: Boolean;
begin
  Result := not DriverRestart;
end;
