import { NextResponse } from 'next/server';

/**
 * Simple ping endpoint that returns a 200 OK status.
 * Used by the frontend to maintain connections.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ping: 'pong' }, { status: 200 });
} 