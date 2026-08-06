import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(_req, _res, next) {
  next(
    new AppError('Rota não encontrada', {
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  );
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }

  logger.error(err.message || 'Erro interno', {
    stack: err.stack,
  });

  return res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    code: 'INTERNAL_SERVER_ERROR',
  });
}
