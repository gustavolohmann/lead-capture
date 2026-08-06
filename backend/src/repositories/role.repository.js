import { db } from '../config/database.js';

export const roleRepository = {
  async findByName(name) {
    return db('roles').where({ name }).first();
  },
};
