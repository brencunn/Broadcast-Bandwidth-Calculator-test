'use client';
import { Button } from '@/components/ui/button';
import { useEvent } from '@/context/EventContext';
import { Network } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { X } from 'lucide-react';

export default function Header() {
  const { events, activeEvent, dispatch, lastSyncAt, conflictDetected, dismissConflict } = useEvent();
  const pathname = usePathname();

  const handleNewEvent = () => {
    dispatch({ type: 'START_NEW_EVENT_CREATION' });
  };

  const formattedSyncTime = lastSyncAt
    ? lastSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="border-b print-hidden">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2">
          {pathname === '/' && <SidebarTrigger className="md:hidden" />}
          <Link href="/" className="flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">
              Broadcast Bandwidth Calculator
            </h1>
          </Link>
        </div>
        <div className="flex items-center gap-4">
            {activeEvent && pathname !== '/report' && (
              <Button variant="outline" asChild>
                  <Link href="/report">View Report</Link>
              </Button>
            )}
             {pathname === '/report' && (
                <Button variant="outline" asChild>
                    <Link href="/">Return to Dashboard</Link>
                </Button>
            )}
            {events && events.length > 0 && (
                <Button onClick={handleNewEvent}>New Event</Button>
            )}
        </div>
      </div>
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-xs text-muted-foreground md:px-8">
        <div>
          Live updates enabled{formattedSyncTime ? ` • Last updated ${formattedSyncTime}` : ''}
        </div>
        {conflictDetected && (
          <div className="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-destructive">
            Updates arrived while you were editing. Please review for conflicts.
            <button type="button" className="text-destructive" onClick={dismissConflict} aria-label="Dismiss notice">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
