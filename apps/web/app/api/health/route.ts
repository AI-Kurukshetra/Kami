import { NextResponse } from 'next/server';

import type { HealthCheck } from '@kami/shared';

export async function GET() {
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (isProduction && !appUrl) {
    warnings.push('NEXT_PUBLIC_APP_URL is missing; auth confirmation links may resolve to localhost.');
  }

  const payload: HealthCheck = {
    service: 'web-api',
    status: warnings.length > 0 ? 'degraded' : 'ok',
    timestampIso: new Date().toISOString(),
    warnings: warnings.length > 0 ? warnings : undefined
  };

  return NextResponse.json(payload, { status: 200 });
}
