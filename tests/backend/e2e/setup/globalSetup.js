import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import knex from 'knex';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../../..');

dotenv.config({
  path: path.join(root, 'backend', '.env.test'),
  override: true,
});

if (!process.env.DATABASE_NAME) {
  process.env.DATABASE_NAME = 'lead_capture_test';
}
process.env.META_MOCK_MODE = process.env.META_MOCK_MODE || 'true';

async function ensureDatabase() {
  const admin = knex({
    client: 'mysql2',
    connection: {
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || 3306),
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD ?? '',
      multipleStatements: true,
    },
  });

  try {
    await admin.raw(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await admin.destroy();
  }
}

async function migrate() {
  const db = knex({
    client: 'mysql2',
    connection: {
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || 3306),
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD ?? '',
      database: process.env.DATABASE_NAME,
      multipleStatements: true,
    },
  });

  try {
    const exists = await db.schema.hasTable('schema_migrations');
    if (!exists) {
      await db.schema.createTable('schema_migrations', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable().unique();
        table.timestamp('executed_at').defaultTo(db.fn.now());
      });
    }

    const applied = new Set(
      (await db('schema_migrations').select('name')).map((r) => r.name)
    );
    const migrationsDir = path.join(root, 'database', 'migrations');
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await db.raw(sql);
      await db('schema_migrations').insert({ name: file });
    }
  } finally {
    await db.destroy();
  }
}

export default async function globalSetup() {
  if (process.env.DATABASE_NAME !== 'lead_capture_test') {
    throw new Error(
      `Recusa: DATABASE_NAME deve ser lead_capture_test (recebido: ${process.env.DATABASE_NAME})`
    );
  }
  await ensureDatabase();
  await migrate();
}
