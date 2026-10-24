import pino from 'pino'

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'providerKey',
      'secret',
      '*.password',
      '*.accessToken',
      '*.providerKey',
    ],
    censor: '[redacted]',
  },
})
