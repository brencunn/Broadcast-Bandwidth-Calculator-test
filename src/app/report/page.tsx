'use client';

import { useEvent } from '@/context/EventContext';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ServiceReportTable from '@/components/report/ServiceReportTable';
import { useMemo, useState, useEffect } from 'react';
import type { Circuit, Service, DataService, VideoService } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Printer, Download, Filter, X } from 'lucide-react';
import { calculateUtilisation, getServiceDetails } from '@/lib/utils';
import UtilisationCard from '@/components/dashboard/UtilizationCard';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VIDEO_CODEC_TYPES, HANDOFF_TYPES } from '@/lib/config';

export default function ReportPage() {
    const { activeEvent } = useEvent();
    const [serviceTypeFilter, setServiceTypeFilter] = useState('all');
    const [codecFilter, setCodecFilter] = useState('all');
    const [handoffTypeFilter, setHandoffTypeFilter] = useState('all');

    useEffect(() => {
        if (serviceTypeFilter !== 'all' && serviceTypeFilter !== 'Video') {
            setCodecFilter('all');
        }
    }, [serviceTypeFilter]);

    const handleResetFilters = () => {
        setServiceTypeFilter('all');
        setCodecFilter('all');
        setHandoffTypeFilter('all');
    };
    
    const equipmentMap = useMemo(() => new Map(activeEvent?.equipment?.map(e => [e.id, e.name]) ?? []), [activeEvent]);

    const allServices = useMemo(() => {
        if (!activeEvent) return [];
        return activeEvent.circuits.flatMap(circuit => circuit.services);
    }, [activeEvent]);

    const allNodes = useMemo(() => {
        if (!activeEvent) return [];
        return activeEvent.nodes;
    }, [activeEvent]);

    const filterFunction = (service: Service) => {
        if (serviceTypeFilter !== 'all' && service.serviceType !== serviceTypeFilter) {
            return false;
        }
        if (service.serviceType === 'Video' && codecFilter !== 'all') {
            if ((service as VideoService).codec !== codecFilter) {
                return false;
            }
        }
        if (handoffTypeFilter !== 'all') {
            if (service.sourceHandoffType !== handoffTypeFilter && service.destinationHandoffType !== handoffTypeFilter) {
                return false;
            }
        }
        return true;
    };

    const filteredAllServices = useMemo(() => {
        return allServices.filter(filterFunction);
    }, [allServices, serviceTypeFilter, codecFilter, handoffTypeFilter]);

    const utilisationDataByCircuit = useMemo(() => {
        if (!activeEvent) return new Map<string, ReturnType<typeof calculateUtilisation>>();
        
        const map = new Map<string, ReturnType<typeof calculateUtilisation>>();
        for (const circuit of activeEvent.circuits) {
            map.set(circuit.id, calculateUtilisation(circuit, activeEvent.nodes));
        }
        return map;
    }, [activeEvent]);

    const handleExportCSV = () => {
        if (!activeEvent) return;

        const servicesToExport = filteredAllServices;
        const nodeMap = new Map(activeEvent.nodes.map(node => [node.id, node.name]));
        const currentEquipmentMap = new Map(activeEvent.equipment.map(e => [e.id, e.name]) ?? []);
        const serviceToCircuitMap = new Map<string, string>();
        for (const circuit of activeEvent.circuits) {
            for (const service of circuit.services) {
                serviceToCircuitMap.set(service.id, circuit.name);
            }
        }

        const headers = [
            'Name',
            'Circuit',
            'Type',
            'Details',
            'Path',
            'Source Handoff',
            'Source Cable',
            'Destination Handoff',
            'Destination Cable',
            'Bandwidth (Mbps)'
        ];

        const escapeCsvField = (field: string | number | undefined | null) => {
            if (field === null || field === undefined) {
                return '';
            }
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                const escapedField = stringField.replace(/"/g, '""');
                return `"${escapedField}"`;
            }
            return stringField;
        };
        
        const csvRows = [headers.map(escapeCsvField).join(',')];

        for (const service of servicesToExport) {
            const path = (
                `${nodeMap.get(service.sourceNodeId) || ''}` +
                `${service.sourceEquipmentId && currentEquipmentMap.has(service.sourceEquipmentId) ? ` (${currentEquipmentMap.get(service.sourceEquipmentId)})` : ''}` +
                `${(service.serviceType === 'Data' && !(service as DataService).isAsymmetricLeg) ? ' \u2194 ' : ' \u2192 '}` +
                `${nodeMap.get(service.destinationNodeId) || ''}` +
                `${service.destinationEquipmentId && currentEquipmentMap.has(service.destinationEquipmentId) ? ` (${currentEquipmentMap.get(service.destinationEquipmentId)})` : ''}`
            );
            
            const row = [
                escapeCsvField(service.name),
                escapeCsvField(serviceToCircuitMap.get(service.id)),
                escapeCsvField(service.serviceType),
                escapeCsvField(getServiceDetails(service)),
                escapeCsvField(path),
                escapeCsvField(service.sourceHandoffType),
                escapeCsvField(service.sourceCableNumber),
                escapeCsvField(service.destinationHandoffType),
                escapeCsvField(service.destinationCableNumber),
                escapeCsvField(service.bandwidth.toFixed(2))
            ].join(',');
            csvRows.push(row);
        }

        const csvString = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeEvent.name.replace(/\s+/g, '_')}_services_report.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    if (!activeEvent) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <Header />
                <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center justify-center text-center">
                     <CardTitle className="text-2xl">No Active Event</CardTitle>
                     <CardDescription className="mt-2">
                        Please select an event or create a new one to view a report.
                     </CardDescription>
                     <Button asChild className="mt-4 print-hidden">
                        <Link href="/">Go to Dashboard</Link>
                     </Button>
                </main>
            </div>
        );
    }
    
    const nodeMap = new Map((activeEvent.nodes || []).map(n => [n.id, n.name]));

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-8">
                <div className="mb-6 flex justify-between items-center print:mb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight print-hidden">Service Report</h1>
                        <p className="text-xl text-muted-foreground print:text-2xl print:font-bold">{activeEvent.name}</p>
                    </div>
                    <div className="flex items-center gap-2 print-hidden">
                        <Button onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print Report
                        </Button>
                        <Button onClick={handleExportCSV} variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Export as CSV
                        </Button>
                    </div>
                </div>

                <Card className="p-4 mb-6 print-hidden">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-medium">Filter Services</h3>
                        </div>
                        <div className="flex-grow" />
                        <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Service Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="Video">Video</SelectItem>
                                <SelectItem value="Audio">Audio</SelectItem>
                                <SelectItem value="Data">Data</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={codecFilter} onValueChange={setCodecFilter} disabled={serviceTypeFilter !== 'all' && serviceTypeFilter !== 'Video'}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Codec" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Codecs</SelectItem>
                                {VIDEO_CODEC_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        
                        <Select value={handoffTypeFilter} onValueChange={setHandoffTypeFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Handoff Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Handoffs</SelectItem>
                                {HANDOFF_TYPES.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Button variant="ghost" onClick={handleResetFilters}>
                            <X className="mr-2 h-4 w-4" />
                            Reset
                        </Button>
                    </div>
                </Card>
                
                <Tabs defaultValue="by-circuit" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-md print-hidden">
                        <TabsTrigger value="by-circuit">By Circuit</TabsTrigger>
                        <TabsTrigger value="all-services">All Services</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="by-circuit" className="pt-6">
                        <div className="space-y-8">
                            {activeEvent.circuits.map(circuit => {
                                const servicesForCircuit = circuit.services.filter(filterFunction);
                                const nodeIds = circuit.nodeIds || [];
                                const endpoint1 = nodeIds.length > 0 ? nodeMap.get(nodeIds[0]) : null;
                                const endpoint2 = nodeIds.length > 1 ? nodeMap.get(nodeIds[nodeIds.length - 1]) : null;
                                const endpoint1EqName = circuit.endpoint1EquipmentId ? equipmentMap.get(circuit.endpoint1EquipmentId) : null;
                                const endpoint2EqName = circuit.endpoint2EquipmentId ? equipmentMap.get(circuit.endpoint2EquipmentId) : null;
                                const utilisationData = utilisationDataByCircuit.get(circuit.id) ?? [];
                                const isTwoNodeCircuit = nodeIds.length === 2;
                                
                                return (
                                <Card key={circuit.id} className="card-in-print">
                                    <CardHeader>
                                        <CardTitle>{circuit.name}</CardTitle>
                                        <div className="flex justify-between items-start">
                                            <CardDescription>
                                                 {servicesForCircuit.length} of {circuit.services.length} {circuit.services.length === 1 ? 'service' : 'services'} matching filters.
                                            </CardDescription>
                                        </div>
                                         <div className="text-sm text-muted-foreground pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 border-t mt-2 pt-2">
                                            {endpoint1 && (
                                                <div><strong>{endpoint1?.name}:</strong> Handoff: {circuit.endpoint1HandoffType || 'Not set'} {endpoint1EqName ? `(${endpoint1EqName})` : ''}</div>
                                            )}
                                            {endpoint2 && (
                                                <div><strong>{endpoint2?.name}:</strong> Handoff: {circuit.endpoint2HandoffType || 'Not set'} {endpoint2EqName ? `(${endpoint2EqName})` : ''}</div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <ServiceReportTable 
                                            services={servicesForCircuit}
                                            circuits={[circuit]}
                                            nodes={allNodes}
                                            equipment={activeEvent.equipment || []}
                                        />

                                        <div className="print-hidden">
                                            <Separator className="my-6" />
                                            <h4 className="text-lg font-medium mb-4">Segment Utilisation</h4>
                                            {(circuit.segments || []).length > 0 ? (
                                                <div className={cn(
                                                    "grid gap-6",
                                                    isTwoNodeCircuit ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
                                                )}>
                                                    {(circuit.segments || []).map((segment) => {
                                                        const segmentUtil = utilisationData.find(u => u.segmentId === segment.id);
                                                        const node1Name = nodeMap.get(segment.node1Id) ?? 'N/A';
                                                        const node2Name = nodeMap.get(segment.node2Id) ?? 'N/A';

                                                        return (
                                                            <UtilisationCard
                                                                key={segment.id}
                                                                segment={segment}
                                                                utilisation={segmentUtil}
                                                                node1Name={node1Name}
                                                                node2Name={node2Name}
                                                                layout={isTwoNodeCircuit ? 'side-by-side' : 'stacked'}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-muted-foreground text-center py-4">No segments defined for this circuit.</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )})}
                            {activeEvent.circuits.length === 0 && (
                                <p className="text-muted-foreground text-center py-10">
                                    There are no circuits in this event.
                                </p>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="all-services" className="pt-6">
                         <Card className="card-in-print">
                            <CardHeader>
                                <CardTitle>All Services</CardTitle>
                                <CardDescription>
                                    A combined list of all services across all circuits for this event.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ServiceReportTable 
                                    services={filteredAllServices} 
                                    circuits={activeEvent.circuits}
                                    nodes={allNodes}
                                    equipment={activeEvent.equipment || []}
                                    showCircuit={true}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
