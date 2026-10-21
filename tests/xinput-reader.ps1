$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class AnalogueXInput {
  [StructLayout(LayoutKind.Sequential)] public struct Gamepad {
    public ushort Buttons; public byte LeftTrigger, RightTrigger; public short LeftX, LeftY, RightX, RightY;
  }
  [StructLayout(LayoutKind.Sequential)] public struct State { public uint Packet; public Gamepad Gamepad; }
  [DllImport("xinput1_4.dll")] public static extern uint XInputGetState(uint index, out State state);
}
'@
Write-Output '{"ready":true}'
while ($null -ne [Console]::ReadLine()) {
  $analogueControllers = @()
  for ($controllerIndex=0; $controllerIndex -lt 4; $controllerIndex++) {
    $controllerState = New-Object AnalogueXInput+State
    if ([AnalogueXInput]::XInputGetState($controllerIndex, [ref]$controllerState) -eq 0) {
      $analogueControllers += @{index=$controllerIndex; buttons=$controllerState.Gamepad.Buttons; axes=@($controllerState.Gamepad.LeftX,$controllerState.Gamepad.LeftY,$controllerState.Gamepad.RightX,$controllerState.Gamepad.RightY,$controllerState.Gamepad.LeftTrigger,$controllerState.Gamepad.RightTrigger)}
    }
  }
  ConvertTo-Json -InputObject @{controllers=$analogueControllers} -Compress -Depth 4
}
