# Remote Dashboard - Linux Server Deployment Guide

This guide will help you deploy the Remote Dashboard on your Linux server to access your POS system from anywhere.

## Architecture Overview

```
Restaurant Network
    ↓
POS App (Windows) ← syncs → CouchDB (Linux Server)
                              ↓
                         Remote Dashboard (Port 8080)
                              ↓
Home/Anywhere ← access via IP or domain
```

## Prerequisites

- Linux server with Node.js 16+ installed
- npm or yarn package manager
- CouchDB running on the same server
- Port 8080 available (or configure alternative)

## Installation Steps

### 1. Navigate to Dashboard Directory

```bash
cd /path/to/POS/remote-dashboard
```

### 2. Create .env File

Copy the example and configure:

```bash
cp .env.example .env
nano .env  # or vi .env
```

**Edit the following values:**

```
DASHBOARD_PORT=8080

NODE_ENV=production

# Point to your Linux server's IP/hostname
COUCHDB_URL=http://localhost:5984
# Or use your actual IP:
# COUCHDB_URL=http://72.62.70.81:5984

COUCHDB_USER=posapp
COUCHDB_PASSWORD=posapp_password_123

JWT_SECRET=change-this-to-a-secure-random-string-in-production

ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-to-your-desired-password
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Build TypeScript

```bash
npm run build
```

### 5. Start the Dashboard

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

**Using PM2 (Recommended for production):**

```bash
npm install -g pm2

pm2 start dist/server.js --name "pos-dashboard"
pm2 save
pm2 startup
```

To view logs:
```bash
pm2 logs pos-dashboard
```

## Accessing from Home

### Via IP Address

```
http://your-linux-server-ip:8080
```

Example:
```
http://72.62.70.81:8080
```

### Via Domain Name (Recommended)

1. Set up a domain name pointing to your Linux server IP
2. Access via: `http://pos-dashboard.yourdomain.com`

### With HTTPS (Recommended for Production)

Use Nginx as reverse proxy with Let's Encrypt SSL:

```bash
# Install Nginx
sudo apt-get install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/pos-dashboard
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name pos-dashboard.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/pos-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Install SSL with Certbot:
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d pos-dashboard.yourdomain.com
```

## Features Available

### Orders Management
- View all orders with dates and totals
- Filter by customer
- View order details
- Track order status

### Customer Management
- View all customers
- Customer contact information
- Order history per customer
- Total spending analytics

### Menu Management
- View all menu items
- Check prices
- Edit prices from dashboard
- View categories
- Update menu items

### Analytics Dashboard
- Daily sales statistics
- Revenue tracking
- Top selling items
- Customer statistics
- Average order value

## Security Notes

1. **Change Default Credentials**
   - Always change ADMIN_PASSWORD in .env
   - Use strong passwords (min 12 characters)

2. **JWT Secret**
   - Generate a secure random string:
   ```bash
   openssl rand -base64 32
   ```
   - Use this as JWT_SECRET in .env

3. **HTTPS Only**
   - Always use HTTPS in production
   - Use Let's Encrypt for free SSL certificates
   - Never expose HTTP in production

4. **Firewall Rules**
   - Restrict port 8080 to authorized IPs if possible
   - Consider VPN for additional security
   - Use fail2ban to prevent brute force attacks

5. **Regular Backups**
   - Your data syncs automatically to CouchDB
   - Regular CouchDB backups recommended
   - Store backups securely

## Troubleshooting

### Dashboard not accessible

```bash
# Check if service is running
pm2 list

# Check logs
pm2 logs pos-dashboard

# Check port is listening
netstat -tlnp | grep 8080

# Test CouchDB connection
curl -u posapp:posapp_password_123 http://localhost:5984
```

### CouchDB connection failed

```bash
# Verify CouchDB is running
curl http://localhost:5984

# Check credentials in .env
# Test with curl:
curl -u posapp:posapp_password_123 http://localhost:5984/pos
```

### Login fails

- Verify ADMIN_USERNAME and ADMIN_PASSWORD in .env
- Check JWT_SECRET is set
- View logs: `pm2 logs pos-dashboard`

## Maintenance

### Update Dashboard Code

```bash
cd /path/to/POS/remote-dashboard

# Pull latest changes
git pull

# Rebuild
npm run build

# Restart service
pm2 restart pos-dashboard
```

### Monitor Service

```bash
# View dashboard statistics
pm2 monit

# View detailed logs
pm2 logs pos-dashboard -n 100
```

### Backup Configuration

Backup your .env file:
```bash
cp /path/to/POS/remote-dashboard/.env ~/.config/pos-dashboard-backup.env
```

## Support

For issues or questions:
1. Check logs: `pm2 logs pos-dashboard`
2. Verify CouchDB connectivity
3. Check .env configuration
4. Review firewall/network settings

## Next Steps

1. Test accessing from home via IP address
2. Set up domain name
3. Configure HTTPS with Let's Encrypt
4. Set up PM2 auto-start
5. Configure backups
