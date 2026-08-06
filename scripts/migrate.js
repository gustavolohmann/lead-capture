import fs from 'node:fs/promises';
import path from 'node:path';
import { createKnex, paths } from './db.js';

const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable(db) {
  const exists = await db.schema.hasTable(MIGRATIONS_TABLE);
  if (exists) return;

  await db.schema.createTable(MIGRATIONS_TABLE, (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable().unique();
    table.timestamp('executed_at').defaultTo(db.fn.now());
  });
}

async function getAppliedMigrations(db) {
  const rows = await db(MIGRATIONS_TABLE).select('name');
  return new Set(rows.map((row) => row.name));
}

async function listMigrationFiles() {
  const files = await fs.readdir(paths.migrationsDir);
  return files
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function migrate() {
  const db = createKnex();

  try {
    await ensureMigrationsTable(db);
    const applied = await getAppliedMigrations(db);
    const files = await listMigrationFiles();

    if (files.length === 0) {
      console.log('Nenhuma migration encontrada.');
      return;
    }

    let executed = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Pulando (já aplicada): ${file}`);
        continue;
      }

      const fullPath = path.join(paths.migrationsDir, file);
      const sql = await fs.readFile(fullPath, 'utf8');

      console.log(`Aplicando: ${file}`);

      await db.transaction(async (trx) => {
        await trx.raw(sql);
        await trx(MIGRATIONS_TABLE).insert({ name: file });
      });

      executed += 1;
    }

    console.log(
      executed === 0
        ? 'Banco já está atualizado.'
        : `${executed} migration(s) aplicada(s) com sucesso.`
    );
  } finally {
    await db.destroy();
  }
}

migrate().catch((error) => {
  console.error('Falha ao executar migrations:', error.message);
  process.exit(1);
});
