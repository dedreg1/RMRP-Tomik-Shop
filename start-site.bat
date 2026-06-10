@echo off
cd /d "%~dp0"
echo RMRP Deals starting on http://localhost:8080
echo Keep this window open while the site is running.
start "" "http://localhost:8080"
node server.js
pause
