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

  // MySQL duplicate key → mensagem útil em vez de 500 genérico
  if (err?.code === 'ER_DUP_ENTRY') {
    logger.error('Registro duplicado', {
      detail: err.message || null,
    });
    return res.status(409).json({
      success: false,
      message:
        'Registro já existe (tentativa anterior). Tente criar a campanha novamente.',
      code: 'DUPLICATE_RECORD',
    });
  }

  logger.error(err.message || 'Erro interno', {
    stack: err.stack,
    code: err.code || null,
  });

  return res.status(500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    code: 'INTERNAL_SERVER_ERROR',
  });
}
