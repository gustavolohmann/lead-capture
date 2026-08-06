import bcrypt from 'bcrypt';
import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';

const ROLES = ['USER', 'ADMIN', 'MASTER'];
const BCRYPT_ROUNDS = 12;

export async function bootstrapMasterIfNeeded() {
  const email = String(process.env.MASTER_EMAIL || '')
    .toLowerCase()
    .trim();
  const password = String(process.env.MASTER_PASSWORD || '');
  const name = String(process.env.MASTER_NAME || 'Master').trim();

  if (!email || !password) {
    const usersCount = await db('users').count({ total: '*' }).first();
    if (Number(usersCount?.total || 0) === 0) {
      logger.info(
        'Nenhum usuário no banco. Defina MASTER_EMAIL e MASTER_PASSWORD para criar o MASTER.'
      );
    }
    return;
  }

  if (password.length < 8) {
    logger.error('MASTER_PASSWORD deve ter no mínimo 8 caracteres');
    return;
  }

  for (const roleName of ROLES) {
    const existing = await db('roles').where({ name: roleName }).first();
    if (!existing) {
      await db('roles').insert({ name: roleName });
    }
  }

  const masterRole = await db('roles').where({ name: 'MASTER' }).first();
  if (!masterRole) {
    logger.error('Role MASTER não encontrada no bootstrap');
    return;
  }

  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    logger.info('MASTER já existe, bootstrap ignorado', { email });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [userId] = await db('users').insert({
    name: name || 'Master',
    email,
    password_hash: passwordHash,
    role_id: masterRole.id,
    status: 'ACTIVE',
  });

  logger.info('Usuário MASTER criado via bootstrap', { userId, email });
}
