import { companyService } from './company.service.js';
import { metaMarketingClient } from './meta.marketing.client.js';
import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { metaAdAccountRepository } from '../repositories/meta.adAccount.repository.js';
import { campaignRepository } from '../repositories/campaign.repository.js';
import { adRepository } from '../repositories/ad.repository.js';
import { adSetRepository } from '../repositories/adSet.repository.js';
import { adCreativeRepository } from '../repositories/adCreative.repository.js';
import { decrypt } from '../utils/encryption.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import {
  CampaignObjective,
  CampaignStatus,
  META_OBJECTIVE_BY_PRODUCT,
  toPublicCampaign,
} from '../models/campaign.model.js';
import { toPublicAdSet } from '../models/adSet.model.js';
import { toPublicAd } from '../models/ad.model.js';

/** Objetivo de produto (SaaS) para create simples. */
const PRODUCT_OBJECTIVE = CampaignObjective.LEAD_GENERATION;

function normalizeAdAccountId(adAccountId) {
  const id = String(adAccountId || '').trim();
  if (!id) return '';
  return id.startsWith('act_') ? id : `act_${id}`;
}

function toMetaBudgetCents(dailyBudget) {
  const value = Number(dailyBudget);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError('dailyBudget inválido', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  return Math.round(value * 100);
}

function fromMetaBudgetCents(cents) {
  if (cents == null || cents === '') return null;
  const n = Number(cents);
  if (!Number.isFinite(n)) return null;
  return Number((n / 100).toFixed(2));
}

async function assertCompany(companyId) {
  const company = await companyService.getById(companyId);
  if (!company) {
    throw new AppError('Empresa não encontrada', {
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  }
  return company;
}

async function getConnectionToken(companyId) {
  const connection = await metaConnectionRepository.findByCompanyId(companyId);
  if (!connection?.access_token_encrypted) {
    throw new AppError('Empresa não possui conexão Meta ativa', {
      statusCode: 400,
      code: 'META_NOT_CONNECTED',
    });
  }

  try {
    const accessToken = decrypt(connection.access_token_encrypted);
    if (!accessToken) {
      throw new Error('empty');
    }
    return { connection, accessToken };
  } catch {
    throw new AppError('Token Meta inválido ou corrompido', {
      statusCode: 401,
      code: 'META_TOKEN_INVALID',
    });
  }
}

async function assertAdAccountBelongsToCompany(companyId, adAccountId) {
  const normalized = normalizeAdAccountId(adAccountId);
  const account = await metaAdAccountRepository.findByCompanyAndAccountId(
    companyId,
    normalized
  );

  if (!account) {
    // tenta sem prefixo act_
    const raw = normalized.replace(/^act_/, '');
    const alt = await metaAdAccountRepository.findByCompanyAndAccountId(
      companyId,
      raw
    );
    if (!alt) {
      throw new AppError('Conta de anúncio não pertence a esta empresa', {
        statusCode: 403,
        code: 'AD_ACCOUNT_FORBIDDEN',
      });
    }
    return normalizeAdAccountId(alt.account_id);
  }

  return normalizeAdAccountId(account.account_id);
}

function mapMetaObjectiveToProduct(objective) {
  if (!objective) return CampaignObjective.LEAD_GENERATION;
  if (objective === 'OUTCOME_LEADS' || objective === 'LEAD_GENERATION') {
    return CampaignObjective.LEAD_GENERATION;
  }
  if (
    objective === 'OUTCOME_ENGAGEMENT' ||
    objective === 'MESSAGES' ||
    objective === 'OUTCOME_MESSAGES'
  ) {
    return CampaignObjective.MESSAGES;
  }
  if (objective === 'OUTCOME_TRAFFIC' || objective === 'TRAFFIC' || objective === 'LINK_CLICKS') {
    return CampaignObjective.TRAFFIC;
  }
  return objective;
}

async function setCampaignStatus(companyId, id, status) {
  await assertCompany(companyId);
  const campaign = await campaignRepository.findById(companyId, id);

  if (!campaign) {
    throw new AppError('Campanha não encontrada', {
      statusCode: 404,
      code: 'CAMPAIGN_NOT_FOUND',
    });
  }

  if (!campaign.campaign_id) {
    throw new AppError('Campanha sem ID Meta', {
      statusCode: 400,
      code: 'CAMPAIGN_META_ID_MISSING',
    });
  }

  const { accessToken } = await getConnectionToken(companyId);

  await metaMarketingClient.updateCampaignStatus(
    campaign.campaign_id,
    accessToken,
    status
  );

  const updated = await campaignRepository.updateStatus(companyId, id, status);

  logger.info('Status da campanha atualizado', {
    companyId,
    id,
    status,
  });

  return toPublicCampaign(updated);
}

async function setAdStatus(companyId, campaignId, adId, status) {
  await assertCompany(companyId);
  const campaign = await campaignRepository.findById(companyId, campaignId);
  if (!campaign) {
    throw new AppError('Campanha não encontrada', {
      statusCode: 404,
      code: 'CAMPAIGN_NOT_FOUND',
    });
  }

  const ad = await adRepository.findByCampaignAndId(companyId, campaignId, adId);
  if (!ad) {
    throw new AppError('Anúncio não encontrado nesta campanha', {
      statusCode: 404,
      code: 'AD_NOT_FOUND',
    });
  }
  if (!ad.meta_ad_id) {
    throw new AppError('Anúncio sem ID Meta', {
      statusCode: 400,
      code: 'AD_META_ID_MISSING',
    });
  }

  const { accessToken } = await getConnectionToken(companyId);
  await metaMarketingClient.updateAdStatus(ad.meta_ad_id, accessToken, status);
  return toPublicAd(await adRepository.updateStatus(companyId, ad.id, status));
}

function toCampaignDetails(hierarchy) {
  const adsByAdSet = new Map();
  const ads = hierarchy.ads.map((row) => {
    const ad = {
      ...toPublicAd(row),
      metaAdsetId: row.meta_adset_id || null,
      creative: row.creative_id
        ? {
            id: row.creative_id,
            metaCreativeId: row.meta_creative_id || null,
            name: row.creative_name || null,
            title: row.creative_title || null,
            body: row.creative_body || null,
            imageHash: row.creative_image_hash || null,
            ctaType: row.creative_cta_type || null,
            status: row.creative_status || null,
          }
        : null,
    };
    const list = adsByAdSet.get(Number(row.ad_set_id)) || [];
    list.push(ad);
    adsByAdSet.set(Number(row.ad_set_id), list);
    return ad;
  });

  return {
    ...toPublicCampaign(hierarchy.campaign),
    adCount: ads.length,
    ads,
    adSets: hierarchy.adSets.map((row) => ({
      ...toPublicAdSet(row),
      ads: adsByAdSet.get(Number(row.id)) || [],
    })),
  };
}

export const metaCampaignService = {
  async listCampaigns(companyId) {
    await assertCompany(companyId);
    const rows = await campaignRepository.findByCompanyId(companyId);
    return rows.map((row) => ({
      ...toPublicCampaign(row),
      adCount: Number(row.ad_count) || 0,
    }));
  },

  async getCampaignDetails(companyId, id) {
    await assertCompany(companyId);
    const hierarchy = await campaignRepository.findHierarchy(companyId, id);
    if (!hierarchy) {
      throw new AppError('Campanha não encontrada', {
        statusCode: 404,
        code: 'CAMPAIGN_NOT_FOUND',
      });
    }
    return toCampaignDetails(hierarchy);
  },

  async createCampaign(companyId, { adAccountId, name, dailyBudget }) {
    await assertCompany(companyId);

    if (!name || String(name).trim().length < 3) {
      throw new AppError('Nome da campanha inválido', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const accountId = await assertAdAccountBelongsToCompany(
      companyId,
      adAccountId
    );
    const budgetCents = toMetaBudgetCents(dailyBudget);

    logger.info('Criando campanha Meta', {
      companyId,
      adAccountId: accountId,
      objective: PRODUCT_OBJECTIVE,
      mock: Boolean(env.META_MOCK_MODE),
    });

    let metaCampaignId;

    if (env.META_MOCK_MODE) {
      metaCampaignId = `mock_campaign_${Date.now()}`;
    } else {
      const { accessToken } = await getConnectionToken(companyId);
      const created = await metaMarketingClient.createCampaign(
        accountId,
        accessToken,
        {
          name: String(name).trim(),
          objective: META_OBJECTIVE_BY_PRODUCT[PRODUCT_OBJECTIVE],
          status: CampaignStatus.PAUSED,
          special_ad_categories: [],
          daily_budget: budgetCents,
          is_adset_budget_sharing_enabled: false,
        }
      );

      if (!created?.id) {
        throw new AppError('Meta não retornou campaign_id', {
          statusCode: 502,
          code: 'META_MARKETING_ERROR',
        });
      }
      metaCampaignId = String(created.id);
    }

    const campaign = await campaignRepository.create({
      companyId,
      adAccountId: accountId,
      campaignId: metaCampaignId,
      name: String(name).trim(),
      objective: PRODUCT_OBJECTIVE,
      status: CampaignStatus.PAUSED,
      dailyBudget: Number(dailyBudget),
    });

    logger.info('Campanha Meta criada', {
      companyId,
      campaignId: metaCampaignId,
      localId: campaign.id,
    });

    return toPublicCampaign(campaign);
  },

  async pauseCampaign(companyId, id) {
    return setCampaignStatus(companyId, id, CampaignStatus.PAUSED);
  },

  async activateCampaign(companyId, id) {
    return setCampaignStatus(companyId, id, CampaignStatus.ACTIVE);
  },

  async pauseAd(companyId, campaignId, adId) {
    return setAdStatus(companyId, campaignId, adId, CampaignStatus.PAUSED);
  },

  async activateAd(companyId, campaignId, adId) {
    return setAdStatus(companyId, campaignId, adId, CampaignStatus.ACTIVE);
  },

  async syncCampaigns(companyId, adAccountId) {
    await assertCompany(companyId);
    const accountId = await assertAdAccountBelongsToCompany(
      companyId,
      adAccountId
    );
    const { accessToken } = await getConnectionToken(companyId);

    const response = await metaMarketingClient.listCampaigns(
      accountId,
      accessToken
    );
    const items = response?.data || [];
    let synced = 0;
    const campaignsByMetaId = new Map();

    for (const item of items) {
      if (!item?.id) continue;

      const objective = mapMetaObjectiveToProduct(item.objective);
      if (
        objective !== CampaignObjective.LEAD_GENERATION &&
        objective !== CampaignObjective.MESSAGES &&
        objective !== CampaignObjective.TRAFFIC
      ) {
        continue;
      }

      const localCampaign = await campaignRepository.upsert({
        companyId,
        adAccountId: accountId,
        campaignId: String(item.id),
        name: item.name || `Campanha ${item.id}`,
        objective,
        status: item.status || CampaignStatus.PAUSED,
        dailyBudget: fromMetaBudgetCents(item.daily_budget),
      });
      campaignsByMetaId.set(String(item.id), localCampaign);
      synced += 1;
    }

    const [metaAdSets, metaAds] = await Promise.all([
      metaMarketingClient.listAdSets(accountId, accessToken, {
        fields:
          'id,name,campaign_id,status,effective_status,daily_budget,targeting',
      }),
      metaMarketingClient.listAds(accountId, accessToken),
    ]);

    const adSetsByMetaId = new Map();
    let syncedAdSets = 0;
    for (const item of metaAdSets) {
      const localCampaign = campaignsByMetaId.get(String(item.campaign_id));
      if (!localCampaign || !item?.id) continue;
      const localAdSet = await adSetRepository.upsertByMetaAdsetId({
        companyId,
        campaignId: localCampaign.id,
        metaAdsetId: String(item.id),
        name: item.name || `Conjunto ${item.id}`,
        dailyBudget: fromMetaBudgetCents(item.daily_budget),
        targeting: item.targeting || null,
        status: item.status || CampaignStatus.PAUSED,
      });
      adSetsByMetaId.set(String(item.id), localAdSet);
      syncedAdSets += 1;
    }

    let syncedCreatives = 0;
    let syncedAds = 0;
    for (const item of metaAds) {
      const localAdSet = adSetsByMetaId.get(String(item.adset_id));
      const metaCreative = item.creative;
      const metaCreativeId =
        typeof metaCreative === 'object' ? metaCreative?.id : metaCreative;
      if (!localAdSet || !item?.id || !metaCreativeId) continue;

      const creative = await adCreativeRepository.upsertByMetaCreativeId({
        companyId,
        adAccountId: accountId,
        metaCreativeId: String(metaCreativeId),
        name: metaCreative?.name || `Criativo ${metaCreativeId}`,
        title: metaCreative?.title || null,
        body: metaCreative?.body || null,
        imageHash: metaCreative?.image_hash || null,
        ctaType: metaCreative?.call_to_action_type || null,
        status: 'ACTIVE',
      });
      syncedCreatives += 1;

      await adRepository.upsertByMetaAdId({
        companyId,
        adSetId: localAdSet.id,
        creativeId: creative.id,
        metaAdId: String(item.id),
        name: item.name || `Anúncio ${item.id}`,
        status: item.status || CampaignStatus.PAUSED,
      });
      syncedAds += 1;
    }

    logger.info('Sync de campanhas concluído', {
      companyId,
      adAccountId: accountId,
      synced,
      syncedAdSets,
      syncedCreatives,
      syncedAds,
    });

    return {
      synced,
      adSets: syncedAdSets,
      creatives: syncedCreatives,
      ads: syncedAds,
    };
  },
};
