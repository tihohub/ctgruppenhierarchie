@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
 py -3 ct_gruppenhierarchie_api_v11.py
) else (
 python ct_gruppenhierarchie_api_v11.py
)
pause
