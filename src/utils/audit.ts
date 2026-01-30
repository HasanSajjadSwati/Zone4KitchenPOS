import { db } from '@/db';
import type { AuditLog } from '@/db/types';
import { createId } from '@/utils/uuid';

interface LogAuditParams {
  userId: string;
  action: AuditLog['action'];
  tableName: string;
  recordId: string;
  description: string;
  before?: any;
  after?: any;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await db.auditLogs.add({
      id: createId(),
      userId: params.userId,
      action: params.action,
      tableName: params.tableName,
      recordId: params.recordId,
      before: params.before || null,
      after: params.after || null,
      description: params.description,
      ipAddress: null, // Not available in browser
      userAgent: navigator.userAgent,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
    // Don't throw - audit logging should not break main operations
  }
}
