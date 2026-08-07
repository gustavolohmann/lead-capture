import { conversationService } from '../services/conversation.service.js';
import { messagingService } from '../services/messaging.service.js';
import { notificationService } from '../services/notification.service.js';
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

  async getContact(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const contact = await conversationService.getContact(
        companyId,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true, contact });
    } catch (error) {
      return next(error);
    }
  },

  async listMessages(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const conversationId = Number(req.params.id);
      const messages = await messagingService.listMessages(
        conversationId,
        companyId
      );
      await notificationService.markConversationRead(
        companyId,
        req.context.user.id,
        conversationId
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
