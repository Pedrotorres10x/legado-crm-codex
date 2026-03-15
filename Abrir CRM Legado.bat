@echo off
setlocal

set "ROOT=%~dp0"
set "PORT=4173"
set "URL=http://127.0.0.1:%PORT%"

cd /d "%ROOT%"

echo.
echo ==========================================
echo   Legado CRM - Lanzador local
echo ==========================================
echo.
echo Arrancando servidor en %URL%
echo.

start "Legado CRM Dev Server" cmd /k "cd /d ""%ROOT%"" && npm run dev -- --host 127.0.0.1 --port %PORT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = '%URL%';" ^
  "$ready = $false;" ^
  "for ($i = 0; $i -lt 30; $i++) {" ^
  "  Start-Sleep -Seconds 1;" ^
  "  try {" ^
  "    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2;" ^
  "    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { $ready = $true; break }" ^
  "  } catch {}" ^
  "}" ^
  "Start-Process $url;" ^
  "if (-not $ready) { Write-Host 'El navegador se ha abierto aunque el servidor puede tardar unos segundos mas en responder.' }"

echo.
echo Si ves una ventana de terminal del servidor, dejala abierta mientras uses el CRM.
echo.
pause

