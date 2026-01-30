import { v4 as uuidv4 } from 'uuid';

export function createId(): string {
  if (typeof globalThis !== 'undefined') {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID();
    }
  }

  return uuidv4();
}
