'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvent } from '@/context/EventContext';
import { ArrowRight, PlusCircle, Trash2, Upload } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React from 'react';
import type { Event } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  eventName: z.string().min(1, 'Event name is required.'),
  nodes: z.array(z.object({ name: z.string().min(1, 'Node name is required.') }))
    .min(2, 'At least two nodes are required for the first circuit.'),
}).refine(data => {
    const names = data.nodes.map(n => n.name.trim()).filter(Boolean);
    return new Set(names).size === names.length;
}, {
    message: 'Node names must be unique.',
    path: ['nodes'],
});


export default function WelcomeScreen() {
  const { dispatch } = useEvent();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventName: '',
      nodes: [{ name: '' }, { name: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "nodes"
  });

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
              }
          };
          reader.readAsText(file);
      }
      if (e.target) e.target.value = '';
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    dispatch({
      type: 'CREATE_EVENT_WITH_CIRCUIT',
      payload: {
        eventName: values.eventName,
        nodeNames: values.nodes.map(n => n.name),
      },
    });
  }

  return (
    <div className="flex flex-col items-center justify-center pt-10">
       <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/json"
            className="hidden"
        />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Welcome to Broadcast Bandwidth Calculator</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Model your network events and circuits, and calculate bandwidth utilisation with ease.
        </p>
      </div>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Create a New Event</CardTitle>
          <CardDescription>
            Start by giving your event a name, then define the first circuit by specifying the nodes in its path.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="eventName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Summer Olympics 2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Separator />

              <div>
                <h3 className="text-lg font-medium">First Circuit Path</h3>
                <p className="text-sm text-muted-foreground">Define the linear path for the first circuit in this event.</p>
              </div>

              <div className="space-y-4">
                  {fields.map((field, index) => (
                      <FormField
                          key={field.id}
                          control={form.control}
                          name={`nodes.${index}.name`}
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Node {index + 1}</FormLabel>
                                  <FormControl>
                                      <div className="flex items-center gap-2">
                                          <Input placeholder={`e.g., Location ${index + 1}`} {...field} />
                                          {fields.length > 2 && (
                                              <Button
                                                  type="button"
                                                  variant="destructive"
                                                  size="icon"
                                                  onClick={() => remove(index)}
                                              >
                                                  <Trash2 className="h-4 w-4" />
                                                  <span className="sr-only">Remove Node</span>
                                              </Button>
                                          )}
                                      </div>
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                  ))}
                  {form.formState.errors.nodes && (
                        <p className="text-sm font-medium text-destructive">
                            {form.formState.errors.nodes.root?.message || form.formState.errors.nodes.message}
                        </p>
                    )}
              </div>
              
              <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ name: '' })}
                  className="w-full"
              >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Node to Path
              </Button>


              <Button type="submit" className="w-full">
                Create Event <ArrowRight className="ml-2" />
              </Button>
            </form>
          </Form>
          <Separator className="my-6" />
            <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Or import an existing event file</p>
                <Button variant="outline" className="w-full" onClick={handleImportClick}>
                    <Upload className="mr-2 h-4 w-4" /> Import Event
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
