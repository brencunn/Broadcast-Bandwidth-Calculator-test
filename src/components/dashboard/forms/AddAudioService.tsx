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
import { AUDIO_TYPES, HANDOFF_TYPES } from '@/lib/config';
import { AudioService, AudioType, Service } from '@/lib/types';
import React, { useEffect, useMemo } from 'react';
import { MADI_STREAM_BANDWIDTH_MBPS, UNCOMPRESSED_PCM_AUDIO_CHANNEL_BANDWIDTH_MBPS } from '@/lib/config';
import { getAudioEditBaseName, getSelectedNodeIdsForEdit, normalizeAudioType } from '@/lib/serviceEditPrefill';

const audioServiceFormSchema = z.object({
    serviceType: z.literal('Audio'),
    name: z.string().optional(),
    audioType: z.custom<AudioType>(val => AUDIO_TYPES.includes(val as AudioType), 'Invalid audio type'),
    
    node1Id: z.string().min(1, 'Node 1 is required.'),
    node2Id: z.string().min(1, 'Node 2 is required.'),
    
    handoffType1: z.string().optional(),
    cableNumber1: z.string().optional(),
    equipmentId1: z.string().optional(),
    newEquipmentName1: z.string().optional(),
    
    handoffType2: z.string().optional(),
    cableNumber2: z.string().optional(),
    equipmentId2: z.string().optional(),
    newEquipmentName2: z.string().optional(),
    
    channels1to2: z.coerce.number().min(0).optional(),
    channels2to1: z.coerce.number().min(0).optional(),
    bandwidth1to2: z.coerce.number().min(0).optional(),
    bandwidth2to1: z.coerce.number().min(0).optional(),

}).refine(data => data.node1Id !== data.node2Id, {
    message: 'Node 1 and Node 2 cannot be the same.',
    path: ['node2Id'],
}).refine(data => {
    if (data.equipmentId1 === 'new') return !!data.newEquipmentName1;
    return true;
}, {
    message: 'New equipment name for Node 1 is required.',
    path: ['newEquipmentName1'],
}).refine(data => {
    if (data.equipmentId2 === 'new') return !!data.newEquipmentName2;
    return true;
}, {
    message: 'New equipment name for Node 2 is required.',
    path: ['newEquipmentName2'],
}).refine(data => {
    if (data.audioType === 'Manual Input') {
        if (!data.bandwidth1to2 && !data.bandwidth2to1) return false;
        return (data.bandwidth1to2 ?? 0) > 0 || (data.bandwidth2to1 ?? 0) > 0;
    }
    if (!data.channels1to2 && !data.channels2to1) return false;
    return (data.channels1to2 ?? 0) > 0 || (data.channels2to1 ?? 0) > 0;
}, {
    message: 'At least one channel count or bandwidth value must be greater than zero.',
    path: ['channels1to2'],
});


export type AudioServiceFormValues = z.infer<typeof audioServiceFormSchema>;

interface AddAudioServiceProps {
    serviceToEdit?: Service;
    onFinished?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}

export default function AddAudioService({ serviceToEdit, onFinished, onDirtyChange }: AddAudioServiceProps) {
    const { activeEvent, activeCircuit, dispatch } = useEvent();
    const isEditMode = !!serviceToEdit;
    const audioServiceToEdit = serviceToEdit as AudioService;

    const form = useForm<AudioServiceFormValues>({
        resolver: zodResolver(audioServiceFormSchema),
        defaultValues: {
            serviceType: 'Audio',
            name: '',
            audioType: 'AES67 (per channel)',
            node1Id: '',
            node2Id: '',
            handoffType1: 'RJ-45 (Ethernet)',
            handoffType2: 'RJ-45 (Ethernet)',
        },
        mode: 'onChange',
    });
    const { isDirty, isValid } = form.formState;

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        if (isEditMode && audioServiceToEdit) {
            const normalizedAudioType = normalizeAudioType(audioServiceToEdit.audioType);
            const baseName = getAudioEditBaseName(audioServiceToEdit);
            const formVals = {
                serviceType: 'Audio',
                name: baseName,
                audioType: normalizedAudioType,
                
                node1Id: audioServiceToEdit.sourceNodeId,
                node2Id: audioServiceToEdit.destinationNodeId,

                handoffType1: audioServiceToEdit.sourceHandoffType,
                handoffType2: audioServiceToEdit.destinationHandoffType,
                cableNumber1: audioServiceToEdit.sourceCableNumber,
                cableNumber2: audioServiceToEdit.destinationCableNumber,
                equipmentId1: audioServiceToEdit.sourceEquipmentId,
                equipmentId2: audioServiceToEdit.destinationEquipmentId,
                
                channels1to2: audioServiceToEdit.channels,
                bandwidth1to2: audioServiceToEdit.audioType === 'Manual Input' ? audioServiceToEdit.audioBandwidth : undefined,

                channels2to1: undefined,
                bandwidth2to1: undefined,
            };
            form.reset(formVals);
            requestAnimationFrame(() => {
                form.setValue('audioType', formVals.audioType, { shouldValidate: false, shouldDirty: false });
                form.setValue('node1Id', formVals.node1Id, { shouldValidate: false, shouldDirty: false });
                form.setValue('node2Id', formVals.node2Id, { shouldValidate: false, shouldDirty: false });
            });
        } else {
            form.reset({
                serviceType: 'Audio',
                name: '',
                audioType: 'AES67 (per channel)',
                node1Id: '',
                node2Id: '',
                handoffType1: 'RJ-45 (Ethernet)',
                handoffType2: 'RJ-45 (Ethernet)',
            });
        }
    }, [isEditMode, audioServiceToEdit?.id, form]);

    const audioType = form.watch('audioType');
    const node1Id = form.watch('node1Id');
    const node2Id = form.watch('node2Id');
    const equipmentId1 = form.watch('equipmentId1');
    const equipmentId2 = form.watch('equipmentId2');
    
    const nodeMap = useMemo(() => {
        if (!activeEvent?.nodes) return new Map();
        return new Map(activeEvent.nodes.map(node => [node.id, node.name]));
    }, [activeEvent]);
    const availableNodes = useMemo(() => {
        if (!activeEvent?.nodes) return [];
        const nodeLookup = new Map(activeEvent.nodes.map(node => [node.id, node]));
        if (!activeCircuit?.nodeIds?.length) return activeEvent.nodes;

        const selectedNodeIds = isEditMode && audioServiceToEdit
            ? getSelectedNodeIdsForEdit(audioServiceToEdit)
            : [];

        const combinedNodeIds = Array.from(new Set([...activeCircuit.nodeIds, ...selectedNodeIds]));
        return combinedNodeIds
            .map(id => nodeLookup.get(id))
            .filter((node): node is NonNullable<typeof node> => !!node);
    }, [activeEvent, activeCircuit, isEditMode, audioServiceToEdit]);

    const equipmentForNode1 = React.useMemo(() => {
        if (!activeEvent?.equipment || !node1Id) return [];
        return (activeEvent.equipment || []).filter(e => e.nodeId === node1Id || !e.nodeId);
    }, [activeEvent, node1Id]);

    const equipmentForNode2 = React.useMemo(() => {
        if (!activeEvent?.equipment || !node2Id) return [];
        return (activeEvent.equipment || []).filter(e => e.nodeId === node2Id || !e.nodeId);
    }, [activeEvent, node2Id]);
    

    useEffect(() => {
        if (!isEditMode && (audioType === 'AES67 (per channel)' || audioType === 'Dante (per channel)')) {
            form.setValue('handoffType1', 'RJ-45 (Ethernet)');
            form.setValue('handoffType2', 'RJ-45 (Ethernet)');
        }
    }, [audioType, form, isEditMode]);

    useEffect(() => {
        if (node1Id && node1Id === form.getValues('node2Id')) {
            form.setValue('node2Id', '');
        }
    }, [node1Id, form]);

    function onSubmit(values: AudioServiceFormValues) {
        if (isEditMode) {
            let audioBandwidth: number;
            if (values.audioType === 'Manual Input') {
                audioBandwidth = values.bandwidth1to2 || 0;
            } else if (values.audioType === 'MADI (125 Mbps Stream)') {
                audioBandwidth = MADI_STREAM_BANDWIDTH_MBPS;
            } else { // AES67, Dante
                audioBandwidth = (values.channels1to2 || 0) * UNCOMPRESSED_PCM_AUDIO_CHANNEL_BANDWIDTH_MBPS;
            }
            
            const updatedService: AudioService = {
                ...audioServiceToEdit,
                name: values.name || audioServiceToEdit.name,
                audioType: values.audioType,
                bandwidth: audioBandwidth,
                audioBandwidth: audioBandwidth,
                channels: values.channels1to2,
                sourceNodeId: values.node1Id,
                destinationNodeId: values.node2Id,
                sourceHandoffType: values.handoffType1 as AudioType,
                destinationHandoffType: values.handoffType2 as AudioType,
                sourceCableNumber: values.cableNumber1,
                destinationCableNumber: values.cableNumber2,
            };
            dispatch({ type: 'UPDATE_SERVICE', payload: { updatedService } });

        } else {
            const node1Name = nodeMap.get(values.node1Id);
            const node2Name = nodeMap.get(values.node2Id);
            const baseName = values.name || values.audioType;

            const hasFlow1to2 = values.audioType === 'Manual Input' 
                ? (values.bandwidth1to2 ?? 0) > 0 
                : (values.channels1to2 ?? 0) > 0;

            if (hasFlow1to2) {
                dispatch({ type: 'ADD_SERVICE', payload: {
                    ...values,
                    name: `${baseName} (${node1Name} -> ${node2Name})`,
                    serviceType: 'Audio',
                    sourceNodeId: values.node1Id,
                    destinationNodeId: values.node2Id,
                    sourceHandoffType: values.handoffType1,
                    destinationHandoffType: values.handoffType2,
                    sourceCableNumber: values.cableNumber1,
                    destinationCableNumber: values.cableNumber2,
                    sourceEquipmentId: values.equipmentId1,
                    sourceEquipmentName: values.newEquipmentName1,
                    destinationEquipmentId: values.equipmentId2,
                    destinationEquipmentName: values.newEquipmentName2,
                    channels: values.channels1to2,
                    bandwidth: values.bandwidth1to2,
                }});
            }

            const hasFlow2to1 = values.audioType === 'Manual Input' 
                ? (values.bandwidth2to1 ?? 0) > 0 
                : (values.channels2to1 ?? 0) > 0;
                
            if (hasFlow2to1) {
                dispatch({ type: 'ADD_SERVICE', payload: {
                    ...values,
                    name: `${baseName} (${node2Name} -> ${node1Name})`,
                    serviceType: 'Audio',
                    sourceNodeId: values.node2Id,
                    destinationNodeId: values.node1Id,
                    sourceHandoffType: values.handoffType2,
                    destinationHandoffType: values.handoffType1,
                    sourceCableNumber: values.cableNumber2,
                    destinationCableNumber: values.cableNumber1,
                    sourceEquipmentId: values.equipmentId2,
                    sourceEquipmentName: values.newEquipmentName2,
                    destinationEquipmentId: values.equipmentId1,
                    destinationEquipmentName: values.newEquipmentName1,
                    channels: values.channels2to1,
                    bandwidth: values.bandwidth2to1,
                }});
            }
        }
        
        if (onFinished) {
            onFinished();
        } else {
            form.reset({
                serviceType: 'Audio',
                name: '',
                audioType: 'AES67 (per channel)',
                node1Id: '',
                node2Id: '',
                handoffType1: 'RJ-45 (Ethernet)',
                handoffType2: 'RJ-45 (Ethernet)',
            });
        }
    }

    if (!activeEvent) return null;

    const destinationNodes = availableNodes.filter(node => node.id !== node1Id);
    const node1Name = nodeMap.get(node1Id) || 'Node 1';
    const node2Name = nodeMap.get(node2Id) || 'Node 2';

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
                                <Input placeholder="e.g., Program Audio" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="audioType"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Audio Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {AUDIO_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-medium text-center">Node 1</h3>
                        <FormField
                            control={form.control}
                            name="node1Id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Location</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select node 1" /></SelectTrigger>
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
                            name="handoffType1"
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
                            name="equipmentId1"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Equipment</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!node1Id}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {!isEditMode && <SelectItem value="new">Create new equipment...</SelectItem>}
                                            {equipmentForNode1.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {equipmentId1 === 'new' && !isEditMode && (
                            <FormField
                                control={form.control}
                                name="newEquipmentName1"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Equipment Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Audio-Out-1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={form.control}
                            name="cableNumber1"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cable Number (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., C-101" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {audioType === 'Manual Input' ? (
                            <FormField
                                control={form.control}
                                name="bandwidth1to2"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bandwidth to {node2Name} (Mbps)</FormLabel>
                                    <FormControl><Input type="number" step="0.1" placeholder="e.g., 10" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        ) : (
                            <FormField
                                control={form.control}
                                name="channels1to2"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Channels to {node2Name}</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 8" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}
                    </div>
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-medium text-center">Node 2</h3>
                        <FormField
                            control={form.control}
                            name="node2Id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Location</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!node1Id}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select node 2" /></SelectTrigger>
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
                            name="handoffType2"
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
                            name="equipmentId2"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Equipment</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!node2Id}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {!isEditMode && <SelectItem value="new">Create new equipment...</SelectItem>}
                                            {equipmentForNode2.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {equipmentId2 === 'new' && !isEditMode && (
                            <FormField
                                control={form.control}
                                name="newEquipmentName2"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Equipment Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Audio-In-1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={form.control}
                            name="cableNumber2"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cable Number (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., C-201" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         {audioType === 'Manual Input' ? (
                            <FormField
                                control={form.control}
                                name="bandwidth2to1"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bandwidth to {node1Name} (Mbps)</FormLabel>
                                    <FormControl><Input type="number" step="0.1" placeholder="e.g., 2" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        ) : (
                            <FormField
                                control={form.control}
                                name="channels2to1"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Channels to {node1Name}</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 2" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}
                    </div>
                </div>

                <Button type="submit" className="w-full sm:w-auto" disabled={!isValid}>
                    {isEditMode ? 'Save Changes' : <><PlusCircle className="mr-2 h-4 w-4" /> Add Audio Service</>}
                </Button>
            </form>
        </Form>
    );
}
