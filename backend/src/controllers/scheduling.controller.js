import { googleCalendarAuthService } from '../services/calendar/google.auth.service.js';
import { schedulingService } from '../services/scheduling/scheduling.service.js';
import { contextService } from '../services/context.service.js';
import { env } from '../config/env.js';

export const calendarController = {
  async getIntegration(req, res, next) {
    try {
      const userId = req.user.id;
      const integration = await googleCalendarAuthService.getStatus(userId);
      return res.status(200).json({ success: true, integration });
    } catch (error) {
      return next(error);
    }
  },

  async connectGoogle(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const result = await googleCalendarAuthService.startConnect({
        companyId,
        userId: req.user.id,
      });
      return res.status(200).json({ success: true, url: result.url });
    } catch (error) {
      return next(error);
    }
  },

  async callbackGoogle(req, res) {
    const render = (ok, title, detail) =>
      res.status(ok ? 200 : 400).type('html').send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:Segoe UI,system-ui,sans-serif;max-width:520px;margin:64px auto;padding:0 20px;color:#14212b;line-height:1.45}
  h1{font-size:1.4rem;margin:0 0 12px}
  p{margin:0 0 10px;color:#40505c}
  code{background:#eef3f6;padding:2px 6px;border-radius:4px}
</style></head><body>
  <h1>${title}</h1>
  <p>${detail}</p>
  <p>Pode fechar esta aba e voltar ao terminal/chat.</p>
</body></html>`);

    try {
      const { code, state, error } = req.query;
      if (error) {
        return render(
          false,
          'Conexão Google cancelada',
          `O Google retornou: <code>${String(error)}</code>. Peça um link novo e tente de novo.`
        );
      }
      await googleCalendarAuthService.handleCallback({ code, state });
      return render(
        true,
        'Google Calendar conectado',
        'Sua agenda foi vinculada com sucesso.'
      );
    } catch (error) {
      const code = error.code || 'OAUTH_FAILED';
      const message = error.message || 'Falha no OAuth';
      return render(
        false,
        'Não foi possível conectar',
        `Erro: <code>${code}</code> — ${message}<br>Gere um link novo (links antigos expiram em 10 minutos e só podem ser usados uma vez).`
      );
    }
  },

  async disconnectGoogle(req, res, next) {
    try {
      await googleCalendarAuthService.disconnect(req.user.id);
      return res.status(200).json({ success: true });
    } catch (error) {
      return next(error);
    }
  },
};

export const schedulingController = {
  async getProfile(req, res, next) {
    try {
      const profile = await schedulingService.getProfile(req.user.id);
      return res.status(200).json({ success: true, profile });
    } catch (error) {
      return next(error);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const profile = await schedulingService.updateProfile(req.user.id, req.body);
      return res.status(200).json({ success: true, profile });
    } catch (error) {
      return next(error);
    }
  },

  async getAvailability(req, res, next) {
    try {
      const availability = await schedulingService.getAvailability(req.user.id);
      return res.status(200).json({ success: true, availability });
    } catch (error) {
      return next(error);
    }
  },

  async putAvailability(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const availability = await schedulingService.putAvailability(
        companyId,
        req.user.id,
        req.body
      );
      return res.status(200).json({ success: true, availability });
    } catch (error) {
      return next(error);
    }
  },

  async listMeetingTypes(req, res, next) {
    try {
      const meetingTypes = await schedulingService.listMeetingTypes(req.user.id);
      return res.status(200).json({ success: true, meetingTypes });
    } catch (error) {
      return next(error);
    }
  },

  async createMeetingType(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const meetingType = await schedulingService.createMeetingType(
        companyId,
        req.user.id,
        req.body
      );
      return res.status(201).json({ success: true, meetingType });
    } catch (error) {
      return next(error);
    }
  },

  async updateMeetingType(req, res, next) {
    try {
      const meetingType = await schedulingService.updateMeetingType(
        req.user.id,
        Number(req.params.id),
        req.body
      );
      return res.status(200).json({ success: true, meetingType });
    } catch (error) {
      return next(error);
    }
  },

  async deleteMeetingType(req, res, next) {
    try {
      await schedulingService.deleteMeetingType(
        req.user.id,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true });
    } catch (error) {
      return next(error);
    }
  },

  async listMeetings(req, res, next) {
    try {
      const meetings = await schedulingService.listMeetings(req.user.id);
      return res.status(200).json({ success: true, meetings });
    } catch (error) {
      return next(error);
    }
  },

  async getMeeting(req, res, next) {
    try {
      const meeting = await schedulingService.getMeeting(
        req.user.id,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true, meeting });
    } catch (error) {
      return next(error);
    }
  },

  async createMeeting(req, res, next) {
    try {
      const companyId = contextService.requireCompanyId(req.context);
      const idempotencyKey =
        req.get('Idempotency-Key') || req.body.idempotencyKey || null;
      const meeting = await schedulingService.bookManual(
        companyId,
        req.user.id,
        req.body,
        { idempotencyKey }
      );
      return res.status(201).json({ success: true, meeting });
    } catch (error) {
      return next(error);
    }
  },

  async rescheduleMeeting(req, res, next) {
    try {
      const meeting = await schedulingService.reschedule(
        req.user.id,
        Number(req.params.id),
        req.body
      );
      return res.status(200).json({ success: true, meeting });
    } catch (error) {
      return next(error);
    }
  },

  async cancelMeeting(req, res, next) {
    try {
      const meeting = await schedulingService.cancel(
        req.user.id,
        Number(req.params.id)
      );
      return res.status(200).json({ success: true, meeting });
    } catch (error) {
      return next(error);
    }
  },

  async publicGetPage(req, res, next) {
    try {
      const page = await schedulingService.getPublicPage(
        req.params.sellerSlug,
        req.params.meetingSlug
      );
      return res.status(200).json({ success: true, ...page });
    } catch (error) {
      return next(error);
    }
  },

  async publicAvailability(req, res, next) {
    try {
      const availability = await schedulingService.getPublicAvailability(
        req.params.sellerSlug,
        req.params.meetingSlug,
        {
          date: req.query.date,
          from: req.query.from,
          to: req.query.to,
        }
      );
      return res.status(200).json({ success: true, availability });
    } catch (error) {
      return next(error);
    }
  },

  async publicBook(req, res, next) {
    try {
      const idempotencyKey = req.get('Idempotency-Key') || null;
      const meeting = await schedulingService.bookPublic(
        req.params.sellerSlug,
        req.params.meetingSlug,
        req.body,
        { idempotencyKey }
      );
      return res.status(201).json({ success: true, meeting });
    } catch (error) {
      return next(error);
    }
  },

  async publicCancel(req, res, next) {
    try {
      const meeting = await schedulingService.cancelByManageToken(
        req.params.token
      );
      return res.status(200).json({ success: true, meeting });
    } catch (error) {
      return next(error);
    }
  },
};
