import { conversationService } from '../services/conversation.service.js';
import { messagingService } from '../services/messaging.service.js';
import { contextService } from '../services/context.service.js';

export const conversationsController = {
  async list(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const conversations = await conversationService.list(companyId);
      return res.status(200).json({ success: true, conversations });
    } catch (error) {
      return next(error);
    }
  },

  async listMessages(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const messages = await messagingService.listMessages(
        Number(req.params.id),
        companyId
      );
      return res.status(200).json({ success: true, messages });
    } catch (error) {
      return next(error);
    }
  },

  async sendMessage(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const message = await messagingService.sendManualMessage(
        companyId,
        Number(req.params.id),
        req.body.message
      );
      return res.status(201).json({ success: true, message });
    } catch (error) {
      return next(error);
    }
  },
};
