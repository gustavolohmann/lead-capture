import { whatsappTemplateService } from '../services/whatsappTemplate.service.js';

export const whatsappTemplateController = {
  async list(req, res, next) {
    try {
      const approvedOnly =
        req.query.approvedOnly === 'true' || req.query.approvedOnly === '1';
      const templates = await whatsappTemplateService.list(req.user.companyId, {
        status: req.query.status || null,
        approvedOnly,
      });
      return res.json({ templates });
    } catch (error) {
      return next(error);
    }
  },

  async sync(req, res, next) {
    try {
      const result = await whatsappTemplateService.syncFromMeta(
        req.user.companyId,
        req.body?.wabaId
      );
      return res.json({
        success: true,
        wabaId: result.wabaId,
        synced: result.synced,
        templates: result.templates,
      });
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const template = await whatsappTemplateService.create(
        req.user.companyId,
        req.body
      );
      return res.status(201).json({ template });
    } catch (error) {
      return next(error);
    }
  },
};
