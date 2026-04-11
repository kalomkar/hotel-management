@echo off
echo Preparing to push to GitHub...
git add .
set /p commit_msg="Enter commit message (default: Deployment Ready): "
if "%commit_msg%"=="" set commit_msg=Deployment Ready
git commit -m "%commit_msg%"

set /p repo_url="Enter your GitHub Repository URL: "
if "%repo_url%"=="" (
    echo Error: No repository URL provided.
    exit /b
)

git remote remove origin >nul 2>&1
git remote add origin %repo_url%
git branch -M main
git push -u origin main

echo Done! Now go to Render Dashboard (dashboard.render.com).
pause
