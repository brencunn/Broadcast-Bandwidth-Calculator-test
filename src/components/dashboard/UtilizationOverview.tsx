'use client';

import { useEvent } from '@/context/EventContext';
import { useMemo } from 'react';
import UtilisationCard from './UtilizationCard';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CircuitDiagram from './CircuitDiagram';
import { Separator } from '@/components/ui/separator';
import { calculateAllEventMetrics } from '@/lib/utils';
import { cn } from '@/lib/utils';
  

export default function UtilisationOverview() {
    const { activeCircuit, activeEvent } = useEvent();

    const { segmentUtils } = useMemo(() => {
        if (!activeEvent) return { segmentUtils: new Map() };
        return calculateAllEventMetrics(activeEvent);
    }, [activeEvent]);

    if (!activeCircuit || !activeEvent) return null;

    const nodeMap = new Map((activeEvent.nodes || []).map(node => [node.id, node.name]));
    const isTwoNodeCircuit = (activeCircuit.nodeIds || []).length === 2;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Utilisation Overview</CardTitle>
                <CardDescription>Segment-specific utilisation for the selected circuit and a network weathermap for the entire event.</CardDescription>
            </CardHeader>
            <CardContent>
                <h3 className="text-lg font-medium mb-4">Segment Utilisation</h3>
                {(activeCircuit.segments || []).length > 0 ? (
                    <div className={cn(
                        "grid gap-6",
                        isTwoNodeCircuit ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
                    )}>
                        {(activeCircuit.segments || []).map((segment) => {
                            const segmentUtil = segmentUtils?.get(segment.id);
                            const utilForCard = segmentUtil ? { segmentId: segment.id, ...segmentUtil } : undefined;
                            const node1Name = nodeMap.get(segment.node1Id) ?? 'N/A';
                            const node2Name = nodeMap.get(segment.node2Id) ?? 'N/A';

                            return (
                                <UtilisationCard
                                    key={segment.id}
                                    segment={segment}
                                    utilisation={utilForCard}
                                    node1Name={node1Name}
                                    node2Name={node2Name}
                                    layout={isTwoNodeCircuit ? 'side-by-side' : 'stacked'}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-muted-foreground">No segments defined for this circuit.</p>
                )}

                <Separator className="my-6" />
                
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Show/Hide Network Weathermap</AccordionTrigger>
                        <AccordionContent>
                            <CircuitDiagram />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>

    );
}
