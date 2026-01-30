# POS Backend - Node.js + PostgreSQL

Server backend for the POS system using Node.js/Express and PostgreSQL.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create `.env`:

```
PORT=3001
NODE_ENV=production
DEBUG=true

DATABASE_URL=postgres://user:password@host:5432/pos
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
```

### 3. Initialize database
```bash
npm run migrate
```

Creates schema + default data:
- Default admin user: `admin` / `admin123`
- All tables, indexes, and relationships

### 4. Start development server
```bash
npm run dev
```

Server runs on `http://localhost:3001`

## API Health Check

```bash
curl http://localhost:3001/api/health
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled server
- `npm run migrate` - Initialize/reset database

## Project Structure

```
src/
+-- server.ts           # Express application setup
+-- db/
¦   +-- database.ts     # PostgreSQL connection & helpers
¦   +-- schema.ts       # Base schema
¦   +-- schema-postgres.ts
¦   +-- migrate.ts      # Initialization
+-- routes/
    +-- users.ts        # User management
    +-- roles.ts        # Role management
    +-- categories.ts   # Category management
    +-- menuItems.ts    # Menu items
    +-- variants.ts     # Variants & options
    +-- deals.ts        # Deals
    +-- customers.ts    # Customers
    +-- orders.ts       # Orders & order items
    +-- settings.ts     # Settings
    +-- ...
```

## Environment Variables

- `PORT`: API port (default `3001`)
- `NODE_ENV`: `development` or `production`
- `DEBUG`: enable request logging (`true`/`false`)
- `DATABASE_URL`: PostgreSQL connection string
- `DB_SSL`: set to `true` when your Postgres requires TLS
- `DB_SSL_REJECT_UNAUTHORIZED`: set to `false` for managed services using self-signed certs

## Database

### Schema
- 26 tables covering all POS operations
- Foreign key relationships
- 30+ performance indexes
- Automatic timestamps (createdAt, updatedAt)

## API Endpoints

All endpoints are prefixed with `/api/`:

### Users
- `GET /users` - List all users
- `POST /users` - Create user
- `GET /users/:id` - Get user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `POST /users/:id/change-password` - Change password

### Resources (same CRUD pattern)
- `/categories` - Category management
- `/menu-items` - Menu item management
- `/variants` - Variants
- `/variants/:id/options` - Variant options
- `/deals` - Deal management
- `/customers` - Customer management
- `/orders` - Order management
- `/roles` - Role management
- `/settings` - Settings

## Error Handling

API returns standardized error responses:

```json
{
  "error": "Description of what went wrong"
}
```

HTTP Status Codes:
- `200/201` - Success
- `400` - Bad request
- `404` - Not found
- `409` - Conflict (e.g., duplicate)
- `500` - Server error

## Production Deployment

### Build
```bash
npm run build
npm start
```

### Using PM2 (Recommended)
```bash
npm install -g pm2
pm2 start dist/server.js --name pos-backend
pm2 save
pm2 startup
```

## Troubleshooting

### Port already in use
```bash
# Find and kill process on port 3001
lsof -i :3001
kill -9 <PID>
```

### PostgreSQL connection failing
- Verify `DATABASE_URL`
- Check firewall/network
- If SSL required, set `DB_SSL=true`

## License

MIT
