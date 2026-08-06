import { formsService } from '../services/forms.service.js';
import { formSubmissionsService } from '../services/formSubmissions.service.js';
import { contextService } from '../services/context.service.js';

export const formsController = {
  async list(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const forms = await formsService.list(companyId);
      return res.status(200).json({ success: true, forms });
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const form = await formsService.getById(companyId, Number(req.params.id));
      return res.status(200).json({ success: true, form });
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const form = await formsService.create(companyId, req.body);
      return res.status(201).json({ success: true, form });
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const form = await formsService.update(
        companyId,
        Number(req.params.id),
        req.body
      );
      return res.status(200).json({ success: true, form });
    } catch (error) {
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const result = await formsService.remove(
        companyId,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  },

  async getPublic(req, res, next) {
    try {
      const { form } = await formsService.getActivePublic(Number(req.params.id));
      return res.status(200).json({ success: true, form });
    } catch (error) {
      return next(error);
    }
  },
};

export const formSubmissionsController = {
  async submit(req, res, next) {
    try {
      const result = await formSubmissionsService.submit(
        Number(req.params.id),
        req.body
      );
      return res.status(201).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  },
};
