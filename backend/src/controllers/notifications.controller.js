import { notificationService } from '../services/notification.service.js';
import { contextService } from '../services/context.service.js';

export const notificationsController = {
  async unreadCount(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const userId = req.context.user.id;
      const count = await notificationService.getUnreadCount(companyId, userId);
      return res.status(200).json({ success: true, count });
    } catch (error) {
      return next(error);
    }
  },

  async listUnread(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const userId = req.context.user.id;
      const notifications = await notificationService.listUnread(
        companyId,
        userId
      );
      return res.status(200).json({ success: true, notifications });
    } catch (error) {
      return next(error);
    }
  },

  async markRead(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const userId = req.context.user.id;
      const notification = await notificationService.markRead(
        companyId,
        userId,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true, notification });
    } catch (error) {
      return next(error);
    }
  },

  async markAllRead(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const userId = req.context.user.id;
      await notificationService.markAllRead(companyId, userId);
      return res.status(200).json({ success: true });
    } catch (error) {
      return next(error);
    }
  },
};
