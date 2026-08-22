import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive(),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().optional().default(''),
  DATABASE_NAME: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter no mínimo 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  PORT: z.coerce.number().int().positive().optional(),
  APP_PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SERVE_FRONTEND: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  META_APP_ID: z.string().min(1).default('pending'),
  META_APP_SECRET: z.string().min(1).default('pending'),
  // App Instagram (produto API do Instagram) — campanhas/mensagens IG
  META_INSTAGRAM_APP_ID: z.string().optional().default(''),
  META_INSTAGRAM_APP_SECRET: z.string().optional().default(''),
  META_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/meta/callback'),
  META_GRAPH_VERSION: z.string().default('v21.0'),
  META_WEBHOOK_VERIFY_TOKEN: z
    .string()
    .min(8, 'META_WEBHOOK_VERIFY_TOKEN obrigatório')
    .default('change_me_webhook_token'),
  META_OAUTH_SCOPES: z
    .string()
    .optional()
    .default(
      [
        // Facebook Pages + Lead Ads
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_metadata',
        'pages_manage_ads',
        'leads_retrieval',
        'ads_read',
        'ads_management',
        'business_management',
        // Instagram via Facebook Login + Page (NÃO usar instagram_business_* /
        // Instagram Login, nem instagram_manage_comments — fora do produto)
        'instagram_basic',
        'instagram_manage_messages',
        'pages_messaging',
        // WhatsApp Business
        'whatsapp_business_management',
        'whatsapp_business_messaging',
      ].join(',')
    ),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, 'TOKEN_ENCRYPTION_KEY deve ter no mínimo 32 caracteres'),
  AUTOMATION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  APP_IDLE_SLEEP: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  META_MOCK_MODE: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  WHATSAPP_REGISTER_PIN: z
    .string()
    .regex(/^\d{6}$/, 'WHATSAPP_REGISTER_PIN deve conter exatamente 6 dígitos')
    .optional(),
  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .default('pending')
    .transform((v) => String(v || '').trim()),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .default('pending')
    .transform((v) => String(v || '').trim()),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/calendar/google/callback')
    .transform((v) => String(v || '').trim()),
  GOOGLE_OAUTH_SCOPES: z
    .string()
    .optional()
    .default(
      [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ].join(',')
    ),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV !== 'production') return;

  const requiredSecrets = [
    ['DATABASE_PASSWORD', data.DATABASE_PASSWORD],
    ['META_APP_ID', data.META_APP_ID],
    ['META_APP_SECRET', data.META_APP_SECRET],
    ['META_WEBHOOK_VERIFY_TOKEN', data.META_WEBHOOK_VERIFY_TOKEN],
  ];
  for (const [key, value] of requiredSecrets) {
    if (!value || /^(pending|change_me|changeme)$/i.test(String(value))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} deve ser configurado para produção`,
      });
    }
  }

  if (data.JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET deve ter no mínimo 32 caracteres em produção',
    });
  }
  if (!data.FRONTEND_URL.startsWith('https://')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['FRONTEND_URL'],
      message: 'FRONTEND_URL deve usar HTTPS em produção',
    });
  }
  if (!data.META_REDIRECT_URI.startsWith('https://')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['META_REDIRECT_URI'],
      message: 'META_REDIRECT_URI deve usar HTTPS em produção',
    });
  }
  if (data.META_MOCK_MODE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['META_MOCK_MODE'],
      message: 'META_MOCK_MODE deve estar desativado em produção',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Configuração de ambiente inválida: ${details}`);
}

export const env = {
  ...parsed.data,
  APP_PORT: parsed.data.PORT || parsed.data.APP_PORT,
};
