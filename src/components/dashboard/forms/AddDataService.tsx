'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEvent } from '@/context/EventContext';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { DATA_HANDOFF_TYPES } from '@/lib/config';
import React, { useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataService, Service } from '@/lib/types';
import { getSelectedNodeIdsForEdit } from '@/lib/serviceEditPrefill';

const dataServiceFormSchema = z.object({
    serviceType: z.literal('Data'),
    name: z.string().optional(),
    isAsymmetric: z.boolean().default(false),
    bandwidth: z.coerce.number().min(0).optional(),
    bandwidth1to2: z.coerce.number().min(0).optional(),
    bandwidth2to1: z.coerce.number().min(0).optional(),
    sourceNodeId: z.string().min(1, 'Node 1 is required.'),
    destinationNodeId: z.string().min(1, 'Node 2 is required.'),
    sourceHandoffType: z.string().optional(),
    destinationHandoffType: z.string().optional(),
    sourceCableNumber: z.string().optional(),
    destinationCableNumber: z.string().optional(),
    sourceEquipmentId: z.string().optional(),
    sourceEquipmentName: z.string().optional(),
    destinationEquipmentId: z.string().optional(),
    destinationEquipmentName: z.string().optional(),
}).refine(data => data.sourceNodeId !== data.destinationNodeId, {
    message: 'Nodes cannot be the same.',
    path: ['destinationNodeId'],
}).refine(data => {
    if (data.sourceEquipmentId === 'new') return !!data.sourceEquipmentName;
    return true;
}, {
    message: 'New Node 1 equipment name is required.',
    path: ['sourceEquipmentName'],
}).refine(data => {
    if (data.destinationEquipmentId === 'new') return !!data.destinationEquipmentName;
    return true;
}, {
    message: 'New Node 2 equipment name is required.',
    path: ['destinationEquipmentName'],
});

export type DataServiceFormValues = z.infer<typeof dataServiceFormSchema>;

const defaultValues: Partial<DataServiceFormValues> = {
    serviceType: 'Data',
    name: '',
    isAsymmetric: false,
    bandwidth: 10,
    sourceNodeId: '',
    destinationNodeId: '',
    sourceHandoffType: 'RJ-45 (Ethernet)',
    destinationHandoffType: 'RJ-45 (Ethernet)',
    sourceCableNumber: '',
    sourceEquipmentId: '',
    sourceEquipmentName: '',
    destinationEquipmentId: '',
    destinationEquipmentName: '',
};

interface AddDataServiceProps {
    serviceToEdit?: Service;
    onFinished?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}

export default function AddDataService({ serviceToEdit, onFinished, onDirtyChange }: AddDataServiceProps) {
    const { activeEvent, activeCircuit, dispatch } = useEvent();
    const isEditMode = !!serviceToEdit;
    const dataServiceToEdit = serviceToEdit as DataService;


    const form = useForm<DataServiceFormValues>({
        resolver: zodResolver(dataServiceFormSchema),
        defaultValues,
        mode: 'onChange',
    });
    const { isDirty, isValid } = form.formState;

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);
    
    useEffect(() => {
        if (isEditMode && dataServiceToEdit) {
            const formVals = {
                ...dataServiceToEdit,
                isAsymmetric: false,
                bandwidth: dataServiceToEdit.bandwidth,
            };
            form.reset(formVals);
        } else {
            form.reset(defaultValues);
        }
    }, [isEditMode, dataServiceToEdit?.id, form]);

    const isAsymmetric = form.watch('isAsymmetric');
    const sourceNodeId = form.watch('sourceNodeId');
    const destinationNodeId = form.watch('destinationNodeId');
    const sourceEquipmentSelection = form.watch('sourceEquipmentId');
    const destinationEquipmentSelection = form.watch('destinationEquipmentId');

    const nodeMap = useMemo(() => {
        if (!activeEvent?.nodes) return new Map();
        return new Map(activeEvent.nodes.map(node => [node.id, node.name]));
    }, [activeEvent]);
    const availableNodes = useMemo(() => {
        if (!activeEvent?.nodes) return [];
        const nodeLookup = new Map(activeEvent.nodes.map(node => [node.id, node]));
        if (!activeCircuit?.nodeIds?.length) return activeEvent.nodes;

        const selectedNodeIds = isEditMode && dataServiceToEdit
            ? getSelectedNodeIdsForEdit(dataServiceToEdit)
            : [];

        const combinedNodeIds = Array.from(new Set([...activeCircuit.nodeIds, ...selectedNodeIds]));
        return combinedNodeIds
            .map(id => nodeLookup.get(id))
            .filter((node): node is NonNullable<typeof node> => !!node);
    }, [activeEvent, activeCircuit, isEditMode, dataServiceToEdit]);

    const sourceEquipment = React.useMemo(() => {
        if (!activeEvent?.equipment || !sourceNodeId) return [];
        return (activeEvent.equipment || []).filter(e => e.nodeId === sourceNodeId || !e.nodeId);
    }, [activeEvent, sourceNodeId]);

    const destinationEquipment = React.useMemo(() => {
        if (!activeEvent?.equipment || !destinationNodeId) return [];
        return (activeEvent.equipment || []).filter(e => e.nodeId === destinationNodeId || !e.nodeId);
    }, [activeEvent, destinationNodeId]);
    
    useEffect(() => {
        if (sourceNodeId && sourceNodeId === form.getValues('destinationNodeId')) {
            form.setValue('destinationNodeId', '');
        }
    }, [sourceNodeId, form]);

    function onSubmit(values: DataServiceFormValues) {
        if (isEditMode && dataServiceToEdit) {
             // Case: converting a symmetric service to an asymmetric pair
            if (!dataServiceToEdit.isAsymmetricLeg && values.isAsymmetric) {
                // 1. Delete original service
                dispatch({ type: 'DELETE_SERVICE', payload: { serviceId: dataServiceToEdit.id } });

                // 2. Add two new asymmetric services
                const nodeMap = new Map((activeEvent?.nodes || []).map(node => [node.id, node.name]));
                const sourceName = nodeMap.get(values.sourceNodeId);
                const destName = nodeMap.get(values.destinationNodeId);
                const baseName = values.name || 'Asymmetric Data';

                const service1Payload = {
                    ...values,
                    name: `${baseName} (${sourceName} -> ${destName})`,
                    bandwidth: values.bandwidth1to2 || 0,
                    isAsymmetricLeg: true,
                };
                dispatch({ type: 'ADD_SERVICE', payload: service1Payload as DataServiceFormValues & { isAsymmetricLeg: boolean } });

                const service2Payload = {
                    ...values,
                    name: `${baseName} (${destName} -> ${sourceName})`,
                    bandwidth: values.bandwidth2to1 || 0,
                    sourceNodeId: values.destinationNodeId,
                    destinationNodeId: values.sourceNodeId,
                    sourceHandoffType: values.destinationHandoffType,
                    destinationHandoffType: values.sourceHandoffType,
                    sourceCableNumber: values.destinationCableNumber,
                    destinationCableNumber: values.sourceCableNumber,
                    sourceEquipmentId: values.destinationEquipmentId,
                    destinationEquipmentId: values.sourceEquipmentId,
                    sourceEquipmentName: values.destinationEquipmentName,
                    destinationEquipmentName: values.sourceEquipmentName,
                    isAsymmetricLeg: true,
                };
                dispatch({ type: 'ADD_SERVICE', payload: service2Payload as DataServiceFormValues & { isAsymmetricLeg: boolean } });
            } else {
                // Case: just updating an existing service (either a symmetric one, or one leg of an asymmetric one)
                const updatedService: DataService = {
                    ...dataServiceToEdit,
                    ...values,
                    bandwidth: values.bandwidth || 0,
                    isAsymmetricLeg: dataServiceToEdit.isAsymmetricLeg, // Preserve original leg status
                };
                dispatch({ type: 'UPDATE_SERVICE', payload: { updatedService } });
            }
        } else {
            if (values.isAsymmetric) {
                const nodeMap = new Map((activeEvent?.nodes || []).map(node => [node.id, node.name]));
                const sourceName = nodeMap.get(values.sourceNodeId);
                const destName = nodeMap.get(values.destinationNodeId);

                const baseName = values.name || 'Asymmetric Data';

                const service1Payload = {
                    ...values,
                    name: `${baseName} (${sourceName} -> ${destName})`,
                    bandwidth: values.bandwidth1to2 || 0,
                    isAsymmetricLeg: true,
                };
                dispatch({ type: 'ADD_SERVICE', payload: service1Payload as DataServiceFormValues & { isAsymmetricLeg: boolean } });

                const service2Payload = {
                    ...values,
                    name: `${baseName} (${destName} -> ${sourceName})`,
                    bandwidth: values.bandwidth2to1 || 0,
                    sourceNodeId: values.destinationNodeId,
                    destinationNodeId: values.sourceNodeId,
                    sourceHandoffType: values.destinationHandoffType,
                    destinationHandoffType: values.sourceHandoffType,
                    sourceCableNumber: values.destinationCableNumber,
                    destinationCableNumber: values.sourceCableNumber,
                    sourceEquipmentId: values.destinationEquipmentId,
                    destinationEquipmentId: values.sourceEquipmentId,
                    sourceEquipmentName: values.destinationEquipmentName,
                    destinationEquipmentName: values.sourceEquipmentName,
                    isAsymmetricLeg: true,
                };
                dispatch({ type: 'ADD_SERVICE', payload: service2Payload as DataServiceFormValues & { isAsymmetricLeg: boolean } });

            } else {
                const payload = { ...values, bandwidth: values.bandwidth || 0, isAsymmetricLeg: false };
                dispatch({ type: 'ADD_SERVICE', payload: payload as DataServiceFormValues & { isAsymmetricLeg: boolean } });
            }
        }
        
        if (onFinished) {
            onFinished();
        } else {
            form.reset(defaultValues);
        }
    }

    if (!activeEvent) return null;

    const destinationNodes = availableNodes.filter(node => node.id !== sourceNodeId);
    const sourceNodeName = nodeMap.get(sourceNodeId) || 'Node 1';
    const destinationNodeName = nodeMap.get(destinationNodeId) || 'Node 2';

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Service Name (Optional)</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Internet Access" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="isAsymmetric"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                    Asymmetric Bandwidth
                                </FormLabel>
                            </div>
                        </FormItem>
                    )}
                />

                {!isAsymmetric ? (
                    <FormField
                        control={form.control}
                        name="bandwidth"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bandwidth (Mbps)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.1" placeholder="e.g., 100" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="bandwidth1to2"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{sourceNodeName} &rarr; {destinationNodeName} (Mbps)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.1" placeholder="e.g., 50" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="bandwidth2to1"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{destinationNodeName} &rarr; {sourceNodeName} (Mbps)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.1" placeholder="e.g., 10" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-medium text-center">Node 1</h3>
                        <FormField
                            control={form.control}
                            name="sourceNodeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Location</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select a node" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {availableNodes.map(node => <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sourceHandoffType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Handoff Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select handoff type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {DATA_HANDOFF_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sourceEquipmentId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Equipment</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!sourceNodeId}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {!isEditMode && <SelectItem value="new">Create new equipment...</SelectItem>}
                                            {sourceEquipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {sourceEquipmentSelection === 'new' && !isEditMode && (
                            <FormField
                                control={form.control}
                                name="sourceEquipmentName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Equipment Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Switch-A Port-1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={form.control}
                            name="sourceCableNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cable Number (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., C-101" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-medium text-center">Node 2</h3>
                        <FormField
                            control={form.control}
                            name="destinationNodeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Location</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!sourceNodeId}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select a node" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {destinationNodes.map(node => <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="destinationHandoffType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Handoff Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select handoff type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {DATA_HANDOFF_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="destinationEquipmentId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Equipment</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!destinationNodeId}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {!isEditMode && <SelectItem value="new">Create new equipment...</SelectItem>}
                                            {destinationEquipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {destinationEquipmentSelection === 'new' && !isEditMode && (
                            <FormField
                                control={form.control}
                                name="destinationEquipmentName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Equipment Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Switch-B Port-1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={form.control}
                            name="destinationCableNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cable Number (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., C-201" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Button type="submit" className="w-full sm:w-auto" disabled={!isValid}>
                    {isEditMode ? 'Save Changes' : <><PlusCircle className="mr-2 h-4 w-4" /> Add Data Service</>}
                </Button>
            </form>
        </Form>
    );
}
