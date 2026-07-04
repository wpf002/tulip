// Loads the repo-root .env. MUST be the first import in index.ts so
// DATABASE_URL / JWT_SECRET / TOKEN_ENC_KEY exist before any client is built.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env') });
