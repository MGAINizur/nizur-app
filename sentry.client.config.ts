import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Only basic error monitoring — no replay, no profiling
  integrations: [],
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,

  // Capture 100% of errors, 0% of performance traces
  tracesSampleRate: 0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',
});
