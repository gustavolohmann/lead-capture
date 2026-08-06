import { metaAuthService } from '../services/meta.auth.service.js';
import { metaAssetsService } from '../services/meta.assets.service.js';
import { contextService } from '../services/context.service.js';
import { env } from '../config/env.js';

export const metaController = {
  async connect(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const result = await metaAuthService.startConnect(companyId);

      return res.status(200).json({
        success: true,
        url: result.url,
      });
    } catch (error) {
      return next(error);
    }
  },

  async callback(req, res, next) {
    try {
      const { code, state, error, error_description: errorDescription } = req.query;

      if (error) {
        const redirect = new URL(`${env.FRONTEND_URL}/meta`);
        redirect.searchParams.set('error', String(error));
        if (errorDescription) {
          redirect.searchParams.set('error_description', String(errorDescription));
        }
        return res.redirect(redirect.toString());
      }

      const result = await metaAuthService.handleCallback({
        code: code ? String(code) : null,
        state: state ? String(state) : null,
      });

      return res.redirect(result.redirectUrl);
    } catch (error) {
      const redirect = new URL(`${env.FRONTEND_URL}/meta`);
      redirect.searchParams.set('error', error.code || 'OAUTH_FAILED');
      redirect.searchParams.set('message', error.message || 'Falha no OAuth Meta');
      return res.redirect(redirect.toString());
    }
  },

  async status(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const status = await metaAuthService.getStatus(companyId);

      return res.status(200).json({
        success: true,
        ...status,
      });
    } catch (error) {
      return next(error);
    }
  },

  async disconnect(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      await metaAuthService.disconnect(companyId);

      return res.status(200).json({
        success: true,
        connected: false,
      });
    } catch (error) {
      return next(error);
    }
  },

  async syncAssets(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const synced = await metaAssetsService.syncAll(companyId);

      return res.status(200).json({
        success: true,
        synced,
      });
    } catch (error) {
      return next(error);
    }
  },

  async listAssets(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const assets = await metaAssetsService.listAssets(companyId);

      return res.status(200).json({
        success: true,
        ...assets,
      });
    } catch (error) {
      return next(error);
    }
  },
};
