@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
 py -3 churchtools_gruppenhierarchie_api_v10.py
) else (
 python churchtools_gruppenhierarchie_api_v10.py
)
pause
