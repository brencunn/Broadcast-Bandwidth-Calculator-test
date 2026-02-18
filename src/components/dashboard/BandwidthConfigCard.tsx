'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEvent } from '@/context/EventContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bandwidthUnits, BandwidthUnit, Segment } from '@/lib/types';
import { convertBandwidthToMbps } from '@/lib/utils';
import React, { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const SegmentConfigForm = ({ segment, node1Name, node2Name }: { segment: Segment, node1Name: string, node2Name: string }) => {
    const { dispatch } = useEvent();
    const [formState, setFormState] = useState(segment);
    const debouncedState = useDebounce(formState, 500);

    const validationErrors = React.useMemo(() => {
        const errors: Record<string, string> = {};
        const parseNumber = (value: string) => {
            if (value === '' || value === undefined || value === null) return null;
            const num = Number(value);
            return Number.isNaN(num) ? null : num;
        };

        const max1to2Raw = parseNumber(formState.maxBandwidth1to2Input);
        const max2to1Raw = parseNumber(formState.maxBandwidth2to1Input);
        const soft1to2Raw = parseNumber(formState.softLimit1to2MbpsInput);
        const soft2to1Raw = parseNumber(formState.softLimit2to1MbpsInput);

        if (max1to2Raw === null) errors.maxBandwidth1to2Input = 'Max bandwidth is required.';
        if (max2to1Raw === null) errors.maxBandwidth2to1Input = 'Max bandwidth is required.';
        if (soft1to2Raw === null) errors.softLimit1to2MbpsInput = 'Soft limit is required.';
        if (soft2to1Raw === null) errors.softLimit2to1MbpsInput = 'Soft limit is required.';

        if (max1to2Raw !== null && max1to2Raw < 0) errors.maxBandwidth1to2Input = 'Must be 0 or greater.';
        if (max2to1Raw !== null && max2to1Raw < 0) errors.maxBandwidth2to1Input = 'Must be 0 or greater.';
        if (soft1to2Raw !== null && soft1to2Raw < 0) errors.softLimit1to2MbpsInput = 'Must be 0 or greater.';
        if (soft2to1Raw !== null && soft2to1Raw < 0) errors.softLimit2to1MbpsInput = 'Must be 0 or greater.';

        if (max1to2Raw !== null && soft1to2Raw !== null) {
            const max1to2Mbps = convertBandwidthToMbps(max1to2Raw, formState.maxBandwidth1to2Unit);
            if (soft1to2Raw > max1to2Mbps) {
                errors.softLimit1to2MbpsInput = 'Soft limit cannot exceed max bandwidth.';
            }
        }

        if (max2to1Raw !== null && soft2to1Raw !== null) {
            const max2to1Mbps = convertBandwidthToMbps(max2to1Raw, formState.maxBandwidth2to1Unit);
            if (soft2to1Raw > max2to1Mbps) {
                errors.softLimit2to1MbpsInput = 'Soft limit cannot exceed max bandwidth.';
            }
        }

        return errors;
    }, [formState]);

    useEffect(() => {
        // Only dispatch if debounced state is different from the original segment props
        // to avoid unnecessary re-renders and dispatches on component mount.
        if (Object.keys(validationErrors).length > 0) return;
        if (JSON.stringify(debouncedState) !== JSON.stringify(segment)) {
            dispatch({ type: 'UPDATE_SEGMENT', payload: { segmentId: segment.id, newValues: debouncedState } });
        }
    }, [debouncedState, dispatch, segment.id, segment, validationErrors]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormState(prev => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleUnitChange = (name: string, value: BandwidthUnit) => {
        setFormState(prev => ({...prev, [name]: value}));
    };
    
    return (
        <div className="space-y-6">
            <div>
                <h4 className="font-medium mb-3 text-center">{node1Name} &rarr; {node2Name}</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`maxBandwidth1to2Input-${segment.id}`}>Max Bandwidth</Label>
                        <div className="flex gap-1">
                            <Input
                                id={`maxBandwidth1to2Input-${segment.id}`}
                                name="maxBandwidth1to2Input"
                                value={formState.maxBandwidth1to2Input}
                                onChange={handleChange}
                                type="number"
                                min={0}
                                placeholder="e.g., 1000"
                            />
                            <Select name="maxBandwidth1to2Unit" value={formState.maxBandwidth1to2Unit} onValueChange={(v) => handleUnitChange("maxBandwidth1to2Unit", v as BandwidthUnit)}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    {bandwidthUnits.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {validationErrors.maxBandwidth1to2Input && (
                            <p className="text-sm text-destructive">{validationErrors.maxBandwidth1to2Input}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`softLimit1to2MbpsInput-${segment.id}`}>Soft Limit (Mbps)</Label>
                        <Input
                            id={`softLimit1to2MbpsInput-${segment.id}`}
                            name="softLimit1to2MbpsInput"
                            value={formState.softLimit1to2MbpsInput}
                            onChange={handleChange}
                            type="number"
                            min={0}
                            placeholder="e.g., 800"
                        />
                        {validationErrors.softLimit1to2MbpsInput && (
                            <p className="text-sm text-destructive">{validationErrors.softLimit1to2MbpsInput}</p>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <h4 className="font-medium mb-3 text-center">{node2Name} &rarr; {node1Name}</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`maxBandwidth2to1Input-${segment.id}`}>Max Bandwidth</Label>
                        <div className="flex gap-1">
                            <Input
                                id={`maxBandwidth2to1Input-${segment.id}`}
                                name="maxBandwidth2to1Input"
                                value={formState.maxBandwidth2to1Input}
                                onChange={handleChange}
                                type="number"
                                min={0}
                                placeholder="e.g., 1000"
                            />
                             <Select name="maxBandwidth2to1Unit" value={formState.maxBandwidth2to1Unit} onValueChange={(v) => handleUnitChange("maxBandwidth2to1Unit", v as BandwidthUnit)}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    {bandwidthUnits.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {validationErrors.maxBandwidth2to1Input && (
                            <p className="text-sm text-destructive">{validationErrors.maxBandwidth2to1Input}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`softLimit2to1MbpsInput-${segment.id}`}>Soft Limit (Mbps)</Label>
                        <Input
                            id={`softLimit2to1MbpsInput-${segment.id}`}
                            name="softLimit2to1MbpsInput"
                            value={formState.softLimit2to1MbpsInput}
                            onChange={handleChange}
                            type="number"
                            min={0}
                            placeholder="e.g., 800"
                        />
                        {validationErrors.softLimit2to1MbpsInput && (
                            <p className="text-sm text-destructive">{validationErrors.softLimit2to1MbpsInput}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function BandwidthConfigCard() {
    const { activeCircuit: circuit, activeEvent } = useEvent();
    const [activeTab, setActiveTab] = useState<string | undefined>();

    useEffect(() => {
        // Set the active tab to the first segment when the circuit changes.
        // This ensures the Tabs component is controlled and renders its content
        // correctly, even when inside a default-open Accordion.
        setActiveTab(circuit?.segments[0]?.id);
    }, [circuit]);

    if (!circuit || !activeEvent) return null;

    const nodeMap = new Map((activeEvent.nodes || []).map(node => [node.id, node.name]));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bandwidth Limits</CardTitle>
                <CardDescription>Configure the maximum and soft limits for each segment of your circuit.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Show/Hide Configuration</AccordionTrigger>
                        <AccordionContent>
                            {circuit.segments.length > 0 ? (
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-4">
                                    <TabsList className="grid w-full grid-cols-1 md:grid-cols-2">
                                        {circuit.segments.map(segment => {
                                            const node1Name = nodeMap.get(segment.node1Id) ?? 'N/A';
                                            const node2Name = nodeMap.get(segment.node2Id) ?? 'N/A';
                                            return (
                                                <TabsTrigger key={segment.id} value={segment.id}>{node1Name} &harr; {node2Name}</TabsTrigger>
                                            );
                                        })}
                                    </TabsList>
                                    {circuit.segments.map(segment => {
                                        const node1Name = nodeMap.get(segment.node1Id) ?? 'N/A';
                                        const node2Name = nodeMap.get(segment.node2Id) ?? 'N/A';
                                        return (
                                            <TabsContent key={segment.id} value={segment.id} className="pt-4">
                                            <SegmentConfigForm segment={segment} node1Name={node1Name} node2Name={node2Name} />
                                            </TabsContent>
                                        )
                                    })}
                                </Tabs>
                            ) : (
                                <p className="text-muted-foreground text-center pt-4">This circuit has no segments to configure.</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
}
