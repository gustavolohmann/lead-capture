import { z } from 'zod';
import { CampaignObjective } from '../models/campaign.model.js';

function normalizeMessageChannels(data) {
  if (Array.isArray(data.messageChannels) && data.messageChannels.length > 0) {
    return [...new Set(data.messageChannels.map((c) => String(c).toUpperCase()))];
  }
  if (data.messageChannel) {
    return [String(data.messageChannel).toUpperCase()];
  }
  return [];
}

export const createLeadFormSchema = z.object({
  pageId: z.string().min(1, 'pageId é obrigatório'),
  name: z.string().trim().min(3).max(255).optional(),
  title: z.string().trim().min(3).max(255).optional(),
  fields: z.array(z.string()).default(['name', 'email', 'phone']),
  customQuestions: z
    .array(z.union([z.string(), z.object({ label: z.string() })]))
    .default([]),
  privacyPolicyUrl: z.string().url('URL de privacidade inválida'),
  followUpActionUrl: z.string().url().optional(),
  privacyPolicyLinkText: z.string().optional(),
  thankYouTitle: z.string().optional(),
  thankYouBody: z.string().optional(),
});

const audienceSchema = z
  .object({
    ageMin: z.coerce.number().int().min(13).max(65).optional(),
    ageMax: z.coerce.number().int().min(13).max(65).optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    location: z.string().optional(),
    interests: z.array(z.any()).optional(),
    bidAmount: z.coerce.number().positive().optional(),
    name: z.string().optional(),
  })
  .passthrough()
  .default({});

const creativeSchema = z
  .object({
    title: z.string().optional(),
    text: z.string().optional(),
    body: z.string().optional(),
    description: z.string().optional(),
    cta: z.string().optional(),
    ctaType: z.string().optional(),
    image: z.string().optional(),
    imageBase64: z.string().optional(),
    imageName: z.string().optional(),
    adName: z.string().optional(),
    name: z.string().optional(),
    linkUrl: z.string().url().optional(),
  })
  .passthrough();

export const createFullCampaignSchema = z
  .object({
    objective: z
      .enum([
        CampaignObjective.LEAD_GENERATION,
        CampaignObjective.MESSAGES,
        CampaignObjective.TRAFFIC,
      ])
      .default(CampaignObjective.LEAD_GENERATION),
    name: z.string().trim().min(3).max(255),
    adAccountId: z.string().min(1),
    pageId: z.string().min(1),
    budget: z.coerce.number().positive().optional(),
    dailyBudget: z.coerce.number().positive().optional(),
    /** Canais de mensagem: um, outro ou ambos */
    messageChannel: z.enum(['WHATSAPP', 'INSTAGRAM']).optional(),
    messageChannels: z.array(z.enum(['WHATSAPP', 'INSTAGRAM'])).optional(),
    whatsappPhoneNumber: z.string().optional(),
    form: z
      .object({
        title: z.string().optional(),
        name: z.string().optional(),
        fields: z.array(z.string()).default(['name', 'email', 'phone']),
        customQuestions: z
          .array(z.union([z.string(), z.object({ label: z.string() })]))
          .default([]),
        privacyPolicyUrl: z.string().url().optional(),
        followUpActionUrl: z.string().url().optional(),
        privacyPolicyLinkText: z.string().optional(),
        thankYouTitle: z.string().optional(),
        thankYouBody: z.string().optional(),
      })
      .passthrough()
      .optional(),
    audience: audienceSchema,
    creative: creativeSchema,
  })
  .superRefine((data, ctx) => {
    if (data.budget == null && data.dailyBudget == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'budget é obrigatório',
        path: ['budget'],
      });
    }

    const image = data.creative?.imageBase64 || data.creative?.image;
    if (!image) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Imagem do criativo é obrigatória',
        path: ['creative', 'imageBase64'],
      });
    }

    if (data.objective === CampaignObjective.LEAD_GENERATION) {
      if (!data.form?.privacyPolicyUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'privacyPolicyUrl é obrigatória para Lead Ads',
          path: ['form', 'privacyPolicyUrl'],
        });
      }
    }

    if (data.objective === CampaignObjective.MESSAGES) {
      const channels = normalizeMessageChannels(data);
      if (channels.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecione ao menos um canal: WhatsApp e/ou Instagram',
          path: ['messageChannels'],
        });
      }
      if (channels.includes('WHATSAPP') && !data.whatsappPhoneNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'whatsappPhoneNumber é obrigatório quando WhatsApp está selecionado',
          path: ['whatsappPhoneNumber'],
        });
      }
    }

    if (data.objective === CampaignObjective.TRAFFIC) {
      const link = data.creative?.linkUrl;
      if (!link) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'linkUrl do site é obrigatório para tráfego',
          path: ['creative', 'linkUrl'],
        });
      }
    }
  });
