import pg from 'pg';
import { ensureEnv } from '../loadEnv.js';
import { schema } from './schema.js';

ensureEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set');
}

const useSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
const { Pool } = pg;

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

pool.query('SELECT 1').then(() => {
  console.log('Connected to PostgreSQL database');
}).catch((err) => {
  console.error('Error connecting to PostgreSQL database:', err);
});

export const db = pool;

function convertPlaceholders(query: string): string {
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let output = '';

  for (let i = 0; i < query.length; i += 1) {
    const char = query[i];

    if (char === "'" && !inDouble) {
      if (inSingle && query[i + 1] === "'") {
        output += "''";
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      output += char;
      continue;
    }

    if (char === '"' && !inSingle) {
      if (inDouble && query[i + 1] === '"') {
        output += '""';
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      output += char;
      continue;
    }

    if (char === '?' && !inSingle && !inDouble) {
      index += 1;
      output += `$${index}`;
      continue;
    }

    output += char;
  }

  return output;
}

function normalizeQuery(query: string): string {
  return convertPlaceholders(query);
}

function buildColumnMap(schemaSql: string): Record<string, string> {
  const map: Record<string, string> = {};
  const lines = schemaSql.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('--')) {
      continue;
    }
    if (
      line.startsWith('CREATE TABLE') ||
      line.startsWith('FOREIGN KEY') ||
      line.startsWith('UNIQUE') ||
      line.startsWith('PRIMARY KEY') ||
      line.startsWith('CONSTRAINT') ||
      line.startsWith('CREATE INDEX') ||
      line.startsWith(')')
    ) {
      continue;
    }

    const tokenMatch = line.match(/^"?([A-Za-z0-9_]+)"?\s+/);
    if (!tokenMatch) {
      continue;
    }

    const columnName = tokenMatch[1];
    const key = columnName.toLowerCase();
    if (!map[key]) {
      map[key] = columnName;
    }
  }

  return map;
}

const EXTRA_COLUMN_MAP: Record<string, string> = {
  rolename: 'roleName',
  variantname: 'variantName',
  varianttype: 'variantType',
  menuitemname: 'menuItemName',
  menuitemprice: 'menuItemPrice',
  employeename: 'employeeName',
};

const COLUMN_MAP = {
  ...buildColumnMap(schema),
  ...EXTRA_COLUMN_MAP,
};

function normalizeRowKeys<T extends Record<string, any> | null | undefined>(row: T): T {
  if (!row) return row;
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    const mappedKey = COLUMN_MAP[key] || key;
    normalized[mappedKey] = value;
  }

  return normalized as T;
}

// Helper functions for database operations
export function runAsync(query: string, params: any[] = []): Promise<any> {
  const normalized = normalizeQuery(query);
  return pool.query(normalized, params).then((result) => ({ rowCount: result.rowCount }));
}

export function getAsync(query: string, params: any[] = []): Promise<any> {
  const normalized = normalizeQuery(query);
  return pool.query(normalized, params).then((result) => {
    const row = normalizeRowKeys(result.rows[0]);
    return convertBooleans(row);
  });
}

export function allAsync(query: string, params: any[] = []): Promise<any[]> {
  const normalized = normalizeQuery(query);
  return pool.query(normalized, params).then((result) => {
    return (result.rows || []).map((row) => convertBooleans(normalizeRowKeys(row)));
  });
}

// List of fields that may be stored as integer flags and should be coerced to boolean
const booleanFields = [
  'isActive', 'isDealOnly', 'hasVariants', 'isRequired', 'isPaid',
  'requiresVariantSelection'
];

// Helper to convert integer values to proper JavaScript booleans
export function convertBooleans(row: any): any {
  if (!row) return row;
  const converted = { ...row };
  for (const field of booleanFields) {
    if (field in converted) {
      converted[field] = Boolean(converted[field]);
    }
  }
  return converted;
}

// Helper to convert an array of rows
export function convertBooleansArray(rows: any[]): any[] {
  return rows.map(convertBooleans);
}
