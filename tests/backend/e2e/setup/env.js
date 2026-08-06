import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../../..');
const backendEnvTest = path.join(root, 'backend', '.env.test');

dotenv.config({ path: backendEnvTest, override: true });

process.env.NODE_ENV = 'test';
process.env.DATABASE_NAME = 'lead_capture_test';
process.env.META_MOCK_MODE = 'true';
