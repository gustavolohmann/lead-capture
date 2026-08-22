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

const adSchema = z
  .object({
    clientKey: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    messageChannel: z.enum(['WHATSAPP', 'INSTAGRAM']).optional(),
    creative: creativeSchema,
  })
  .passthrough();

export const addCampaignAdSchema = z
  .object({
    adSetId: z.coerce.number().int().positive(),
    pageId: z.string().trim().min(1, 'pageId é obrigatório'),
    name: z.string().trim().min(1).max(255),
    leadFormId: z.coerce.number().int().positive().optional(),
    whatsappPhoneNumber: z.string().trim().min(8).max(40).optional(),
    creative: creativeSchema.extend({
      title: z.string().trim().min(1).max(255),
      text: z.string().trim().min(1).max(5000).optional(),
      body: z.string().trim().min(1).max(5000).optional(),
      description: z.string().trim().max(500).optional(),
      imageBase64: z.string().min(32, 'Imagem do criativo é obrigatória'),
      imageName: z.string().trim().min(1).max(255).optional(),
      linkUrl: z.string().url('URL de destino inválida').optional(),
      pageWelcomeMessage: z.string().trim().max(300).optional(),
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.creative.text && !data.creative.body) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Texto principal é obrigatório',
        path: ['creative', 'text'],
      });
    }
  });

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
    // `creative` permanece aceito para compatibilidade com os clientes 1:1.
    creative: creativeSchema.optional(),
    ads: z.array(adSchema).min(1, 'Informe ao menos um anúncio').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.budget == null && data.dailyBudget == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'budget é obrigatório',
        path: ['budget'],
      });
    }

    const adInputs = data.ads?.length
      ? data.ads.map((ad) => ({ creative: ad.creative, ad }))
      : data.creative
        ? [{ creative: data.creative, ad: null }]
        : [];

    if (adInputs.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe creative ou ads',
        path: ['ads'],
      });
    }

    adInputs.forEach(({ creative }, index) => {
      const image = creative?.imageBase64 || creative?.image;
      if (!image) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Imagem do criativo é obrigatória',
          path: data.ads?.length
            ? ['ads', index, 'creative', 'imageBase64']
            : ['creative', 'imageBase64'],
        });
      }
    });

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

      if (data.ads?.length) {
        data.ads.forEach((ad, index) => {
          if (channels.length > 1 && !ad.messageChannel) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                'messageChannel é obrigatório em cada anúncio quando há mais de um canal',
              path: ['ads', index, 'messageChannel'],
            });
          }
          if (ad.messageChannel && !channels.includes(ad.messageChannel)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'O canal do anúncio não está selecionado na campanha',
              path: ['ads', index, 'messageChannel'],
            });
          }
        });
      }
    }

    if (data.objective === CampaignObjective.TRAFFIC) {
      adInputs.forEach(({ creative }, index) => {
        if (!creative?.linkUrl) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'linkUrl do site é obrigatório para tráfego',
            path: data.ads?.length
              ? ['ads', index, 'creative', 'linkUrl']
              : ['creative', 'linkUrl'],
          });
        }
      });
    }
  });
