param([Parameter(Mandatory=$true)][string]$Installer, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
if ((Get-AuthenticodeSignature -LiteralPath $Installer).Status -ne 'Valid') { throw 'Installer compiler signature is invalid.' }
$compilerInstall = Start-Process -FilePath $Installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CURRENTUSER',('/DIR="' + $Destination + '"')) -WindowStyle Hidden -PassThru -Wait
if ($compilerInstall.ExitCode -notin @(0,3010)) { throw "Installer compiler setup failed: $($compilerInstall.ExitCode)" }
