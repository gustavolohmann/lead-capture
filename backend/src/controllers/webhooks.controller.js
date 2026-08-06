import { metaLeadsService } from '../services/meta.leads.service.js';
import { metaWhatsappWebhookService } from '../services/meta.whatsapp.webhook.service.js';

export const webhooksController = {
  async verifyMetaLeads(req, res, next) {
    try {
      const challenge = metaLeadsService.verifyWebhook({
        mode: req.query['hub.mode'],
        verifyToken: req.query['hub.verify_token'],
        challenge: req.query['hub.challenge'],
      });

      return res.status(200).type('text/plain').send(challenge);
    } catch (error) {
      return next(error);
    }
  },

  async receiveMetaLeads(req, res, next) {
    try {
      const signature = req.get('X-Hub-Signature-256') || '';
      const rawBody = req.rawBody;

      const result = await metaLeadsService.handleLeadWebhook({
        rawBody,
        signature,
        payload: req.body,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },

  async verifyMetaWhatsapp(req, res, next) {
    try {
      const challenge = metaWhatsappWebhookService.verifyWebhook({
        mode: req.query['hub.mode'],
        verifyToken: req.query['hub.verify_token'],
        challenge: req.query['hub.challenge'],
      });

      return res.status(200).type('text/plain').send(challenge);
    } catch (error) {
      return next(error);
    }
  },

  async receiveMetaWhatsapp(req, res, next) {
    try {
      const signature = req.get('X-Hub-Signature-256') || '';
      const rawBody = req.rawBody;

      const result = await metaWhatsappWebhookService.handleWhatsappWebhook({
        rawBody,
        signature,
        payload: req.body,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },
};
