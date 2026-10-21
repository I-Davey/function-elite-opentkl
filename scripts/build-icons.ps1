$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconOutput = Join-Path $PSScriptRoot '../dist/resources/icons'
New-Item -ItemType Directory -Path $iconOutput -Force | Out-Null
$frames = @()
foreach ($size in @(16, 20, 24, 32, 48, 64, 128, 256)) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($size / 256.0, $size / 256.0)
  $background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#9d64ed'))
  $foreground = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $shape.AddArc(8, 8, 64, 64, 180, 90)
  $shape.AddArc(184, 8, 64, 64, 270, 90)
  $shape.AddArc(184, 184, 64, 64, 0, 90)
  $shape.AddArc(8, 184, 64, 64, 90, 90)
  $shape.CloseFigure()
  $graphics.FillPath($background, $shape)
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 12)
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawRectangle($pen, 42, 69, 172, 118)
  foreach ($row in @(92, 120)) {
    foreach ($column in @(65, 95, 125, 155, 185)) { $graphics.FillRectangle($foreground, $column - 6, $row, 12, 12) }
  }
  $graphics.FillRectangle($foreground, 79, 153, 98, 12)
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $frames += @{ Size = $size; Bytes = $stream.ToArray() }
  if ($size -eq 256) { [System.IO.File]::WriteAllBytes((Join-Path $iconOutput 'app.png'), $stream.ToArray()) }
  $stream.Dispose(); $pen.Dispose(); $shape.Dispose(); $foreground.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$iconStream = [System.IO.File]::Create((Join-Path $iconOutput 'app.ico'))
$writer = [System.IO.BinaryWriter]::new($iconStream)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
  $offset = 6 + 16 * $frames.Count
  foreach ($frame in $frames) {
    $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
    $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$frame.Bytes.Length); $writer.Write([uint32]$offset)
    $offset += $frame.Bytes.Length
  }
  foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
} finally { $writer.Dispose() }
