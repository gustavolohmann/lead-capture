import { automationService } from '../services/automation.service.js';
import { contextService } from '../services/context.service.js';

export const automationController = {
  async list(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const automations = await automationService.list(companyId);
      return res.status(200).json({ success: true, automations });
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const automation = await automationService.create(companyId, req.body);
      return res.status(201).json({ success: true, automation });
    } catch (error) {
      return next(error);
    }
  },

  async setActive(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const automation = await automationService.setActive(
        companyId,
        Number(req.params.id),
        Boolean(req.body.active)
      );
      return res.status(200).json({ success: true, automation });
    } catch (error) {
      return next(error);
    }
  },
};
