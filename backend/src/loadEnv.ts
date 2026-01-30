import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let envLoaded = false;

export function ensureEnv() {
  if (envLoaded) return;

  dotenv.config({
    path: path.resolve(__dirname, '../.env'),
    override: true,
  });

  envLoaded = true;
}
