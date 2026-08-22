import knex from 'knex';
import { env } from './env.js';

export const db = knex({
  client: 'mysql2',
  connection: {
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
  },
  pool: {
    min: 0,
    max: 10,
    // Libera conexões ociosas para o Railway conseguir hibernar o serviço.
    idleTimeoutMillis: 10_000,
  },
});
