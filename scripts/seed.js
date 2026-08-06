import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcrypt';
import { createKnex } from './db.js';

const ROLES = ['USER', 'ADMIN', 'MASTER'];
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    args[key] = value;
  }
  return args;
}

async function promptCredentials(args) {
  if (args.email && args.password && args.name) {
    return {
      name: String(args.name),
      email: String(args.email).toLowerCase().trim(),
      password: String(args.password),
    };
  }

  const rl = readline.createInterface({ input, output });

  try {
    const name = args.name
      ? String(args.name)
      : (await rl.question('Nome do usuário MASTER: ')).trim();
    const email = args.email
      ? String(args.email).toLowerCase().trim()
      : (await rl.question('Email do usuário MASTER: ')).toLowerCase().trim();
    const password = args.password
      ? String(args.password)
      : await rl.question('Senha do usuário MASTER (mín. 8 caracteres): ');

    return { name, email, password };
  } finally {
    rl.close();
  }
}

function validateCredentials({ name, email, password }) {
  if (!name) {
    throw new Error('Nome é obrigatório.');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email inválido.');
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}

async function ensureRoles(db) {
  for (const roleName of ROLES) {
    const existing = await db('roles').where({ name: roleName }).first();
    if (!existing) {
      await db('roles').insert({ name: roleName });
      console.log(`Role criada: ${roleName}`);
    } else {
      console.log(`Role já existe: ${roleName}`);
    }
  }
}

async function seed() {
  const args = parseArgs(process.argv.slice(2));
  const credentials = await promptCredentials(args);
  validateCredentials(credentials);

  const db = createKnex();

  try {
    await ensureRoles(db);

    const masterRole = await db('roles').where({ name: 'MASTER' }).first();
    if (!masterRole) {
      throw new Error('Role MASTER não encontrada após seed de roles.');
    }

    const existingUser = await db('users').where({ email: credentials.email }).first();
    if (existingUser) {
      throw new Error(`Já existe um usuário com o email: ${credentials.email}`);
    }

    const passwordHash = await bcrypt.hash(credentials.password, BCRYPT_ROUNDS);

    const [userId] = await db('users').insert({
      name: credentials.name,
      email: credentials.email,
      password_hash: passwordHash,
      role_id: masterRole.id,
      status: 'ACTIVE',
    });

    console.log(`Usuário MASTER criado com sucesso (id=${userId}, email=${credentials.email}).`);
  } finally {
    await db.destroy();
  }
}

seed().catch((error) => {
  console.error('Falha ao executar seed:', error.message);
  process.exit(1);
});
