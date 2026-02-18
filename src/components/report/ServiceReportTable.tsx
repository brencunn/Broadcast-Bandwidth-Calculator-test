'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Service, VideoService, Circuit, Node, Equipment, DataService } from '@/lib/types';
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { getServiceDetails } from '@/lib/utils';

interface ServiceReportTableProps {
    services: Service[];
    circuits: Circuit[];
    nodes: Node[];
    equipment: Equipment[];
    showCircuit?: boolean;
}

type SortableKey = 'name' | 'circuit' | 'serviceType' | 'details' | 'path' | 'handoffs' | 'bandwidth';
type SortDirection = 'ascending' | 'descending';


export default function ServiceReportTable({ services, circuits, nodes, equipment, showCircuit = false }: ServiceReportTableProps) {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: SortDirection } | null>(null);

    const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node.name])), [nodes]);
    const equipmentMap = useMemo(() => new Map(equipment.map(e => [e.id, e.name])), [equipment]);
    
    const serviceToCircuitMap = useMemo(() => {
        const map = new Map<string, string>();
        if (showCircuit) {
            for (const circuit of circuits) {
                for (const service of circuit.services) {
                    map.set(service.id, circuit.name);
                }
            }
        }
        return map;
    }, [circuits, showCircuit]);

    const sortedServices = useMemo(() => {
        let sortableServices = [...services];
        if (sortConfig !== null) {
            sortableServices.sort((a, b) => {
                let aValue: string | number;
                let bValue: string | number;

                switch (sortConfig.key) {
                    case 'details':
                        aValue = getServiceDetails(a);
                        bValue = getServiceDetails(b);
                        break;
                    case 'path': {
                        const getPathString = (service: Service) => {
                            const sourceName = nodeMap.get(service.sourceNodeId) ?? '';
                            const destName = nodeMap.get(service.destinationNodeId) ?? '';
                            const sourceEq = service.sourceEquipmentId ? ` (${equipmentMap.get(service.sourceEquipmentId) ?? ''})` : '';
                            const destEq = service.destinationEquipmentId ? ` (${equipmentMap.get(service.destinationEquipmentId) ?? ''})` : '';
                            return `${sourceName}${sourceEq} -> ${destName}${destEq}`;
                        }
                        aValue = getPathString(a);
                        bValue = getPathString(b);
                        break;
                    }
                    case 'circuit':
                        aValue = serviceToCircuitMap.get(a.id) || '';
                        bValue = serviceToCircuitMap.get(b.id) || '';
                        break;
                    case 'handoffs':
                        aValue = (a.sourceHandoffType || '') + (a.destinationHandoffType || '');
                        bValue = (b.sourceHandoffType || '') + (b.destinationHandoffType || '');
                        break;
                    default:
                        aValue = a[sortConfig.key as keyof Service];
                        bValue = b[sortConfig.key as keyof Service];
                        break;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableServices;
    }, [services, sortConfig, nodeMap, equipmentMap, serviceToCircuitMap]);
    
    const requestSort = (key: SortableKey) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortableKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    };


    if (services.length === 0) {
        return <p className="text-muted-foreground text-center py-4">No services to display.</p>;
    }

    return (
        <div className="rounded-md border report-table">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            <Button variant="ghost" onClick={() => requestSort('name')} className="justify-start w-full px-0">
                                Name {getSortIndicator('name')}
                            </Button>
                        </TableHead>
                        {showCircuit && <TableHead>
                            <Button variant="ghost" onClick={() => requestSort('circuit')} className="justify-start w-full px-0">
                                Circuit {getSortIndicator('circuit')}
                            </Button>
                        </TableHead>}
                        <TableHead>
                             <Button variant="ghost" onClick={() => requestSort('serviceType')} className="justify-start w-full px-0">
                                Type {getSortIndicator('serviceType')}
                            </Button>
                        </TableHead>
                        <TableHead>
                             <Button variant="ghost" onClick={() => requestSort('details')} className="justify-start w-full px-0">
                                Details {getSortIndicator('details')}
                            </Button>
                        </TableHead>
                        <TableHead>
                            <Button variant="ghost" onClick={() => requestSort('path')} className="justify-start w-full px-0">
                                Path {getSortIndicator('path')}
                            </Button>
                        </TableHead>
                        <TableHead>
                            <Button variant="ghost" onClick={() => requestSort('handoffs')} className="justify-start w-full px-0">
                                Handoffs & Cabling {getSortIndicator('handoffs')}
                            </Button>
                        </TableHead>
                        <TableHead className="text-right">
                            <Button variant="ghost" onClick={() => requestSort('bandwidth')} className="justify-end w-full px-0">
                                Bandwidth {getSortIndicator('bandwidth')}
                            </Button>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedServices.map(service => {
                        return (
                            <TableRow key={service.id}>
                                <TableCell className="font-medium">{service.name}</TableCell>
                                {showCircuit && <TableCell>{serviceToCircuitMap.get(service.id) || 'N/A'}</TableCell>}
                                <TableCell>
                                    <Badge variant="secondary" className="badge-print-override">{service.serviceType}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">{getServiceDetails(service)}</TableCell>
                                <TableCell>
                                    {nodeMap.get(service.sourceNodeId)}
                                    {service.sourceEquipmentId && equipmentMap.has(service.sourceEquipmentId) && (
                                        <span className="text-muted-foreground text-xs"> ({equipmentMap.get(service.sourceEquipmentId)})</span>
                                    )}
                                    {(service.serviceType === 'Data' && !(service as DataService).isAsymmetricLeg) ? <>&nbsp;&harr;&nbsp;</> : <>&nbsp;&rarr;&nbsp;</>}
                                    {nodeMap.get(service.destinationNodeId)}
                                    {service.destinationEquipmentId && equipmentMap.has(service.destinationEquipmentId) && (
                                        <span className="text-muted-foreground text-xs"> ({equipmentMap.get(service.destinationEquipmentId)})</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs">
                                    <div>Src: {service.sourceHandoffType}{service.sourceCableNumber && ` / #${service.sourceCableNumber}`}</div>
                                    <div>Dst: {service.destinationHandoffType}{service.destinationCableNumber && ` / #${service.destinationCableNumber}`}</div>
                                </TableCell>
                                <TableCell className="text-right font-mono">{service.bandwidth.toFixed(2)} Mbps</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
