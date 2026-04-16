import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Basic server-side error monitoring only
  integrations: [],
  tracesSampleRate: 0,

  enabled: process.env.NODE_ENV === 'production',
});
