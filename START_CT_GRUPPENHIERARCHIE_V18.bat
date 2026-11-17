@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
 py -3 ct_gruppenhierarchie_v18.py
) else (
 python ct_gruppenhierarchie_v18.py
)
rem Bei einem Fehler Fenster offen lassen, damit die Meldung lesbar bleibt
if errorlevel 1 pause
