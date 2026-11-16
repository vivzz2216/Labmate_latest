param([string]$Root)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Storage.StorageFile,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
$null=[Windows.Storage.Streams.DataWriter,Windows.Storage.Streams,ContentType=WindowsRuntime]
$taskMethod=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($Op,$Type) {
 $task=$taskMethod.MakeGenericMethod($Type).Invoke($null,@($Op))
 try { $task.Wait() } catch { throw $task.Exception.Flatten().InnerExceptions[0] }
 $task.Result
}
$null=[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]
$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
if ($null -eq $engine) { $engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if ($null -eq $engine) { throw 'Windows OCR language support is unavailable. Install English OCR support or Tesseract.' }
Get-ChildItem -LiteralPath $Root -Filter '*.png' | Sort-Object Name | ForEach-Object {
 # Use the already-authorized local file bytes. StorageFile can reject ordinary
 # desktop paths even when the backend can read them; no permissions are changed.
 $stream=[Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
 $writer=[Windows.Storage.Streams.DataWriter]::new($stream)
 $writer.WriteBytes([IO.File]::ReadAllBytes($_.FullName))
 $null=Await ($writer.StoreAsync()) ([uint32])
 $null=$writer.DetachStream();$writer.Dispose();$stream.Seek(0)
 $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 $bitmap=Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
 $result=Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
 $lines=($result.Lines | ForEach-Object Text) -join "`n"
 [IO.File]::WriteAllText([IO.Path]::ChangeExtension($_.FullName,'.txt'),$lines)
 $positions=@($result.Lines | ForEach-Object {
  $line=$_
  $boxes=@($line.Words | ForEach-Object BoundingRect)
  [pscustomobject]@{text=$line.Text;left=($boxes.X | Measure-Object -Minimum).Minimum;top=($boxes.Y | Measure-Object -Minimum).Minimum;right=($boxes | ForEach-Object {$_.X+$_.Width} | Measure-Object -Maximum).Maximum;bottom=($boxes | ForEach-Object {$_.Y+$_.Height} | Measure-Object -Maximum).Maximum}
 })
 [IO.File]::WriteAllText([IO.Path]::ChangeExtension($_.FullName,'.ocr.json'),(ConvertTo-Json -InputObject $positions -Depth 4))
 $bitmap.Dispose()
 $stream.Dispose()
 Write-Output $_.Name
}
