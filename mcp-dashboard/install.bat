@echo off
REM Installation script for MCP Dashboard GUI on Windows

echo ============================================================
echo MCP Dashboard GUI - Windows Installation
echo ============================================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher from https://python.org
    pause
    exit /b 1
)

echo Running Python installation script...
echo.

python install.py

if errorlevel 1 (
    echo.
    echo Installation failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo Installation completed successfully!
echo.
echo You can now run the application with:
echo   python app.py
echo.
echo Or create a shortcut to this batch file for easy access.
pause