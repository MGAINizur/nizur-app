import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Edge runtime — minimal config
  integrations: [],
  tracesSampleRate: 0,

  enabled: process.env.NODE_ENV === 'production',
});
