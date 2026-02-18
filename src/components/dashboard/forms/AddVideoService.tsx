'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEvent } from '@/context/EventContext';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Pencil } from 'lucide-react';
import { UNCOMPRESSED_PCM_AUDIO_CHANNEL_BANDWIDTH_MBPS, COMPRESSED_AUDIO_BITRATES_KBPS, HANDOFF_TYPES, VIDEO_CODEC_TYPES, VIDEO_MANUAL_DEFAULTS } from '@/lib/config';
import type { AudioLayoutTrack, VideoCodec, Service, VideoService } from '@/lib/types';
import React, { useEffect, useMemo, useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getSelectedNodeIdsForEdit, getServiceNodeIds, normalizeVideoCodec } from '@/lib/serviceEditPrefill';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MAX_AUDIO_TRACKS = 16;

const createDefaultAudioLayout = (): AudioLayoutTrack[] =>
    Array.from({ length: MAX_AUDIO_TRACKS }, (_, index) => {
        const track = index + 1;
        const level = Math.ceil(track / 2);
        const group = Math.ceil(level / 2);
        return {
            track,
            level,
            group,
            content: '',
            notes: '',
        };
    });

const normalizeAudioLayout = (incoming?: AudioLayoutTrack[]): AudioLayoutTrack[] => {
    const defaults = createDefaultAudioLayout();
    if (!incoming?.length) return defaults;
    return defaults.map((defaultRow) => {
        const match = incoming.find((row) => row.track === defaultRow.track);
        if (!match) return defaultRow;
        return {
            ...defaultRow,
            content: match.content ?? '',
            notes: match.notes ?? '',
        };
    });
};

const videoServiceFormSchema = z.object({
    serviceType: z.literal('Video'),
    name: z.string().optional(),
    sourceNodeId: z.string().min(1, 'Source is required.'),
    destinationNodeId: z.string().min(1, 'Destination is required.'),
    sourceHandoffType: z.string().optional(),
    destinationHandoffType: z.string().optional(),
    sourceCableNumber: z.string().optional(),
    destinationCableNumber: z.string().optional(),
    codec: z.custom<VideoCodec>(val => VIDEO_CODEC_TYPES.includes(val as VideoCodec), 'Invalid codec'),
    sourceEquipmentId: z.string().optional(),
    sourceEquipmentName: z.string().optional(),
    destinationEquipmentId: z.string().optional(),
    destinationEquipmentName: z.string().optional(),

    bitrateMode: z.enum(['video', 'transport']).default('video'),
    videoBandwidth: z.coerce.number().min(0).optional(),
    transportStreamBandwidth: z.coerce.number().min(0).optional(),

    audioChannels: z.coerce.number().min(0, "Cannot be negative.").default(16),
    audioMode: z.enum(['calculated', 'manual']).default('calculated'),
    manualAudioChannels: z.coerce.number().min(0).optional(),
    manualAudioBitrateKbps: z.coerce.number().min(0).optional(),
    audioLayout: z.array(
        z.object({
            track: z.coerce.number().int().min(1).max(MAX_AUDIO_TRACKS),
            level: z.coerce.number().int().min(1).max(8),
            group: z.coerce.number().int().min(1).max(4),
            content: z.string().default(''),
            notes: z.string().optional(),
        })
    ).length(MAX_AUDIO_TRACKS),

}).refine(data => data.sourceNodeId !== data.destinationNodeId, {
    message: 'Source and Destination cannot be the same.',
    path: ['destinationNodeId'],
}).refine(data => {
    if (data.sourceEquipmentId === 'new') return !!data.sourceEquipmentName;
    return true;
}, {
    message: 'New source equipment name is required.',
    path: ['sourceEquipmentName'],
}).refine(data => {
    if (data.destinationEquipmentId === 'new') return !!data.destinationEquipmentName;
    return true;
}, {
    message: 'New destination equipment name is required.',
    path: ['destinationEquipmentName'],
});


export type VideoServiceFormValues = z.infer<typeof videoServiceFormSchema>;

interface AddVideoServiceProps {
    serviceToEdit?: Service;
    onFinished?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}

export default function AddVideoService({ serviceToEdit, onFinished, onDirtyChange }: AddVideoServiceProps) {
    const { activeEvent, activeCircuit, dispatch, lastJpegXsBitrate } = useEvent();
    const isEditMode = !!serviceToEdit;
    const videoServiceToEdit = serviceToEdit as VideoService;
    const [audioLayoutDialogOpen, setAudioLayoutDialogOpen] = useState(false);
    const [audioLayoutDraft, setAudioLayoutDraft] = useState<AudioLayoutTrack[]>(createDefaultAudioLayout());
    
    const defaultValues = useMemo<VideoServiceFormValues>(() => ({
        serviceType: 'Video',
        name: '',
        codec: 'JPEG-XS',
        audioChannels: 16,
        sourceNodeId: '',
        destinationNodeId: '',
        sourceHandoffType: 'BNC (Coaxial)',
        destinationHandoffType: 'BNC (Coaxial)',
        sourceCableNumber: '',
        destinationCableNumber: '',
        sourceEquipmentId: '',
        sourceEquipmentName: '',
        destinationEquipmentId: '',
        destinationEquipmentName: '',
        bitrateMode: 'video',
        videoBandwidth: lastJpegXsBitrate ?? 150,
        audioMode: 'calculated',
        manualAudioChannels: 2,
        manualAudioBitrateKbps: 128,
        audioLayout: createDefaultAudioLayout(),
    }), [lastJpegXsBitrate]);

    const form = useForm<VideoServiceFormValues>({
        resolver: zodResolver(videoServiceFormSchema),
        defaultValues,
        mode: 'onChange',
    });
    const { isDirty, isValid } = form.formState;

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        if (isEditMode && videoServiceToEdit) {
            const serviceAny = videoServiceToEdit as VideoService & {
                node1Id?: string;
                node2Id?: string;
                handoffType1?: string;
                handoffType2?: string;
                cableNumber1?: string;
                cableNumber2?: string;
                equipmentId1?: string;
                equipmentId2?: string;
            };

            const { sourceNodeId, destinationNodeId } = getServiceNodeIds(serviceAny);
            const normalizedCodec = normalizeVideoCodec(serviceAny.codec);

            const formVals: VideoServiceFormValues = {
                ...defaultValues,
                name: videoServiceToEdit.name,
                codec: normalizedCodec,
                sourceNodeId,
                destinationNodeId,
                sourceHandoffType: videoServiceToEdit.sourceHandoffType || serviceAny.handoffType1 || defaultValues.sourceHandoffType,
                destinationHandoffType: videoServiceToEdit.destinationHandoffType || serviceAny.handoffType2 || defaultValues.destinationHandoffType,
                sourceCableNumber: videoServiceToEdit.sourceCableNumber || serviceAny.cableNumber1 || '',
                destinationCableNumber: videoServiceToEdit.destinationCableNumber || serviceAny.cableNumber2 || '',
                sourceEquipmentId: videoServiceToEdit.sourceEquipmentId || serviceAny.equipmentId1 || '',
                destinationEquipmentId: videoServiceToEdit.destinationEquipmentId || serviceAny.equipmentId2 || '',
                audioMode: videoServiceToEdit.compressedAudio ? 'manual' : 'calculated',
                manualAudioChannels: videoServiceToEdit.compressedAudio?.channels,
                manualAudioBitrateKbps: videoServiceToEdit.compressedAudio?.bitratePerChannelKbps,
                audioChannels: videoServiceToEdit.audioChannels,
                audioLayout: normalizeAudioLayout(videoServiceToEdit.audioLayout),
                bitrateMode: videoServiceToEdit.bitrateMode ?? 'video',
                videoBandwidth: videoServiceToEdit.videoBandwidth,
                transportStreamBandwidth: undefined,
                serviceType: 'Video',
            };

            if ((videoServiceToEdit.bitrateMode ?? 'video') === 'transport') {
                formVals.transportStreamBandwidth = videoServiceToEdit.bandwidth;
                formVals.videoBandwidth = undefined;
            }
            
            form.reset(formVals);
            // Force-select critical fields after reset to avoid race conditions
            // with controlled Select components during dialog mount.
            requestAnimationFrame(() => {
                form.setValue('codec', formVals.codec, { shouldValidate: false, shouldDirty: false });
                form.setValue('sourceNodeId', formVals.sourceNodeId, { shouldValidate: false, shouldDirty: false });
                form.setValue('destinationNodeId', formVals.destinationNodeId, { shouldValidate: false, shouldDirty: false });
            });
        } else if (!isEditMode) {
            form.setValue('audioLayout', createDefaultAudioLayout(), { shouldValidate: false, shouldDirty: false });
        }
    }, [isEditMode, videoServiceToEdit?.id, form, defaultValues]);

    const codec = form.watch('codec');
    const bitrateMode = form.watch('bitrateMode');
    const audioMode = form.watch('audioMode');
    const audioChannels = form.watch('audioChannels');
    const manualAudioChannels = form.watch('manualAudioChannels');
    const sourceNodeId = form.watch('sourceNodeId');
    const destinationNodeId = form.watch('destinationNodeId');
    const sourceEquipmentSelection = form.watch('sourceEquipmentId');
    const destinationEquipmentSelection = form.watch('destinationEquipmentId');
    const audioLayout = form.watch('audioLayout');
    const activeAudioChannels = Math.max(
        0,
        Math.min(MAX_AUDIO_TRACKS, Math.floor(audioMode === 'manual' ? (manualAudioChannels ?? 0) : (audioChannels ?? 0)))
    );

    const openAudioLayoutDialog = () => {
        setAudioLayoutDraft(normalizeAudioLayout(audioLayout));
        setAudioLayoutDialogOpen(true);
    };

    const updateAudioLayoutDraft = (track: number, field: 'content' | 'notes', value: string) => {
        setAudioLayoutDraft((current) =>
            current.map((row) => (row.track === track ? { ...row, [field]: value } : row))
        );
    };

    const handleAudioLayoutSave = () => {
        form.setValue('audioLayout', normalizeAudioLayout(audioLayoutDraft), {
            shouldDirty: true,
            shouldValidate: false,
        });
        setAudioLayoutDialogOpen(false);
    };

    const sourceEquipment = React.useMemo(() => {
        if (!activeEvent?.equipment || !sourceNodeId) return [];
        return (activeEvent.equipment || []).filter(e => e.nodeId === sourceNodeId || !e.nodeId);
    }, [activeEvent, sourceNodeId]);

    const destinationEquipment = React.useMemo(() => {
        if (!activeEvent?.equipment || !destinationNodeId) return [];
        return (activeEvent.equipment || []).filter(e => e.nodeId === destinationNodeId || !e.nodeId);
    }, [activeEvent, destinationNodeId]);


    useEffect(() => {
        if (!isEditMode && codec !== 'JPEG-XS') {
             const defaultBw = VIDEO_MANUAL_DEFAULTS[codec as keyof typeof VIDEO_MANUAL_DEFAULTS] ?? 20;
             form.setValue('bitrateMode', 'video');
             form.setValue('videoBandwidth', defaultBw);
             form.setValue('transportStreamBandwidth', undefined);
        } else if (!isEditMode && codec === 'JPEG-XS') {
            if (form.getValues('bitrateMode') === 'video') {
                form.setValue('videoBandwidth', lastJpegXsBitrate ?? 150);
            }
        }
    }, [codec, form, lastJpegXsBitrate, isEditMode]);
    
    useEffect(() => {
        if (bitrateMode === 'video') {
            form.setValue('transportStreamBandwidth', undefined);
            form.trigger('videoBandwidth');
        } else { // 'transport'
            form.setValue('videoBandwidth', undefined);
            form.trigger('transportStreamBandwidth');
        }
    }, [bitrateMode, form]);


    useEffect(() => {
        if (sourceNodeId && sourceNodeId === form.getValues('destinationNodeId')) {
            form.setValue('destinationNodeId', '');
        }
    }, [sourceNodeId, form]);

    function onSubmit(values: VideoServiceFormValues) {
        if (isEditMode) {
             let audioBwForCalc = 0;
            let compressedAudioConfig: VideoService['compressedAudio'] | undefined = undefined;

            if (values.audioMode === 'manual') {
                const channels = values.manualAudioChannels!;
                const bitrateKbps = values.manualAudioBitrateKbps!;
                audioBwForCalc = (channels * bitrateKbps) / 1000;
                compressedAudioConfig = { channels, bitratePerChannelKbps: bitrateKbps };
            } else {
                audioBwForCalc = (values.audioChannels || 0) * UNCOMPRESSED_PCM_AUDIO_CHANNEL_BANDWIDTH_MBPS;
            }

            let calculatedVideoBandwidth: number;
            if (values.bitrateMode === 'transport') {
                calculatedVideoBandwidth = (values.transportStreamBandwidth || 0) - audioBwForCalc;
            } else {
                calculatedVideoBandwidth = values.videoBandwidth || 0;
            }
            
            const totalBandwidth = calculatedVideoBandwidth + audioBwForCalc;

            const updatedService: VideoService = {
                ...videoServiceToEdit,
                ...values,
                bandwidth: totalBandwidth > 0 ? totalBandwidth : 0,
                videoBandwidth: calculatedVideoBandwidth > 0 ? calculatedVideoBandwidth : 0,
                audioBitrate: audioBwForCalc,
                compressedAudio: compressedAudioConfig,
            };
            dispatch({ type: 'UPDATE_SERVICE', payload: { updatedService } });
        } else {
            dispatch({ type: 'ADD_SERVICE', payload: values });
        }

        if (onFinished) {
            onFinished();
        } else {
            form.reset({
                serviceType: 'Video', name: '', codec: 'JPEG-XS', audioChannels: 16, sourceNodeId: '',
                destinationNodeId: '', sourceHandoffType: 'BNC (Coaxial)', destinationHandoffType: 'BNC (Coaxial)',
                sourceCableNumber: '', destinationCableNumber: '', sourceEquipmentId: '', sourceEquipmentName: '',
                destinationEquipmentId: '', destinationEquipmentName: '', bitrateMode: 'video',
                videoBandwidth: lastJpegXsBitrate ?? 150, audioMode: 'calculated', manualAudioChannels: 2,
                manualAudioBitrateKbps: 128, audioLayout: createDefaultAudioLayout()
            });
        }
    }

    if (!activeEvent) return null;

    const availableNodes = React.useMemo(() => {
        if (!activeEvent?.nodes) return [];
        const nodeMap = new Map(activeEvent.nodes.map(node => [node.id, node]));
        if (!activeCircuit?.nodeIds?.length) return activeEvent.nodes;

        const selectedNodeIds = isEditMode && videoServiceToEdit
            ? getSelectedNodeIdsForEdit(videoServiceToEdit as VideoService & { node1Id?: string; node2Id?: string })
            : [];

        const combinedNodeIds = Array.from(new Set([...activeCircuit.nodeIds, ...selectedNodeIds]));
        return combinedNodeIds
            .map(id => nodeMap.get(id))
            .filter((node): node is NonNullable<typeof node> => !!node);
    }, [activeEvent, activeCircuit, isEditMode, videoServiceToEdit]);
    const destinationNodes = availableNodes.filter(node => node.id !== sourceNodeId);

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
                                <Input placeholder="Auto-generated if blank" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="codec"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Video Codec</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {VIDEO_CODEC_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="space-y-4 rounded-md border p-4">
                    <FormField
                        control={form.control}
                        name="bitrateMode"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>Bandwidth Input Mode</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        className="flex flex-col space-y-2"
                                    >
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl><RadioGroupItem value="video" /></FormControl>
                                            <FormLabel className="font-normal">Specify Video Bitrate</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl><RadioGroupItem value="transport" /></FormControl>
                                            <FormLabel className="font-normal">Specify Total Transport Stream Bitrate</FormLabel>
                                        </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    {bitrateMode === 'video' && (
                        <FormField
                            control={form.control}
                            name="videoBandwidth"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Video Bandwidth (Mbps)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.1" {...field} value={field.value ?? ''}/>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                    
                    {bitrateMode === 'transport' && (
                        <FormField
                            control={form.control}
                            name="transportStreamBandwidth"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Transport Stream Bandwidth (Mbps)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.1" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                </div>
                
                <div className="space-y-4 rounded-md border p-4">
                    <FormLabel>Audio Configuration</FormLabel>
                    <>
                        <FormField
                            control={form.control}
                            name="audioMode"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="flex flex-col space-y-2"
                                        >
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl><RadioGroupItem value="calculated" /></FormControl>
                                                <FormLabel className="font-normal">Calculated (Uncompressed)</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl><RadioGroupItem value="manual" /></FormControl>
                                                <FormLabel className="font-normal">Manual Bitrate (Compressed)</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {audioMode === 'calculated' && (
                            <FormField
                                control={form.control}
                                name="audioChannels"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Embedded Audio Channels</FormLabel>
                                        <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        {audioMode === 'manual' && (
                            <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                    control={form.control}
                                    name="manualAudioChannels"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Audio Channels</FormLabel>
                                            <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="manualAudioBitrateKbps"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Bitrate (per ch)</FormLabel>
                                                <Select onValueChange={(v) => field.onChange(parseInt(v, 10))} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="kbps" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {COMPRESSED_AUDIO_BITRATES_KBPS.map(rate => <SelectItem key={rate} value={rate.toString()}>{rate} kbps</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                            <div>
                                <p className="text-sm font-medium">Embedded Audio Layout</p>
                                <p className="text-xs text-muted-foreground">
                                    {activeAudioChannels > 0
                                        ? `Tracks 1-${activeAudioChannels} editable.`
                                        : 'No editable tracks until channel count is above 0.'}
                                    {activeAudioChannels < MAX_AUDIO_TRACKS
                                        ? ` Tracks ${activeAudioChannels + 1}-${MAX_AUDIO_TRACKS} are locked.`
                                        : ''}
                                </p>
                            </div>
                            <Button type="button" variant="outline" onClick={openAudioLayoutDialog}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Audio Layout
                            </Button>
                        </div>
                    </>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-medium text-center">Source</h3>
                        <FormField
                            control={form.control}
                            name="sourceNodeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Location</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select a source" /></SelectTrigger>
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
                                            {HANDOFF_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
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
                                            <Input placeholder="e.g., Encoder 1" {...field} />
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
                        <h3 className="font-medium text-center">Destination</h3>
                        <FormField
                            control={form.control}
                            name="destinationNodeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Location</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!sourceNodeId}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select a destination" /></SelectTrigger>
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
                                            {HANDOFF_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
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
                                            <Input placeholder="e.g., Decoder 1" {...field} />
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
                    {isEditMode ? 'Save Changes' : <><PlusCircle className="mr-2 h-4 w-4" /> Add Video Service</>}
                </Button>
            </form>

            <Dialog open={audioLayoutDialogOpen} onOpenChange={setAudioLayoutDialogOpen}>
                <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Audio Layout</DialogTitle>
                        <DialogDescription>
                            Configure embedded audio tracks for this video service.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">Group</TableHead>
                                    <TableHead className="w-16">Level</TableHead>
                                    <TableHead className="w-16">Track</TableHead>
                                    <TableHead>Content</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {audioLayoutDraft.map((row, index) => {
                                    const disabled = row.track > activeAudioChannels;
                                    const prevRow = index > 0 ? audioLayoutDraft[index - 1] : null;
                                    const isFirstGroupRow = !prevRow || prevRow.group !== row.group;
                                    const isFirstLevelRow = !prevRow || prevRow.level !== row.level;
                                    const groupRowSpan = isFirstGroupRow
                                        ? audioLayoutDraft.filter((candidate) => candidate.group === row.group).length
                                        : 0;
                                    const levelRowSpan = isFirstLevelRow
                                        ? audioLayoutDraft.filter((candidate) => candidate.level === row.level).length
                                        : 0;
                                    return (
                                        <TableRow key={row.track} className={disabled ? 'bg-muted/50' : ''}>
                                            {isFirstGroupRow && (
                                                <TableCell rowSpan={groupRowSpan} className="font-mono align-middle">
                                                    {row.group}
                                                </TableCell>
                                            )}
                                            {isFirstLevelRow && (
                                                <TableCell rowSpan={levelRowSpan} className="font-mono align-middle">
                                                    {row.level}
                                                </TableCell>
                                            )}
                                            <TableCell className="font-mono">{row.track}</TableCell>
                                            <TableCell>
                                                <Input
                                                    value={row.content}
                                                    onChange={(e) => updateAudioLayoutDraft(row.track, 'content', e.target.value)}
                                                    disabled={disabled}
                                                    placeholder={disabled ? 'Locked' : 'e.g. Host TVIS L'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={row.notes ?? ''}
                                                    onChange={(e) => updateAudioLayoutDraft(row.track, 'notes', e.target.value)}
                                                    disabled={disabled}
                                                    placeholder={disabled ? 'Locked' : 'Optional notes'}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAudioLayoutDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleAudioLayoutSave}>
                            Save layout
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Form>
    );
}
