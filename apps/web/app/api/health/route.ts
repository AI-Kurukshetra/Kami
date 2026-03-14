import { NextResponse } from 'next/server';

import type { HealthCheck } from '@kami/shared';

export async function GET() {
  const payload: HealthCheck = {
    service: 'web-api',
    status: 'ok',
    timestampIso: new Date().toISOString()
  };

  return NextResponse.json(payload, { status: 200 });
}
