import { metaLeadsService } from '../services/meta.leads.service.js';
import { contextService } from '../services/context.service.js';

export const leadsController = {
  async list(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const leads = await metaLeadsService.listLeads(companyId);

      return res.status(200).json({
        success: true,
        leads,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const lead = await metaLeadsService.getLead(companyId, req.params.id);

      return res.status(200).json({
        success: true,
        lead,
      });
    } catch (error) {
      return next(error);
    }
  },
};
