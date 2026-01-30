# Remote Dashboard - Quick Start Guide

Get your remote dashboard up and running in 5 minutes!

## Step 1: On Your Linux Server

SSH into your Linux server:
```bash
ssh your-username@72.62.70.81
```

## Step 2: Navigate to Dashboard Folder

```bash
cd /path/to/POS/remote-dashboard
```

*If the folder doesn't exist, you need to upload/copy the remote-dashboard folder from your Windows machine to your Linux server.*

## Step 3: Create Configuration File

```bash
cp .env.example .env
nano .env
```

Update these values:

```
DASHBOARD_PORT=8080
NODE_ENV=production
COUCHDB_URL=http://localhost:5984
COUCHDB_USER=posapp
COUCHDB_PASSWORD=posapp_password_123
JWT_SECRET=your-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password-here
```

Save and exit (Ctrl+X, then Y, then Enter in nano)

## Step 4: Install and Start

```bash
npm install
npm run build
npm start
```

You should see:
```
📊 POS Remote Dashboard running on http://localhost:8080
🔐 Authentication required - use admin credentials to login
```

## Step 5: Access from Home

Open your browser and go to:
```
http://72.62.70.81:8080
```

**Login with:**
- Username: `admin`
- Password: (whatever you set in .env)

## Step 6: Keep It Running (Optional but Recommended)

Use PM2 to keep the dashboard running even after logout:

```bash
# Install PM2
npm install -g pm2

# Start dashboard with PM2
pm2 start dist/server.js --name "pos-dashboard"

# Save to auto-start on reboot
pm2 save
pm2 startup
```

To view logs:
```bash
pm2 logs pos-dashboard
```

## 🎉 Done!

Your remote dashboard is now ready to use!

### Next Steps (Optional):

1. **Set up HTTPS** (Recommended for production)
   - See `LINUX_DEPLOYMENT.md` for Nginx setup

2. **Add Domain Name**
   - Point your domain to your Linux server IP
   - Access via `http://pos-dashboard.yourdomain.com`

3. **Restrict Access**
   - Use firewall rules to limit access to your IP
   - Add authentication layer with Nginx

## Troubleshooting

### Dashboard not accessible?
```bash
# Check if running
pm2 list

# Check logs
pm2 logs pos-dashboard

# Check if port 8080 is listening
netstat -tlnp | grep 8080
```

### Can't connect to CouchDB?
```bash
# Test CouchDB
curl -u posapp:posapp_password_123 http://localhost:5984
```

### Wrong credentials error?
- Check username/password in .env file
- Make sure you saved the file

## Features

✅ View all orders in real-time
✅ Manage customers
✅ Edit menu prices
✅ Monitor sales statistics
✅ View analytics
✅ Access from any device

---

**Need help?** See `README.md` or `LINUX_DEPLOYMENT.md` for detailed instructions.
