// Logger utility for backend
// Enable/disable via DEBUG environment variable

const DEBUG = process.env.DEBUG === 'true';

export const logger = {
  info: (msg: string, data?: any) => {
    if (DEBUG) {
      console.log(`[INFO] ${msg}`, data || '');
    }
  },

  warn: (msg: string, data?: any) => {
    if (DEBUG) {
      console.warn(`[WARN] ${msg}`, data || '');
    }
  },

  error: (msg: string, err?: any) => {
    // Always log errors, regardless of DEBUG setting
    console.error(`[ERROR] ${msg}`, err || '');
  },

  debug: (msg: string, data?: any) => {
    if (DEBUG) {
      console.debug(`[DEBUG] ${msg}`, data || '');
    }
  },

  log: (msg: string, data?: any) => {
    if (DEBUG) {
      console.log(`[LOG] ${msg}`, data || '');
    }
  },

  // Helper to check if debug is enabled
  isEnabled: () => DEBUG,
};
