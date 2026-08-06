import { z } from 'zod';

const stepSchema = z.object({
  type: z.enum([
    'SEND_WHATSAPP',
    'SEND_INSTAGRAM',
    'WAIT',
    'CONDITION',
    'ASSIGN_USER',
  ]),
  config: z.record(z.any()).default({}),
  position: z.number().int().optional(),
});

export const createCampaignAutomationSchema = z.object({
  name: z.string().trim().min(3).max(255),
  active: z.boolean().optional().default(true),
  steps: z.array(stepSchema).min(1),
});

export const updateAutomationFlowSchema = z.object({
  name: z.string().trim().min(3).max(255).optional(),
  active: z.boolean().optional(),
  steps: z.array(stepSchema).min(1).optional(),
});
