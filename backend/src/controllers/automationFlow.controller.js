import { automationFlowService } from '../services/automation.flow.service.js';
import { contextService } from '../services/context.service.js';

export const automationFlowController = {
  async listByCampaign(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const automations = await automationFlowService.listByCampaign(
        companyId,
        req.params.campaignId
      );
      return res.status(200).json({ success: true, automations });
    } catch (error) {
      return next(error);
    }
  },

  async createForCampaign(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const automation = await automationFlowService.createForCampaign(
        companyId,
        req.params.campaignId,
        req.body
      );
      return res.status(201).json({ success: true, automation });
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const automation = await automationFlowService.updateAutomation(
        companyId,
        Number(req.params.id),
        req.body
      );
      return res.status(200).json({ success: true, automation });
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const automation = await automationFlowService.getById(
        companyId,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true, automation });
    } catch (error) {
      return next(error);
    }
  },

  async test(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const result = await automationFlowService.testAutomation(
        companyId,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  },
};
