import { z } from 'zod';

export const sendMessageSchema = z.object({
  message: z
    .string({ required_error: 'message é obrigatório' })
    .trim()
    .min(1, 'message é obrigatório')
    .max(4000),
});

export const createAutomationSchema = z.object({
  name: z.string().trim().min(3).max(255),
  trigger: z.literal('NEW_LEAD').default('NEW_LEAD'),
  channel: z.enum(['WHATSAPP', 'INSTAGRAM', 'AUTO']).default('AUTO'),
  message: z.string().trim().min(1).max(4000),
  delayMinutes: z.coerce.number().int().min(0).max(10080).default(0),
  active: z.boolean().optional().default(true),
});
