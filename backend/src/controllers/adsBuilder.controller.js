import { metaAdsBuilderService } from '../services/meta.adsBuilder.service.js';
import { contextService } from '../services/context.service.js';

export const leadFormsController = {
  async list(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const forms = await metaAdsBuilderService.listLeadForms(companyId);
      return res.status(200).json({ success: true, forms });
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const form = await metaAdsBuilderService.createLeadForm(companyId, req.body);
      return res.status(201).json({ success: true, form });
    } catch (error) {
      return next(error);
    }
  },
};

export const adsBuilderController = {
  async createFull(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const result = await metaAdsBuilderService.createFullCampaign(
        companyId,
        req.body
      );
      return res.status(201).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  },
};
