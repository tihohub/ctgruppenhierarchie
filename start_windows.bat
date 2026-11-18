@echo off
rem Startet CT Gruppenhierarchie (Python-Version) unter Windows.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
 py -3 python\ct_gruppenhierarchie.py
) else (
 python python\ct_gruppenhierarchie.py
)
rem Bei einem Fehler Fenster offen lassen, damit die Meldung lesbar bleibt
if errorlevel 1 pause
