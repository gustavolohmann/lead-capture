import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  companyService: { getById: vi.fn() },
  marketing: { updateAdStatus: vi.fn() },
  connectionRepository: { findByCompanyId: vi.fn() },
  campaignRepository: { findById: vi.fn() },
  adRepository: {
    findByCampaignAndId: vi.fn(),
    updateStatus: vi.fn(),
  },
  decrypt: vi.fn(),
}));

vi.mock('../company.service.js', () => ({
  companyService: mocks.companyService,
}));
vi.mock('../meta.marketing.client.js', () => ({
  metaMarketingClient: mocks.marketing,
}));
vi.mock('../../repositories/meta.connection.repository.js', () => ({
  metaConnectionRepository: mocks.connectionRepository,
}));
vi.mock('../../repositories/campaign.repository.js', () => ({
  campaignRepository: mocks.campaignRepository,
}));
vi.mock('../../repositories/ad.repository.js', () => ({
  adRepository: mocks.adRepository,
}));
vi.mock('../../repositories/meta.adAccount.repository.js', () => ({
  metaAdAccountRepository: {},
}));
vi.mock('../../repositories/adSet.repository.js', () => ({
  adSetRepository: {},
}));
vi.mock('../../repositories/adCreative.repository.js', () => ({
  adCreativeRepository: {},
}));
vi.mock('../../utils/encryption.js', () => ({ decrypt: mocks.decrypt }));
vi.mock('../../config/env.js', () => ({
  env: { META_MOCK_MODE: false },
}));

import { metaCampaignService } from '../meta.campaign.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.companyService.getById.mockResolvedValue({ id: 1 });
  mocks.campaignRepository.findById.mockResolvedValue({
    id: 10,
    company_id: 1,
    campaign_id: 'meta-campaign-10',
  });
  mocks.adRepository.findByCampaignAndId.mockResolvedValue({
    id: 30,
    company_id: 1,
    ad_set_id: 20,
    creative_id: 40,
    meta_ad_id: 'meta-ad-30',
    name: 'Anúncio criado posteriormente',
    status: 'PAUSED',
  });
  mocks.connectionRepository.findByCompanyId.mockResolvedValue({
    access_token_encrypted: 'encrypted-token',
  });
  mocks.decrypt.mockReturnValue('decrypted-token');
  mocks.marketing.updateAdStatus.mockResolvedValue({ success: true });
  mocks.adRepository.updateStatus.mockImplementation(
    async (_companyId, _adId, status) => ({
      id: 30,
      ad_set_id: 20,
      creative_id: 40,
      meta_ad_id: 'meta-ad-30',
      name: 'Anúncio criado posteriormente',
      status,
    })
  );
});

describe('metaCampaignService status de anúncio', () => {
  it('pausa um anúncio da campanha e persiste o estado local', async () => {
    const ad = await metaCampaignService.pauseAd(1, 10, 30);

    expect(mocks.adRepository.findByCampaignAndId).toHaveBeenCalledWith(
      1,
      10,
      30
    );
    expect(mocks.marketing.updateAdStatus).toHaveBeenCalledWith(
      'meta-ad-30',
      'decrypted-token',
      'PAUSED'
    );
    expect(ad.status).toBe('PAUSED');
  });

  it('ativa o mesmo tipo de anúncio sem tratamento especial', async () => {
    const ad = await metaCampaignService.activateAd(1, 10, 30);

    expect(mocks.marketing.updateAdStatus).toHaveBeenCalledWith(
      'meta-ad-30',
      'decrypted-token',
      'ACTIVE'
    );
    expect(ad.status).toBe('ACTIVE');
  });

  it('rejeita anúncio que não pertence à campanha/empresa', async () => {
    mocks.adRepository.findByCampaignAndId.mockResolvedValue(null);

    await expect(metaCampaignService.pauseAd(1, 10, 999)).rejects.toMatchObject({
      statusCode: 404,
      code: 'AD_NOT_FOUND',
    });
    expect(mocks.marketing.updateAdStatus).not.toHaveBeenCalled();
  });
});
