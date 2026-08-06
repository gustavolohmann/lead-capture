import { z } from 'zod';

export const createCampaignSchema = z.object({
  adAccountId: z
    .string({ required_error: 'adAccountId é obrigatório' })
    .min(1, 'adAccountId é obrigatório'),
  name: z
    .string({ required_error: 'name é obrigatório' })
    .trim()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(255),
  dailyBudget: z.coerce
    .number({ required_error: 'dailyBudget é obrigatório' })
    .positive('dailyBudget deve ser maior que zero'),
});
