import { metaCampaignService } from '../services/meta.campaign.service.js';
import { metaAdsBuilderService } from '../services/meta.adsBuilder.service.js';
import { contextService } from '../services/context.service.js';

export const campaignsController = {
  async list(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const campaigns = await metaCampaignService.listCampaigns(companyId);

      return res.status(200).json({
        success: true,
        campaigns,
      });
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const campaign = await metaCampaignService.createCampaign(
        companyId,
        req.body
      );

      return res.status(201).json({
        success: true,
        campaign,
      });
    } catch (error) {
      return next(error);
    }
  },

  async details(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const campaign = await metaCampaignService.getCampaignDetails(
        companyId,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true, campaign });
    } catch (error) {
      return next(error);
    }
  },

  async pause(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const campaign = await metaCampaignService.pauseCampaign(
        companyId,
        Number(req.params.id)
      );

      return res.status(200).json({
        success: true,
        campaign,
      });
    } catch (error) {
      return next(error);
    }
  },

  async activate(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const campaign = await metaCampaignService.activateCampaign(
        companyId,
        Number(req.params.id)
      );

      return res.status(200).json({
        success: true,
        campaign,
      });
    } catch (error) {
      return next(error);
    }
  },

  async pauseAd(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const ad = await metaCampaignService.pauseAd(
        companyId,
        Number(req.params.campaignId),
        Number(req.params.adId)
      );
      return res.status(200).json({ success: true, ad });
    } catch (error) {
      return next(error);
    }
  },

  async activateAd(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const ad = await metaCampaignService.activateAd(
        companyId,
        Number(req.params.campaignId),
        Number(req.params.adId)
      );
      return res.status(200).json({ success: true, ad });
    } catch (error) {
      return next(error);
    }
  },

  async addAd(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const result = await metaAdsBuilderService.addAdToCampaign(
        companyId,
        Number(req.params.campaignId),
        req.body,
        {
          idempotencyKey:
            req.get('Idempotency-Key') || req.get('X-Idempotency-Key') || null,
        }
      );
      return res.status(201).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  },

  async sync(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const { adAccountId } = req.body;
      const result = await metaCampaignService.syncCampaigns(
        companyId,
        adAccountId
      );

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },
};
