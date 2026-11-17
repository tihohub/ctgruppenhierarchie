@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
 py -3 ct_gruppenhierarchie_v13.py
) else (
 python ct_gruppenhierarchie_v13.py
)
pause
