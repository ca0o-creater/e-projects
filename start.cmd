@echo off
setlocal
cd /d "%~dp0"
title Chang'e Stage - Keep this window open
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js and try again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing dependencies...
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Keep this window open while using the website.
echo Website: http://127.0.0.1:5173/
echo If port 5173 is already in use, open the website above.
node "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173 --strictPort --open
if errorlevel 1 pause
