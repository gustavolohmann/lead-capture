import { describe, expect, it } from 'vitest';
import {
  addCampaignAdSchema,
  createFullCampaignSchema,
} from '../adsBuilder.validator.js';
import { normalizeCampaignAds } from '../../services/meta.adsBuilder.normalize.js';

const imageBase64 = `data:image/jpeg;base64,${'a'.repeat(40)}`;

function baseInput(overrides = {}) {
  return {
    objective: 'LEAD_GENERATION',
    name: 'Campanha teste',
    adAccountId: 'act_1',
    pageId: 'page_1',
    budget: 50,
    form: { privacyPolicyUrl: 'https://example.com/privacy' },
    audience: {},
    ...overrides,
  };
}

describe('createFullCampaignSchema ads 1:N', () => {
  it('preserva o contrato legado com creative singular', () => {
    const result = createFullCampaignSchema.safeParse(
      baseInput({ creative: { imageBase64, title: 'Legado' } })
    );

    expect(result.success).toBe(true);
    expect(normalizeCampaignAds(result.data)).toHaveLength(1);
    expect(normalizeCampaignAds(result.data)[0].creativeInput.title).toBe(
      'Legado'
    );
  });

  it('aceita vários anúncios', () => {
    const result = createFullCampaignSchema.safeParse(
      baseInput({
        ads: [
          {
            clientKey: 'ad-a',
            name: 'Anúncio A',
            creative: { imageBase64, title: 'A' },
          },
          {
            clientKey: 'ad-b',
            name: 'Anúncio B',
            creative: { imageBase64, title: 'B' },
          },
        ],
      })
    );

    expect(result.success).toBe(true);
    const ads = normalizeCampaignAds(result.data);
    expect(ads).toHaveLength(2);
    expect(ads[0].creativeInput.adName).toBe('Anúncio A');
    expect(ads[1].clientKey).toBe('ad-b');
  });

  it('rejeita payload sem creative e sem ads', () => {
    const result = createFullCampaignSchema.safeParse(baseInput());
    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path[0] === 'ads')).toBe(
      true
    );
  });

  it('valida link de tráfego em cada anúncio', () => {
    const result = createFullCampaignSchema.safeParse(
      baseInput({
        objective: 'TRAFFIC',
        form: undefined,
        ads: [
          { creative: { imageBase64, linkUrl: 'https://example.com/a' } },
          { creative: { imageBase64 } },
        ],
      })
    );

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['ads', 1, 'creative', 'linkUrl'] }),
      ])
    );
  });

  it('exige canal por anúncio quando Messages usa dois canais', () => {
    const result = createFullCampaignSchema.safeParse(
      baseInput({
        objective: 'MESSAGES',
        form: undefined,
        messageChannels: ['WHATSAPP', 'INSTAGRAM'],
        whatsappPhoneNumber: '+5511999999999',
        ads: [{ creative: { imageBase64 } }],
      })
    );

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['ads', 0, 'messageChannel'] }),
      ])
    );
  });
});

describe('addCampaignAdSchema', () => {
  it('aceita o contrato com Ad Set interno e Creative', () => {
    const result = addCampaignAdSchema.safeParse({
      adSetId: 20,
      pageId: 'page_1',
      name: 'Novo anúncio',
      creative: {
        title: 'Título',
        text: 'Texto principal',
        imageBase64,
        linkUrl: 'https://example.com',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejeita mídia ausente e texto vazio', () => {
    const missingImage = addCampaignAdSchema.safeParse({
      adSetId: 20,
      pageId: 'page_1',
      name: 'Novo anúncio',
      creative: { title: 'Título' },
    });
    expect(missingImage.success).toBe(false);
    expect(
      missingImage.error.issues.map((issue) => issue.path.join('.'))
    ).toContain('creative.imageBase64');

    const missingText = addCampaignAdSchema.safeParse({
      adSetId: 20,
      pageId: 'page_1',
      name: 'Novo anúncio',
      creative: { title: 'Título', imageBase64 },
    });
    expect(missingText.success).toBe(false);
    expect(
      missingText.error.issues.map((issue) => issue.path.join('.'))
    ).toContain('creative.text');
  });
});
