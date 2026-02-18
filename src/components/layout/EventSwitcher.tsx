'use client';

import { useEvent } from '@/context/EventContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, PlusCircle, Trash2, Download, Upload } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import React from 'react';
import type { Event } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function EventSwitcher() {
  const { events, activeEvent, dispatch } = useEvent();
  const [eventToDelete, setEventToDelete] = React.useState<{id: string, name: string} | null>(null);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleEventSelect = (eventId: string) => {
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: { eventId } });
  };

  const handleNewEvent = () => {
    dispatch({ type: 'START_NEW_EVENT_CREATION' });
  };

  const handleConfirmDelete = () => {
    if (!eventToDelete) return;
    dispatch({ type: 'DELETE_EVENT', payload: { eventId: eventToDelete.id } });
    setEventToDelete(null);
  };
  
  const handleDeleteClick = (e: React.MouseEvent, event: {id: string, name: string}) => {
    e.stopPropagation();
    setDropdownOpen(false);
    setEventToDelete(event);
  };

  const handleExportEvent = (e: React.MouseEvent, eventToExport: Event) => {
    e.stopPropagation();
    const eventData = JSON.stringify(eventToExport, null, 2);
    const blob = new Blob([eventData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eventToExport.name.replace(/\s+/g, '_')}_event.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDropdownOpen(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const importedEvent = JSON.parse(event.target?.result as string) as Event;
                  if (importedEvent.id && importedEvent.name && Array.isArray(importedEvent.circuits)) {
                      dispatch({ type: 'IMPORT_EVENT', payload: importedEvent });
                  } else {
                      toast({
                        title: "Import failed",
                        description: "This file doesn't look like a valid event export.",
                        variant: "destructive",
                      });
                  }
              } catch (error) {
                  toast({
                    title: "Import failed",
                    description: "We couldn't read that file. Please check the format and try again.",
                    variant: "destructive",
                  });
              } finally {
                  setDropdownOpen(false);
              }
          };
          reader.readAsText(file);
      }
      if (e.target) e.target.value = '';
  };

  if (!events || events.length === 0) {
    return (
       <div className="p-4 text-center">
           <Button className="w-full" onClick={handleNewEvent}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Event
            </Button>
             <Button className="w-full mt-2" variant="outline" onClick={handleImportClick}>
                <Upload className="mr-2 h-4 w-4" />
                Import Event
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/json"
              className="hidden"
            />
       </div>
    );
  }

  return (
    <div className="p-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/json"
        className="hidden"
      />
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate">{activeEvent?.name ?? 'Select an Event'}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[var(--sidebar-width)] md:w-56" align="start">
          <DropdownMenuLabel>Events</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {events.map((event) => (
            <DropdownMenuItem
              key={event.id}
              onSelect={() => handleEventSelect(event.id)}
              className="justify-between"
            >
              <span className="truncate flex-grow pr-2">{event.name}</span>
               <div className="flex items-center shrink-0">
                 <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => handleExportEvent(e, event)}
                    title="Export Event"
                  >
                      <Download className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handleDeleteClick(e, event)}
                      title="Delete Event"
                  >
                      <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
               </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleNewEvent}>
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>Create New Event</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            <span>Import Event</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!eventToDelete} onOpenChange={(isOpen) => !isOpen && setEventToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the 
                        event "{eventToDelete?.name}" and all of its circuits and services.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button 
                            variant="destructive"
                            onClick={handleConfirmDelete}
                        >
                            Delete
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
