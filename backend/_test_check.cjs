require('dotenv').config({ path: '.env' });
const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT permissions as rolePermissions FROM roles WHERE name='Manager'")
  .then(function(r) {
    console.log('Row keys:', Object.keys(r.rows[0]).join(', '));
    console.log('rolePermissions:', r.rows[0].rolePermissions);
    console.log('rolepermissions:', r.rows[0].rolepermissions);
    pool.end();
  })
  .catch(function(e) {
    console.error(e.message);
    pool.end();
  });
