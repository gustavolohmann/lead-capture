import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import knex from 'knex';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

dotenv.config({ path: path.join(backendDir, '.env') });

export function getDbConfig() {
  const required = [
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_USER',
    'DATABASE_NAME',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
    }
  }

  return {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME,
  };
}

export function createKnex(database = process.env.DATABASE_NAME) {
  const config = getDbConfig();

  return knex({
    client: 'mysql2',
    connection: {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database,
      multipleStatements: true,
    },
  });
}

export const paths = {
  rootDir,
  backendDir,
  databaseDir: path.join(rootDir, 'database'),
  migrationsDir: path.join(rootDir, 'database', 'migrations'),
};
