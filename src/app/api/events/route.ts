import { NextResponse } from 'next/server';
import { loadAllEvents, saveAllEvents } from '@/lib/server/eventStore';
import { eventBus } from '@/lib/server/eventBus';
import type { Event } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const events = await loadAllEvents();
  return NextResponse.json({ events });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const events = Array.isArray(body?.events) ? (body.events as Event[]) : [];
  const clientId = typeof body?.clientId === 'string' ? body.clientId : null;
  await saveAllEvents(events);
  eventBus.emit('events-updated', { timestamp: Date.now(), clientId });
  return NextResponse.json({ ok: true });
}
