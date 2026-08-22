import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  companyService: { getById: vi.fn() },
  marketing: {
    createCampaign: vi.fn(),
    createAdSet: vi.fn(),
    uploadAdImage: vi.fn(),
    createAdCreative: vi.fn(),
    createAd: vi.fn(),
    deleteCampaign: vi.fn(),
    deleteAd: vi.fn(),
    deleteAdCreative: vi.fn(),
  },
  graph: {},
  connectionRepository: { findByCompanyId: vi.fn() },
  pageRepository: { findByPageId: vi.fn() },
  adAccountRepository: { findByCompanyAndAccountId: vi.fn() },
  instagramRepository: {},
  whatsappRepository: { findByCompanyAndPhoneDigits: vi.fn() },
  leadFormRepository: {},
  adSetRepository: { create: vi.fn(), findByCampaignAndId: vi.fn() },
  creativeRepository: {
    upsertByMetaCreativeId: vi.fn(),
    findByMetaCreativeId: vi.fn(),
    deleteById: vi.fn(),
  },
  adRepository: {
    upsertByMetaAdId: vi.fn(),
    deleteByMetaAdId: vi.fn(),
  },
  campaignRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    deleteCascade: vi.fn(),
  },
  publicationRepository: {
    begin: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    restartFailed: vi.fn(),
  },
  decrypt: vi.fn(),
}));

vi.mock('../company.service.js', () => ({
  companyService: mocks.companyService,
}));
vi.mock('../meta.marketing.client.js', () => ({
  metaMarketingClient: mocks.marketing,
}));
vi.mock('../meta.graph.client.js', () => ({ metaGraphClient: mocks.graph }));
vi.mock('../../repositories/meta.connection.repository.js', () => ({
  metaConnectionRepository: mocks.connectionRepository,
}));
vi.mock('../../repositories/meta.page.repository.js', () => ({
  metaPageRepository: mocks.pageRepository,
}));
vi.mock('../../repositories/meta.adAccount.repository.js', () => ({
  metaAdAccountRepository: mocks.adAccountRepository,
}));
vi.mock('../../repositories/meta.instagram.repository.js', () => ({
  metaInstagramRepository: mocks.instagramRepository,
}));
vi.mock('../../repositories/meta.whatsapp.repository.js', () => ({
  metaWhatsappRepository: mocks.whatsappRepository,
}));
vi.mock('../meta.instagram.config.js', () => ({
  requireInstagramAppConfig: vi.fn(),
}));
vi.mock('../../repositories/leadForm.repository.js', () => ({
  leadFormRepository: mocks.leadFormRepository,
}));
vi.mock('../../repositories/adSet.repository.js', () => ({
  adSetRepository: mocks.adSetRepository,
}));
vi.mock('../../repositories/adCreative.repository.js', () => ({
  adCreativeRepository: mocks.creativeRepository,
}));
vi.mock('../../repositories/ad.repository.js', () => ({
  adRepository: mocks.adRepository,
}));
vi.mock('../../repositories/campaign.repository.js', () => ({
  campaignRepository: mocks.campaignRepository,
}));
vi.mock('../../repositories/campaignPublication.repository.js', () => ({
  campaignPublicationRepository: mocks.publicationRepository,
}));
vi.mock('../../utils/encryption.js', () => ({ decrypt: mocks.decrypt }));

import { metaAdsBuilderService } from '../meta.adsBuilder.service.js';

const imageBase64 = `data:image/jpeg;base64,${'a'.repeat(48)}`;

function trafficInput() {
  return {
    objective: 'TRAFFIC',
    name: 'Campanha tráfego 1:N',
    adAccountId: 'act_1',
    pageId: 'page_1',
    budget: 50,
    audience: { country: 'BR', ageMin: 25, ageMax: 55, bidAmount: 2 },
    ads: [
      {
        clientKey: 'ad-a',
        name: 'Anúncio A',
        creative: {
          title: 'Título A',
          text: 'Texto A',
          linkUrl: 'https://example.com/a',
          imageBase64,
          imageName: 'a.jpg',
        },
      },
      {
        clientKey: 'ad-b',
        name: 'Anúncio B',
        creative: {
          title: 'Título B',
          text: 'Texto B',
          linkUrl: 'https://example.com/b',
          imageBase64,
          imageName: 'b.jpg',
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.companyService.getById.mockResolvedValue({ id: 1 });
  mocks.connectionRepository.findByCompanyId.mockResolvedValue({
    access_token_encrypted: 'encrypted-user-token',
  });
  mocks.pageRepository.findByPageId.mockResolvedValue({
    page_id: 'page_1',
    access_token_encrypted: 'encrypted-page-token',
  });
  mocks.adAccountRepository.findByCompanyAndAccountId.mockResolvedValue({
    account_id: 'act_1',
  });
  mocks.decrypt.mockReturnValue('decrypted-token');

  mocks.marketing.createCampaign.mockResolvedValue({ id: 'meta-campaign-1' });
  mocks.marketing.createAdSet.mockResolvedValue({ id: 'meta-adset-1' });
  mocks.marketing.uploadAdImage.mockImplementation(
    (_accountId, _token, { name }) => ({
      images: { [name]: { hash: `hash-${name}` } },
    })
  );
  let creativeSequence = 0;
  mocks.marketing.createAdCreative.mockImplementation(() => {
    creativeSequence += 1;
    return { id: `meta-creative-${creativeSequence}` };
  });
  let adSequence = 0;
  mocks.marketing.createAd.mockImplementation(() => {
    adSequence += 1;
    return { id: `meta-ad-${adSequence}` };
  });
  mocks.marketing.deleteCampaign.mockResolvedValue({ success: true });
  mocks.marketing.deleteAd.mockResolvedValue({ success: true });
  mocks.marketing.deleteAdCreative.mockResolvedValue({ success: true });

  mocks.campaignRepository.create.mockImplementation((input) => ({
    id: 10,
    ad_account_id: input.adAccountId,
    campaign_id: input.campaignId,
    name: input.name,
    objective: input.objective,
    status: input.status,
    daily_budget: input.dailyBudget,
  }));
  mocks.campaignRepository.deleteCascade.mockResolvedValue(true);
  mocks.campaignRepository.findById.mockResolvedValue({
    id: 10,
    company_id: 1,
    ad_account_id: 'act_1',
    campaign_id: 'meta-campaign-1',
    name: 'Campanha existente',
    objective: 'TRAFFIC',
    status: 'PAUSED',
    daily_budget: 50,
  });
  mocks.adSetRepository.create.mockImplementation((input) => ({
    id: 20,
    campaign_id: input.campaignId,
    meta_adset_id: input.metaAdsetId,
    name: input.name,
    daily_budget: input.dailyBudget,
    targeting: input.targeting,
    status: input.status,
  }));
  mocks.adSetRepository.findByCampaignAndId.mockResolvedValue({
    id: 20,
    company_id: 1,
    campaign_id: 10,
    meta_adset_id: 'meta-adset-1',
    name: 'Ad Set existente',
    targeting: JSON.stringify({ pageId: 'page_1', websiteUrl: 'https://example.com' }),
    status: 'PAUSED',
  });
  mocks.creativeRepository.findByMetaCreativeId.mockResolvedValue(null);
  mocks.creativeRepository.deleteById.mockResolvedValue(1);
  mocks.adRepository.deleteByMetaAdId.mockResolvedValue(1);
  mocks.publicationRepository.begin.mockImplementation(
    async ({ requestHash }) => ({
      created: true,
      row: { id: 99, request_hash: requestHash, status: 'IN_PROGRESS' },
    })
  );
  mocks.publicationRepository.complete.mockResolvedValue(1);
  mocks.publicationRepository.fail.mockResolvedValue(1);
  mocks.publicationRepository.restartFailed.mockResolvedValue(null);
  let localCreativeSequence = 0;
  mocks.creativeRepository.upsertByMetaCreativeId.mockImplementation((input) => {
    localCreativeSequence += 1;
    return {
      id: 30 + localCreativeSequence,
      ad_account_id: input.adAccountId,
      meta_creative_id: input.metaCreativeId,
      name: input.name,
      title: input.title,
      body: input.body,
      image_hash: input.imageHash,
      cta_type: input.ctaType,
      status: input.status,
    };
  });
  let localAdSequence = 0;
  mocks.adRepository.upsertByMetaAdId.mockImplementation((input) => {
    localAdSequence += 1;
    return {
      id: 40 + localAdSequence,
      ad_set_id: input.adSetId,
      creative_id: input.creativeId,
      meta_ad_id: input.metaAdId,
      name: input.name,
      status: input.status,
    };
  });
});

function existingTrafficAdInput(overrides = {}) {
  return {
    adSetId: 20,
    pageId: 'page_1',
    name: 'Novo anúncio',
    creative: {
      title: 'Novo título',
      text: 'Novo texto',
      cta: 'LEARN_MORE',
      linkUrl: 'https://example.com/novo',
      imageBase64,
      imageName: 'novo.jpg',
    },
    ...overrides,
  };
}

describe('metaAdsBuilderService 1:N', () => {
  it('cria dois anúncios e dois creatives no mesmo Ad Set de tráfego', async () => {
    const result = await metaAdsBuilderService.createTrafficCampaign(
      1,
      trafficInput()
    );

    expect(result.adSets).toHaveLength(1);
    expect(result.creatives).toHaveLength(2);
    expect(result.ads).toHaveLength(2);
    expect(result.ad).toEqual(result.ads[0]);
    expect(result.creative).toEqual(result.creatives[0]);
    expect(mocks.marketing.createAdSet).toHaveBeenCalledTimes(1);
    expect(mocks.marketing.createAdCreative).toHaveBeenCalledTimes(2);
    expect(mocks.marketing.createAd).toHaveBeenCalledTimes(2);
    expect(mocks.adRepository.upsertByMetaAdId).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ adSetId: 20, name: 'Anúncio A' })
    );
    expect(mocks.adRepository.upsertByMetaAdId).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ adSetId: 20, name: 'Anúncio B' })
    );
  });

  it('compensa campanha remota antes de remover dados locais se o segundo anúncio falhar', async () => {
    mocks.marketing.createAd
      .mockResolvedValueOnce({ id: 'meta-ad-1' })
      .mockRejectedValueOnce(new Error('Falha no segundo anúncio'));

    await expect(
      metaAdsBuilderService.createTrafficCampaign(1, trafficInput())
    ).rejects.toThrow('Falha no segundo anúncio');

    expect(mocks.marketing.deleteCampaign).toHaveBeenCalledWith(
      'meta-campaign-1',
      'decrypted-token'
    );
    expect(mocks.campaignRepository.deleteCascade).toHaveBeenCalledWith(1, 10);
    expect(
      mocks.marketing.deleteCampaign.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.campaignRepository.deleteCascade.mock.invocationCallOrder[0]);
  });

  it('mantém os dados locais para reconciliação quando a compensação remota falha', async () => {
    mocks.marketing.createAd
      .mockResolvedValueOnce({ id: 'meta-ad-1' })
      .mockRejectedValueOnce(new Error('Falha no segundo anúncio'));
    mocks.marketing.deleteCampaign.mockRejectedValueOnce(
      new Error('Falha ao excluir campanha remota')
    );

    let thrown;
    try {
      await metaAdsBuilderService.createTrafficCampaign(1, trafficInput());
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.cleanupRequired).toBe(true);
    expect(mocks.campaignRepository.deleteCascade).not.toHaveBeenCalled();
  });

  it('reaproveita resultado concluído para a mesma chave sem publicar novamente', async () => {
    const stored = { campaign: { id: 10 }, ads: [{ id: 41 }, { id: 42 }] };
    mocks.publicationRepository.begin.mockImplementation(
      ({ requestHash }) => ({
        created: false,
        row: {
          id: 99,
          request_hash: requestHash,
          status: 'COMPLETED',
          result: JSON.stringify(stored),
        },
      })
    );

    const result = await metaAdsBuilderService.createFullCampaign(
      1,
      trafficInput(),
      { idempotencyKey: 'traffic-request-1' }
    );

    expect(result).toEqual(stored);
    expect(mocks.marketing.createCampaign).not.toHaveBeenCalled();
    expect(mocks.publicationRepository.complete).not.toHaveBeenCalled();
  });
});

describe('metaAdsBuilderService.addAdToCampaign', () => {
  let requestSequence = 0;
  function addExistingAd(companyId, campaignId, input, key) {
    requestSequence += 1;
    return metaAdsBuilderService.addAdToCampaign(companyId, campaignId, input, {
      idempotencyKey: key || `add-ad-test-${requestSequence}`,
    });
  }

  it('exige chave de idempotência', async () => {
    await expect(
      metaAdsBuilderService.addAdToCampaign(1, 10, existingTrafficAdInput())
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      statusCode: 400,
    });
  });

  it('cria Creative e Ad no Ad Set existente e retorna o anúncio persistido', async () => {
    const result = await addExistingAd(
      1,
      10,
      existingTrafficAdInput()
    );

    expect(mocks.adSetRepository.findByCampaignAndId).toHaveBeenCalledWith(
      1,
      10,
      20
    );
    expect(mocks.marketing.createAdCreative).toHaveBeenCalledTimes(1);
    expect(mocks.marketing.createAd).toHaveBeenCalledWith(
      'act_1',
      'decrypted-token',
      expect.objectContaining({ adset_id: 'meta-adset-1' })
    );
    expect(result.ad.metaAdId).toBe('meta-ad-1');
    expect(result.ad.creative.metaCreativeId).toBe('meta-creative-1');
  });

  it('permite adicionar um segundo anúncio à mesma campanha', async () => {
    const first = await addExistingAd(
      1,
      10,
      existingTrafficAdInput({ name: 'Primeiro adicional' })
    );
    const second = await addExistingAd(
      1,
      10,
      existingTrafficAdInput({ name: 'Segundo adicional' })
    );

    expect(first.ad.metaAdId).not.toBe(second.ad.metaAdId);
    expect(mocks.marketing.createAd).toHaveBeenCalledTimes(2);
  });

  it('rejeita Ad Set que não pertence à campanha', async () => {
    mocks.adSetRepository.findByCampaignAndId.mockResolvedValueOnce(null);

    await expect(
      addExistingAd(1, 10, existingTrafficAdInput())
    ).rejects.toMatchObject({ code: 'AD_SET_NOT_FOUND', statusCode: 404 });
    expect(mocks.marketing.createAdCreative).not.toHaveBeenCalled();
  });

  it('rejeita campanha inexistente ou de outro tenant sem consultar a Meta', async () => {
    mocks.campaignRepository.findById.mockResolvedValueOnce(null);

    await expect(
      addExistingAd(2, 10, existingTrafficAdInput())
    ).rejects.toMatchObject({ code: 'CAMPAIGN_NOT_FOUND', statusCode: 404 });
    expect(mocks.adSetRepository.findByCampaignAndId).not.toHaveBeenCalled();
    expect(mocks.marketing.createAdCreative).not.toHaveBeenCalled();
  });

  it('não persiste Ad quando a Meta falha ao criar o Creative', async () => {
    mocks.marketing.createAdCreative.mockRejectedValueOnce(
      new Error('Falha no Creative')
    );

    await expect(
      addExistingAd(1, 10, existingTrafficAdInput())
    ).rejects.toThrow('Falha no Creative');
    expect(mocks.creativeRepository.upsertByMetaCreativeId).not.toHaveBeenCalled();
    expect(mocks.marketing.createAd).not.toHaveBeenCalled();
  });

  it('remove o Creative quando a criação do Ad falha sem ambiguidade', async () => {
    mocks.marketing.createAd.mockRejectedValueOnce(new Error('Falha no Ad'));

    await expect(
      addExistingAd(1, 10, existingTrafficAdInput())
    ).rejects.toThrow('Falha no Ad');
    expect(mocks.marketing.deleteAdCreative).toHaveBeenCalledWith(
      'meta-creative-1',
      'decrypted-token'
    );
    expect(mocks.creativeRepository.deleteById).toHaveBeenCalled();
  });

  it('remove Ad e Creative remotos quando a persistência local do Ad falha', async () => {
    mocks.adRepository.upsertByMetaAdId.mockRejectedValueOnce(
      new Error('Banco indisponível')
    );

    await expect(
      addExistingAd(1, 10, existingTrafficAdInput())
    ).rejects.toThrow('Banco indisponível');
    expect(mocks.marketing.deleteAd).toHaveBeenCalledWith(
      'meta-ad-1',
      'decrypted-token'
    );
    expect(mocks.marketing.deleteAdCreative).toHaveBeenCalledWith(
      'meta-creative-1',
      'decrypted-token'
    );
  });

  it('reaproveita o resultado concluído no double submit', async () => {
    const stored = {
      campaign: { id: 10 },
      ad: { id: 41, metaAdId: 'meta-ad-stored' },
    };
    mocks.publicationRepository.begin.mockImplementation(({ requestHash }) => ({
      created: false,
      row: {
        id: 100,
        request_hash: requestHash,
        status: 'COMPLETED',
        result: JSON.stringify(stored),
      },
    }));

    const result = await metaAdsBuilderService.addAdToCampaign(
      1,
      10,
      existingTrafficAdInput(),
      { idempotencyKey: 'same-click' }
    );

    expect(result).toEqual(stored);
    expect(mocks.marketing.createAdCreative).not.toHaveBeenCalled();
    expect(mocks.marketing.createAd).not.toHaveBeenCalled();
  });
});
