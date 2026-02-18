'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvent } from '@/context/EventContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HANDOFF_TYPES } from '@/lib/config';
import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const formSchema = z.object({
  endpoint1HandoffType: z.string().optional(),
  endpoint1EquipmentId: z.string().optional(),
  endpoint1NewEquipmentName: z.string().optional(),
  endpoint1NewAssetNumber: z.string().optional(),
  endpoint2HandoffType: z.string().optional(),
  endpoint2EquipmentId: z.string().optional(),
  endpoint2NewEquipmentName: z.string().optional(),
  endpoint2NewAssetNumber: z.string().optional(),
}).refine(data => {
    if (data.endpoint1EquipmentId === 'new') return !!data.endpoint1NewEquipmentName;
    return true;
}, {
    message: 'New equipment name is required.',
    path: ['endpoint1NewEquipmentName'],
}).refine(data => {
    if (data.endpoint2EquipmentId === 'new') return !!data.endpoint2NewEquipmentName;
    return true;
}, {
    message: 'New equipment name is required.',
    path: ['endpoint2NewEquipmentName'],
});

type FormValues = z.infer<typeof formSchema>;

export default function CircuitEndpointsCard() {
    const { activeEvent, activeCircuit, dispatch } = useEvent();
    const { toast } = useToast();
    
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            endpoint1HandoffType: '',
            endpoint1EquipmentId: '',
            endpoint1NewEquipmentName: '',
            endpoint1NewAssetNumber: '',
            endpoint2HandoffType: '',
            endpoint2EquipmentId: '',
            endpoint2NewEquipmentName: '',
            endpoint2NewAssetNumber: '',
        }
    });

    useEffect(() => {
        if (activeCircuit) {
            form.reset({
                endpoint1HandoffType: activeCircuit.endpoint1HandoffType || '',
                endpoint1EquipmentId: activeCircuit.endpoint1EquipmentId || '',
                endpoint1NewEquipmentName: '',
                endpoint1NewAssetNumber: '',
                endpoint2HandoffType: activeCircuit.endpoint2HandoffType || '',
                endpoint2EquipmentId: activeCircuit.endpoint2EquipmentId || '',
                endpoint2NewEquipmentName: '',
                endpoint2NewAssetNumber: '',
            });
        }
    }, [activeCircuit, form]);

    const nodeMap = React.useMemo(() => new Map((activeEvent?.nodes || []).map(n => [n.id, n.name])), [activeEvent?.nodes]);

    const endpoint1Id = activeCircuit?.nodeIds?.[0];
    const endpoint2Id = activeCircuit?.nodeIds?.[(activeCircuit.nodeIds || []).length - 1];
    
    const endpoint1Name = endpoint1Id ? nodeMap.get(endpoint1Id) || 'N/A' : 'N/A';
    const endpoint2Name = endpoint2Id ? nodeMap.get(endpoint2Id) || 'N/A' : 'N/A';

    const endpoint1Equipment = React.useMemo(() => {
        if (!activeEvent?.equipment || !endpoint1Id) return [];
        return activeEvent.equipment.filter(e => e.nodeId === endpoint1Id);
    }, [activeEvent?.equipment, endpoint1Id]);
    
    const endpoint2Equipment = React.useMemo(() => {
        if (!activeEvent?.equipment || !endpoint2Id) return [];
        return activeEvent.equipment.filter(e => e.nodeId === endpoint2Id);
    }, [activeEvent?.equipment, endpoint2Id]);

    const endpoint1EquipmentSelection = form.watch('endpoint1EquipmentId');
    const endpoint2EquipmentSelection = form.watch('endpoint2EquipmentId');

    if (!activeCircuit || !activeEvent || !activeCircuit.nodeIds || activeCircuit.nodeIds.length < 2) return null;

    function onSubmit(values: FormValues) {
        dispatch({ type: 'UPDATE_CIRCUIT_ENDPOINTS', payload: { updates: values } });
        form.reset({
            ...form.getValues(),
            endpoint1NewEquipmentName: '',
            endpoint1NewAssetNumber: '',
            endpoint2NewEquipmentName: '',
            endpoint2NewAssetNumber: '',
        });
        toast({
            title: "Circuit Endpoints Updated",
            description: "Handoff and equipment information has been saved.",
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Circuit Endpoints</CardTitle>
                <CardDescription>Configure handoff type and equipment for the circuit's endpoints.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Show/Hide Configuration</AccordionTrigger>
                        <AccordionContent className="pt-4">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Endpoint 1 */}
                                        <div className="space-y-4 p-4 border rounded-lg">
                                            <h3 className="font-medium">Endpoint: {endpoint1Name}</h3>
                                            <FormField
                                                control={form.control}
                                                name="endpoint1HandoffType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Handoff Type</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select handoff type" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {HANDOFF_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="endpoint1EquipmentId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Equipment</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="new">Create new equipment...</SelectItem>
                                                                {endpoint1Equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {endpoint1EquipmentSelection === 'new' && (
                                                <>
                                                <FormField
                                                    control={form.control}
                                                    name="endpoint1NewEquipmentName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>New Equipment Name</FormLabel>
                                                            <FormControl><Input placeholder="e.g., Main Router" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="endpoint1NewAssetNumber"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Asset Number (Optional)</FormLabel>
                                                            <FormControl><Input placeholder="e.g., ASSET-001" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                </>
                                            )}
                                        </div>

                                        {/* Endpoint 2 */}
                                        <div className="space-y-4 p-4 border rounded-lg">
                                            <h3 className="font-medium">Endpoint: {endpoint2Name}</h3>
                                            <FormField
                                                control={form.control}
                                                name="endpoint2HandoffType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Handoff Type</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select handoff type" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {HANDOFF_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="endpoint2EquipmentId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Equipment</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="new">Create new equipment...</SelectItem>
                                                                {endpoint2Equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {endpoint2EquipmentSelection === 'new' && (
                                                <>
                                                <FormField
                                                    control={form.control}
                                                    name="endpoint2NewEquipmentName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>New Equipment Name</FormLabel>
                                                            <FormControl><Input placeholder="e.g., Main Switch" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="endpoint2NewAssetNumber"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Asset Number (Optional)</FormLabel>
                                                            <FormControl><Input placeholder="e.g., ASSET-002" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <Button type="submit">Save Circuit Endpoints</Button>
                                </form>
                            </Form>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
}
