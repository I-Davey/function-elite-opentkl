$ErrorActionPreference = 'Stop'
function Get-ControllerHash([string]$controllerFile) {
  $controllerHasher = [System.Security.Cryptography.SHA256]::Create()
  try { [Convert]::ToBase64String($controllerHasher.ComputeHash([IO.File]::ReadAllBytes($controllerFile))) }
  finally { $controllerHasher.Dispose() }
}
$controllerRoot = Split-Path $PSScriptRoot -Parent
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$installation = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$installation) { throw 'Install Visual Studio Build Tools with the C++ workload to build controller output.' }
$compiler = Get-ChildItem (Join-Path $installation 'VC\Tools\MSVC') -Directory | Sort-Object Name -Descending | Select-Object -First 1
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
$version = Get-ChildItem (Join-Path $sdk 'Include') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'um\Windows.h') } | Sort-Object Name -Descending | Select-Object -First 1
if (!$version) { throw 'Install the Windows 10/11 SDK.' }
$env:INCLUDE = @("$($compiler.FullName)\include", "$sdk\Include\$($version.Name)\ucrt", "$sdk\Include\$($version.Name)\shared", "$sdk\Include\$($version.Name)\um") -join ';'
$env:LIB = @("$($compiler.FullName)\lib\x64", "$sdk\Lib\$($version.Name)\ucrt\x64", "$sdk\Lib\$($version.Name)\um\x64") -join ';'
$env:PATH = "$($compiler.FullName)\bin\Hostx64\x64;$env:PATH"
$build = Join-Path $controllerRoot '.build\analog-controller'
$destination = Join-Path $controllerRoot 'dist\native\analog-controller'
New-Item -ItemType Directory -Path $build,$destination -Force | Out-Null
$resources = Join-Path $controllerRoot 'dist\resources\controller'
New-Item -ItemType Directory -Path $resources -Force | Out-Null
foreach ($controllerResource in Get-ChildItem (Join-Path $controllerRoot 'resources\controller') -File) {
  $resourceTarget = Join-Path $resources $controllerResource.Name
  if (!(Test-Path -LiteralPath $resourceTarget) -or (Get-ControllerHash $controllerResource.FullName) -ne (Get-ControllerHash $resourceTarget)) {
    Copy-Item -LiteralPath $controllerResource.FullName -Destination $resourceTarget -Force
  }
}
$controllerSource = Join-Path $controllerRoot 'native\analog-controller\controller.cpp'
$builtController = Join-Path $build 'controller.node'
$installedController = Join-Path $destination 'controller.node'
if ((Test-Path -LiteralPath $builtController) -and (Test-Path -LiteralPath $installedController) -and
    (Get-Item -LiteralPath $controllerSource).LastWriteTimeUtc -le (Get-Item -LiteralPath $builtController).LastWriteTimeUtc -and
    (Get-ControllerHash $builtController) -eq (Get-ControllerHash $installedController)) {
  return
}
Push-Location $build
try {
  & "$($compiler.FullName)\bin\Hostx64\x64\cl.exe" /nologo /std:c++17 /EHsc /O2 /MT /LD (Join-Path $controllerRoot 'native\analog-controller\controller.cpp') /Fe:controller.node /link kernel32.lib user32.lib /DYNAMICBASE /NXCOMPAT
  if ($LASTEXITCODE -ne 0) { throw 'Controller compilation failed.' }
  Copy-Item -LiteralPath (Join-Path $build 'controller.node') -Destination $destination -Force
} finally { Pop-Location }
