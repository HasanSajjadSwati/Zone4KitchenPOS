import { schema as baseSchema } from './schema.js';

function toPostgresSchema(sql: string) {
  return sql
    .replace(/DATETIME/gi, 'TIMESTAMPTZ')
    .replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT TRUE')
    .replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT FALSE');
}

export const postgresSchema = toPostgresSchema(baseSchema);
