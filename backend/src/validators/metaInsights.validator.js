import { z } from 'zod';
import {
  DATE_PRESETS,
  INSIGHT_LEVELS,
  isValidIsoDate,
} from '../services/meta.insights.normalize.js';

const datePresetEnum = z.enum([...DATE_PRESETS]);
const levelEnum = z.enum([...INSIGHT_LEVELS]);

const isoDate = z
  .string()
  .refine(isValidIsoDate, { message: 'Data inválida. Use YYYY-MM-DD.' });

export const insightsQuerySchema = z
  .object({
    adAccountId: z.string().min(1, 'adAccountId é obrigatório'),
    level: levelEnum.optional().default('campaign'),
    period: z.string().optional(),
    datePreset: z.string().optional(),
    since: isoDate.optional(),
    until: isoDate.optional(),
    campaignId: z.string().optional(),
    adsetId: z.string().optional(),
    adId: z.string().optional(),
    conversionType: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
    maxPages: z.coerce.number().int().positive().max(50).optional(),
    timeIncrement: z.union([z.coerce.number().int().positive(), z.literal('all_days')]).optional(),
  })
  .superRefine((value, ctx) => {
    const hasRange = Boolean(value.since || value.until);
    if (hasRange && !(value.since && value.until)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe since e until juntos.',
        path: ['since'],
      });
    }
    if (!hasRange) {
      const preset = value.datePreset || value.period || 'last_30d';
      if (!DATE_PRESETS.has(preset)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `datePreset inválido: ${preset}`,
          path: ['datePreset'],
        });
      }
    }
  });

export const listEntitiesQuerySchema = z.object({
  adAccountId: z.string().min(1, 'adAccountId é obrigatório'),
  campaignId: z.string().optional(),
  adsetId: z.string().optional(),
});

export const comparisonQuerySchema = z.object({
  adAccountId: z.string().min(1, 'adAccountId é obrigatório'),
  level: levelEnum.optional().default('account'),
  since: isoDate,
  until: isoDate,
  previousSince: isoDate,
  previousUntil: isoDate,
  campaignId: z.string().optional(),
  adsetId: z.string().optional(),
  adId: z.string().optional(),
  conversionType: z.string().optional(),
});

export function parseQuery(schema, query) {
  const result = schema.safeParse(query || {});
  if (!result.success) {
    const message = result.error.issues[0]?.message || 'Parâmetros inválidos';
    const error = new Error(message);
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return result.data;
}
