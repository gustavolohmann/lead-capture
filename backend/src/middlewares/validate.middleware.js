import { AppError } from '../utils/errors.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Dados inválidos';
      return next(
        new AppError(message, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        })
      );
    }

    req.body = result.data;
    return next();
  };
}
