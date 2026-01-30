import { runAsync } from '../db/database.js';
import { WIPE_TABLE_SEQUENCE } from '../constants/tableNames.js';
import { logger } from '../utils/logger.js';

export interface WipeOptions {
  keepSettings?: boolean;
  keepUsers?: boolean;
}

export async function wipeDatabase(options: WipeOptions = {}) {
  const { keepSettings = true, keepUsers = true } = options;
  logger.info('Starting data wipe', { keepSettings, keepUsers });

  try {
    for (const table of WIPE_TABLE_SEQUENCE) {
      if (keepSettings && table === 'settings') {
        continue;
      }
      if (keepUsers && (table === 'users' || table === 'roles')) {
        continue;
      }
      await runAsync(`DELETE FROM ${table}`);
    }
    logger.info('Data wipe completed');
  } catch (error) {
    logger.error('Data wipe failed', error);
    throw error;
  }
}
