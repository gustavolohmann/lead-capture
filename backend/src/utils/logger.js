export const logger = {
  info(message, meta = {}) {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    );
  },

  error(message, meta = {}) {
    const { message: detailMessage, ...rest } = meta || {};
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        ...(detailMessage != null ? { detail: detailMessage } : {}),
        ...rest,
      })
    );
  },

  warn(message, meta = {}) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    );
  },
};
