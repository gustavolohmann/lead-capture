import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente mais tarde.',
    code: 'RATE_LIMITED',
  },
});

export const oauthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas tentativas OAuth. Tente novamente mais tarde.',
    code: 'RATE_LIMITED',
  },
});

export const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Rate limit do webhook excedido.',
    code: 'RATE_LIMITED',
  },
});
