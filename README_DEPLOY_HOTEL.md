# Basaveshwar Hotel - Deployment Guide

This guide will help you deploy your Hotel Management System permanently on **Render** using a free **TiDB Cloud** database.

## Step 1: Set up the Database (Cloud MySQL)
1. Go to [TiDB Cloud](https://pingcap.com/tidb-cloud) and create a free **Serverless** cluster.
2. In the TiDB dashboard, click **Connect**.
3. Choose **Node.js** or **Standard Connection String**.
4. It should look like this: `mysql://username:password@host:port/database`
5. **Copy this URL.** You will need it in Step 3.

## Step 2: Push to GitHub
I have created a `push.bat` file in your folder. 
1. Create a new **Public** repository on [GitHub](https://github.com/new).
2. Copy the URL of your new repo (e.g., `https://github.com/yourname/hotel-project.git`).
3. Open a terminal in this folder and run:
   ```cmd
   git remote add origin https://github.com/yourname/hotel-project.git
   git branch -M main
   git add .
   git commit -m "Deployment ready"
   git push -u origin main
   ```

## Step 3: Deploy to Render
1. Sign in to [Render](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub account and select your **hotel-project** repository.
4. Render will automatically see the `render.yaml` file I created.
5. It will ask for environment variables:
   - `DATABASE_URL`: Paste the TiDB connection string here.
   - `EMAIL_USER`: Your Gmail address.
   - `EMAIL_PASS`: Your Gmail **App Password** (16 characters).
   - `JWT_SECRET`: A random secret string (e.g., `hotel_secret_2026`).
6. Click **Deploy**.

## Step 4: Import Database Schema (One-time)
Once your Render app is live (or even before), you need to create the tables in TiDB.
1. Open terminal on your computer.
2. Run this command (replace YOUR_URL with your TiDB URL):
   ```cmd
   node setup_remote_db.js "YOUR_URL"
   ```

Done! Your app is now permanent and ready for use.
