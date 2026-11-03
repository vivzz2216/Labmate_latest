param(
    [Parameter(Mandatory=$true)][string]$EnvFile,
    [int]$Port = 8000
)
$ErrorActionPreference = 'Stop'
$backend = Split-Path $PSScriptRoot -Parent
$envPath = (Resolve-Path -LiteralPath $EnvFile).Path
$envFolder = Split-Path $envPath -Parent
$python = (Get-Command python.exe -ErrorAction Stop).Source
# Use the installed interpreter; some Windows venv launchers cannot write files.
$packages = Join-Path $envFolder '.venv/Lib/site-packages'
if (Test-Path -LiteralPath $packages) { $env:PYTHONPATH = $packages }
$env:EXECUTION_ISOLATION = 'development'
$env:USE_DOCKER = 'false'
$env:WORKFLOW_WORKERS = '2'
$env:HEAVY_EXECUTION_LOCAL_LIMIT = '1'
$env:BROWSER_CAPTURE_LOCAL_LIMIT = '1'
$env:REDIS_REQUIRED = 'false'
$env:RATE_LIMIT_ENABLED = 'false'
# Keep this local profile independent of the VM's Redis tunnel.
$env:REDIS_URL = 'redis://127.0.0.1:6399/0'
Remove-Item Env:LABMATE_SANDBOX_WORKER -ErrorAction SilentlyContinue
if ($env:RAILWAY_ENVIRONMENT_ID) { throw 'Local development profile must not run on Railway.' }
$env:DATABASE_URL = 'sqlite:///' + (Join-Path $envFolder 'labmate.db').Replace('\','/')
$env:DATA_DIR = (Join-Path $envFolder 'local_data').Replace('\','/')
# Explicit paths override old relative paths in the existing .env file.
foreach ($entry in @{UPLOAD_DIR='uploads';REPORT_DIR='reports';SCREENSHOT_DIR='screenshots';REACT_TEMP_DIR='react_temp';LOG_DIR='logs'}.GetEnumerator()) {
    $path = Join-Path $env:DATA_DIR $entry.Value
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    [Environment]::SetEnvironmentVariable($entry.Key,$path,'Process')
}
$tools = Join-Path $env:USERPROFILE '.cache/labmate-tools'
$java = Get-ChildItem (Join-Path $tools 'java') -Filter javac.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($java) { $env:JAVAC_COMMAND=$java.FullName; $env:JAVA_COMMAND=Join-Path $java.DirectoryName 'java.exe' }
$gcc = Join-Path $tools 'cpp/mingw64/bin/gcc.exe'
if (Test-Path $gcc) { $env:C_COMPILER=$gcc; $env:CPP_COMPILER=Join-Path (Split-Path $gcc) 'g++.exe' }
$proc = Start-Process -FilePath $python -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port',"$Port",'--env-file',('"'+$envPath+'"')) -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:LOG_DIR 'server.stdout.log') -RedirectStandardError (Join-Path $env:LOG_DIR 'server.stderr.log') -PassThru
Write-Output "Local backend started: PID $($proc.Id), http://127.0.0.1:$Port (trusted local execution; no VM)."
