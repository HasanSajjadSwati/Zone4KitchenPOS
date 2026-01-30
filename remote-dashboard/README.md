# POS Remote Dashboard

Access your restaurant POS system from anywhere in the world. View orders, manage customers, edit menu prices, and monitor sales - all from a simple web dashboard.

## 🎯 Features

### Dashboard
- **Real-time Statistics**: Total/today's orders, revenue tracking
- **Order Management**: View all orders, filter by customer, track status
- **Customer Management**: View customers, order history, spending analytics
- **Menu Management**: View/edit prices, manage categories, update items
- **Analytics**: Top-selling items, daily sales, customer insights

### Security
- Secure JWT authentication
- Password-protected access
- HTTPS support for production
- Encrypted database credentials

### Sync
- Automatic data sync from restaurant POS to CouchDB
- Real-time updates across all devices
- Complete database isolation (dev/prod)

## 🚀 Quick Start

### 1. On Your Linux Server

```bash
cd /path/to/POS/remote-dashboard
npm install
npm run build
npm start
```

The dashboard will be available at: `http://your-linux-ip:8080`

### 2. Access from Home

```
http://72.62.70.81:8080
```

Or use your domain:
```
http://pos-dashboard.yourdomain.com
```

### 3. Login

- **Username**: admin (default)
- **Password**: Use the password set in your .env file

## 📁 Project Structure

```
remote-dashboard/
├── src/
│   ├── server.ts          # Express server with auth
│   ├── services/
│   │   └── couchdbService.ts  # CouchDB connection & queries
│   └── routes/
│       ├── orders.ts      # Order endpoints
│       ├── customers.ts   # Customer endpoints
│       ├── menu.ts        # Menu management endpoints
│       ├── stats.ts       # Analytics endpoints
│       └── settings.ts    # Settings endpoints
├── public/
│   └── index.html         # Web dashboard UI
├── package.json
├── tsconfig.json
├── .env.example           # Configuration template
├── LINUX_DEPLOYMENT.md    # Detailed server setup guide
└── README.md              # This file
```

## ⚙️ Configuration

### Edit `.env` file:

```env
# Server port
DASHBOARD_PORT=8080

# Environment
NODE_ENV=production

# CouchDB settings - point to your Linux server
COUCHDB_URL=http://72.62.70.81:5984
COUCHDB_USER=posapp
COUCHDB_PASSWORD=posapp_password_123

# Security
JWT_SECRET=your-secure-random-string-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password-here
```

## 🔐 Security Recommendations

### For Production:

1. **Change all default credentials**
   ```env
   ADMIN_PASSWORD=something-very-secure
   JWT_SECRET=openssl rand -base64 32
   ```

2. **Enable HTTPS**
   - See LINUX_DEPLOYMENT.md for Nginx + Let's Encrypt setup
   - Never access over plain HTTP

3. **Use Firewall Rules**
   - Restrict access to your IP ranges
   - Block unauthorized connections

4. **Regular Backups**
   - CouchDB handles data persistence
   - Regular backups recommended

## 📊 Using the Dashboard

### Orders Tab
- View all orders with dates and amounts
- Click order ID for details
- Filter by date range
- Track order status

### Customers Tab
- Browse all customers
- View contact information
- See order history
- Track customer spending

### Menu Tab
- View all menu items and prices
- Edit prices directly
- Manage categories
- Update item descriptions

### Analytics Tab
- Top-selling items by revenue
- Daily sales trends
- Customer spending patterns
- Average order value

## 🔄 Data Sync Flow

```
Restaurant (Windows)
    ↓
SQLite DB (pos-dev.db or pos.db)
    ↓
    REST API
    ↓
CouchDB Sync
    ↓
Linux Server (CouchDB)
    ↓
Remote Dashboard ← You access from home
```

### Key Points:
- Restaurant POS syncs automatically to CouchDB
- Dashboard reads from CouchDB in real-time
- Changes in dashboard sync back to restaurant
- Complete isolation between dev and prod

## 📱 Access from Different Locations

### From Home
```
http://pos-dashboard.yourdomain.com
```

### From Mobile
The dashboard is responsive - works on phones and tablets

### From Multiple Locations
- Same credentials work everywhere
- Sessions expire in 24 hours
- Re-login required after expiration

## 🛠️ Troubleshooting

### Can't connect to dashboard?
1. Check Linux server is running
2. Verify firewall allows port 8080
3. Check if CouchDB is accessible
4. View logs: `pm2 logs pos-dashboard`

### Login fails?
1. Verify username/password in .env
2. Check JWT_SECRET is set
3. Clear browser cookies and try again

### Data not showing?
1. Ensure restaurant POS has synced to CouchDB
2. Check CouchDB connection in .env
3. Verify credentials are correct

### Slow dashboard?
1. CouchDB might be processing large datasets
2. Check network connection speed
3. Try limiting date ranges in queries

## 📚 Full Documentation

For complete setup and deployment instructions, see:
- **[LINUX_DEPLOYMENT.md](./LINUX_DEPLOYMENT.md)** - Detailed server setup guide

## 🎓 API Endpoints

The dashboard uses these API endpoints:

### Authentication
- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/verify` - Verify current session
- `POST /api/auth/logout` - Logout

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Menu
- `GET /api/menu/items` - Get all menu items
- `POST /api/menu/items` - Create menu item
- `PUT /api/menu/items/:id` - Update menu item
- `PATCH /api/menu/items/:id/price` - Update price

### Statistics
- `GET /api/stats` - Dashboard statistics
- `GET /api/stats/sales/daily` - Daily sales
- `GET /api/stats/top-items` - Top selling items
- `GET /api/stats/customers` - Customer analytics

## 📝 Version

Remote Dashboard v1.0.0

## 📧 Support

For issues or feature requests, check the project documentation or contact your system administrator.

---

**Happy selling! 🎉**
