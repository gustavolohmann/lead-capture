import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
