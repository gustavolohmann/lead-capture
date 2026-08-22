import { contextService } from '../services/context.service.js';
import { metaInsightsService } from '../services/meta.insights.service.js';
import { AppError } from '../utils/errors.js';
import {
  comparisonQuerySchema,
  insightsQuerySchema,
  listEntitiesQuerySchema,
  parseQuery,
} from '../validators/metaInsights.validator.js';

function toAppError(error) {
  if (error instanceof AppError) return error;
  if (error?.code === 'VALIDATION_ERROR') {
    return new AppError(error.message, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  return error;
}

export const metaInsightsController = {
  async insights(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const query = parseQuery(insightsQuerySchema, req.query);
      const result = await metaInsightsService.getInsights(companyId, query);
      return res.status(200).json({
        success: true,
        level: result.level,
        adAccountId: result.adAccountId,
        period: result.period,
        summary: result.summary,
        data: result.data,
      });
    } catch (error) {
      return next(toAppError(error));
    }
  },

  async summary(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const query = parseQuery(insightsQuerySchema, req.query);
      const result = await metaInsightsService.getSummary(companyId, query);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return next(toAppError(error));
    }
  },

  async campaigns(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const query = parseQuery(listEntitiesQuerySchema, req.query);
      const campaigns = await metaInsightsService.listCampaigns(
        companyId,
        query
      );
      return res.status(200).json({
        success: true,
        campaigns,
      });
    } catch (error) {
      return next(toAppError(error));
    }
  },

  async adsets(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const query = parseQuery(listEntitiesQuerySchema, req.query);
      const adsets = await metaInsightsService.listAdSets(companyId, query);
      return res.status(200).json({
        success: true,
        adsets,
      });
    } catch (error) {
      return next(toAppError(error));
    }
  },

  async ads(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const query = parseQuery(listEntitiesQuerySchema, req.query);
      const ads = await metaInsightsService.listAds(companyId, query);
      return res.status(200).json({
        success: true,
        ads,
      });
    } catch (error) {
      return next(toAppError(error));
    }
  },

  async comparison(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const query = parseQuery(comparisonQuerySchema, req.query);
      const result = await metaInsightsService.comparePeriods(
        companyId,
        query
      );
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return next(toAppError(error));
    }
  },
};
