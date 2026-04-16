/**
 * Sentry test endpoint — dispara un error controlado para verificar que Sentry recibe eventos.
 * Solo disponible en development/staging. Eliminar o proteger antes de producción pública.
 *
 * Uso: GET /api/sentry-test
 */
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export async function GET() {
  const eventId = Sentry.captureException(
    new Error('[Nizur] Sentry test error — integración verificada OK')
  );

  return NextResponse.json({
    ok: true,
    message: 'Error enviado a Sentry',
    sentry_event_id: eventId,
    dsn_configured: !!process.env.SENTRY_DSN,
  });
}
