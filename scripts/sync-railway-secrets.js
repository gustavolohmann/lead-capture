import { readFileSync, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

function loadEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const local = loadEnv(resolve('backend/.env'));
const pairs = {
  JWT_SECRET:
    local.JWT_SECRET ||
    createHash('sha256').update(randomBytes(32)).digest('hex'),
  TOKEN_ENCRYPTION_KEY:
    local.TOKEN_ENCRYPTION_KEY ||
    createHash('sha256').update(randomBytes(32)).digest('hex').slice(0, 32),
  META_APP_ID: local.META_APP_ID || 'pending',
  META_APP_SECRET: local.META_APP_SECRET || 'pending',
  META_WEBHOOK_VERIFY_TOKEN:
    local.META_WEBHOOK_VERIFY_TOKEN || 'change_me_webhook_token',
  META_OAUTH_SCOPES: local.META_OAUTH_SCOPES || '',
};

const args = ['variable', 'set'];
for (const [key, value] of Object.entries(pairs)) {
  if (!value) continue;
  args.push(`${key}=${value}`);
}
args.push('--service', 'api', '--skip-deploys');

execFileSync('railway', args, { stdio: 'inherit', shell: true });
console.log('Secrets synced to Railway api (values not printed).');
