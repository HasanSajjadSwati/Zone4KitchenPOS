import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { gunzipSync } from 'zlib';
import { responseCompression } from './compression.js';

const rows = Array.from({ length: 2000 }, (_, i) => ({ id: `order-${i}`, status: 'completed', total: i }));

let server: Server;
let port: number;

beforeAll(async () => {
  const app = express();
  app.use(responseCompression());
  app.get('/api/orders', (_req, res) => res.json(rows));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// Raw http.get so the client does not decompress for us and we see the wire bytes.
function get(path: string, acceptEncoding?: string) {
  return new Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    http
      .get({ port, path, headers: acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {} }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
      })
      .on('error', reject);
  });
}

describe('API response compression', () => {
  it('gzips large JSON responses for clients that accept gzip', async () => {
    const { headers, body } = await get('/api/orders', 'gzip, deflate');

    expect(headers['content-encoding']).toBe('gzip');
    const plain = JSON.stringify(rows);
    expect(body.length).toBeLessThan(plain.length / 5);
    expect(JSON.parse(gunzipSync(body).toString('utf8'))).toEqual(rows);
  });

  it('sends plain JSON to clients that do not accept gzip', async () => {
    const { headers, body } = await get('/api/orders');

    expect(headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(body.toString('utf8'))).toEqual(rows);
  });

  it('leaves tiny responses uncompressed', async () => {
    const { headers } = await get('/api/health', 'gzip');

    expect(headers['content-encoding']).toBeUndefined();
  });
});
