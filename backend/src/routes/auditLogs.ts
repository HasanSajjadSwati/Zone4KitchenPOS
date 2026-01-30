import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, allAsync, getAsync } from '../db/database.js';

export const auditLogRoutes = express.Router();

const parseJson = (value: any) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const serializeValue = (value: any) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

// Get audit logs
auditLogRoutes.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const logs = await allAsync(
      `SELECT id, userId, action, tableName, recordId, before, after, description, ipAddress, userAgent, createdAt
       FROM auditLogs
       ORDER BY createdAt DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const normalized = logs.map((log) => ({
      ...log,
      before: parseJson(log.before),
      after: parseJson(log.after),
    }));

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create audit log
auditLogRoutes.post('/', async (req, res) => {
  try {
    const {
      id,
      userId,
      action,
      tableName,
      recordId,
      before,
      after,
      description,
      ipAddress,
      userAgent,
    } = req.body || {};

    if (!userId || !action || !tableName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const logId = id || uuidv4();
    const now = new Date().toISOString();
    const resolvedIp =
      ipAddress ||
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const resolvedUserAgent = userAgent || req.get('user-agent') || null;

    await runAsync(
      `INSERT INTO auditLogs (id, userId, action, tableName, recordId, before, after, description, ipAddress, userAgent, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        userId,
        action,
        tableName,
        recordId || null,
        serializeValue(before),
        serializeValue(after),
        description || null,
        resolvedIp,
        resolvedUserAgent,
        now,
      ]
    );

    const created = await getAsync(
      `SELECT id, userId, action, tableName, recordId, before, after, description, ipAddress, userAgent, createdAt
       FROM auditLogs WHERE id = ?`,
      [logId]
    );

    res.status(201).json({
      ...created,
      before: parseJson(created?.before),
      after: parseJson(created?.after),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
