import { z } from 'zod';

const buttonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
  text: z.string().min(1).max(25),
  url: z.string().url().optional(),
  phone_number: z.string().optional(),
});

export const createWhatsappTemplateSchema = z.object({
  wabaId: z.string().min(1).optional(),
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(
      /^[a-z0-9_]+$/,
      'Nome deve ser minúsculo, números e underscore (ex: lead_followup)'
    ),
  language: z.string().min(2).max(16).default('pt_BR'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  parameterFormat: z
    .enum(['POSITIONAL', 'NAMED'])
    .optional()
    .default('POSITIONAL'),
  header: z
    .object({
      format: z.enum(['TEXT']).default('TEXT'),
      text: z.string().min(1).max(60),
    })
    .optional()
    .nullable(),
  body: z.object({
    text: z.string().min(1).max(1024),
    examples: z.array(z.string().min(1)).max(10).optional().default([]),
  }),
  footer: z
    .object({
      text: z.string().min(1).max(60),
    })
    .optional()
    .nullable(),
  buttons: z.array(buttonSchema).max(3).optional().default([]),
});
