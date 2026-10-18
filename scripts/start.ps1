param([switch]$Dev)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:OLLAMA_MODELS = 'D:\Ollama\models'
$env:OLLAMA_NO_CLOUD = '1'
$python = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (!(Test-Path -LiteralPath $python)) { throw 'Install the backend first; see README.md.' }
New-Item -ItemType Directory -Force (Join-Path $projectRoot 'data') | Out-Null
try { Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null }
catch { Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot 'data\ollama.out.log') -RedirectStandardError (Join-Path $projectRoot 'data\ollama.err.log') }
if ($Dev) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm.cmd run dev' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot 'data\vite.out.log') -RedirectStandardError (Join-Path $projectRoot 'data\vite.err.log')
}
Write-Host 'Open http://127.0.0.1:8000 (or http://127.0.0.1:5173 with -Dev). Ctrl+C stops the backend.'
Push-Location (Join-Path $projectRoot 'backend')
try { & $python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 }
finally { Pop-Location }
