param(
    [Parameter(Mandatory=$true)][string]$ReportDirectory
)

$resolvedDirectory = (Resolve-Path -LiteralPath $ReportDirectory).Path
$qaDirectory = Join-Path $resolvedDirectory 'qa_render'
New-Item -ItemType Directory -Path $qaDirectory -Force | Out-Null
$wordApp = New-Object -ComObject Word.Application
$wordApp.Visible = $false
$wordApp.DisplayAlerts = 0
try {
    $documents = Get-ChildItem -LiteralPath $resolvedDirectory -Filter '*.docx' -File
    foreach ($item in $documents) {
        $pdfPath = Join-Path $qaDirectory ($item.BaseName + '.pdf')
        $wordDocument = $null
        try {
            $wordDocument = $wordApp.Documents.Open($item.FullName, $false, $true)
            $wordDocument.ExportAsFixedFormat($pdfPath, 17)
            Write-Output "Rendered $($item.Name) to $pdfPath"
        }
        finally {
            if ($null -ne $wordDocument) {
                $wordDocument.Close(0)
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wordDocument)
            }
        }
    }
}
finally {
    $wordApp.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wordApp)
}
