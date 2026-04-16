import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Sentry build options (new API — no deprecated keys)
  org: "nizur",
  project: "javascript-nextjs",

  // Don't print Sentry build output
  silent: true,

  // Source maps: hide from browser bundle, upload to Sentry only (requires SENTRY_AUTH_TOKEN)
  sourcemaps: {
    disable: true,   // skip source map upload until SENTRY_AUTH_TOKEN is configured
  },

  // Disable auto-instrumentation — we only want error monitoring, no tracing
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
