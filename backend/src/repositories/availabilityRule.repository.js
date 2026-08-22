import { db } from '../config/database.js';

export const availabilityRuleRepository = {
  async listByUser(userId) {
    return db('availability_rules')
      .where({ user_id: userId, is_active: 1 })
      .orderBy(['day_of_week', 'start_time']);
  },

  async replaceForUser({ companyId, userId, timezone, rules }) {
    return db.transaction(async (trx) => {
      await trx('availability_rules').where({ user_id: userId }).del();
      if (!rules.length) return [];

      const rows = rules.map((rule) => ({
        company_id: companyId,
        user_id: userId,
        day_of_week: rule.dayOfWeek,
        start_time: rule.startTime,
        end_time: rule.endTime,
        timezone,
        is_active: 1,
      }));
      await trx('availability_rules').insert(rows);
      return trx('availability_rules')
        .where({ user_id: userId, is_active: 1 })
        .orderBy(['day_of_week', 'start_time']);
    });
  },
};
