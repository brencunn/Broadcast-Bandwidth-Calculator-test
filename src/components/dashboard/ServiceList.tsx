'use client';

import { useEvent } from '@/context/EventContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, ArrowUp, ArrowDown, GripVertical, Pencil, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Service, VideoService, DataService } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import React, { useMemo, useState } from 'react';
import EditServiceDialog from './EditServiceDialog';
import { getServiceDetails } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type SortableKey = 'name' | 'serviceType' | 'details' | 'path' | 'handoffs' | 'bandwidth';
type SortDirection = 'ascending' | 'descending';

export default function ServiceList() {
    const { activeEvent, activeCircuit, dispatch } = useEvent();
    const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: SortDirection } | null>(null);
    const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState('');

    const nodeMap = useMemo(() => {
        if (!activeEvent?.nodes) return new Map();
        return new Map(activeEvent.nodes.map(node => [node.id, node.name]));
    }, [activeEvent]);

    const equipmentMap = useMemo(() => {
        if (!activeEvent?.equipment) return new Map();
        return new Map(activeEvent.equipment.map(e => [e.id, e.name]));
    }, [activeEvent]);

    const sortedServices = useMemo(() => {
        if (!activeCircuit?.services) return [];
        let sortableServices = [...activeCircuit.services];
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
                    case 'handoffs':
                        aValue = (a.sourceHandoffType || '') + (a.destinationHandoffType || '');
                        bValue = (b.sourceHandoffType || '') + (b.destinationHandoffType || '');
                        break;
                    default:
                        aValue = a[sortConfig.key as keyof Service];
                        bValue = b[sortConfig.key as keyof Service];
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
    }, [activeCircuit?.services, sortConfig, nodeMap, equipmentMap]);

    const requestSort = (key: SortableKey) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleDelete = (serviceId: string) => {
        dispatch({ type: 'DELETE_SERVICE', payload: { serviceId } });
    }

    const handleDuplicate = (serviceId: string) => {
        dispatch({ type: 'DUPLICATE_SERVICE', payload: { serviceId } });
    };

    const startEditingName = (service: Service) => {
        setEditingNameId(service.id);
        setEditingNameValue(service.name);
    };

    const cancelEditingName = () => {
        setEditingNameId(null);
        setEditingNameValue('');
    };

    const commitEditingName = (service: Service) => {
        const trimmedName = editingNameValue.trim();
        if (!trimmedName) {
            setEditingNameValue(service.name);
            setEditingNameId(null);
            return;
        }
        if (trimmedName === service.name) {
            setEditingNameId(null);
            return;
        }
        dispatch({
            type: 'UPDATE_SERVICE',
            payload: { updatedService: { ...service, name: trimmedName } },
        });
        setEditingNameId(null);
    };

    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, serviceId: string) => {
        setDraggedServiceId(serviceId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', serviceId);
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    
    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetServiceId: string) => {
        e.preventDefault();
        if (!draggedServiceId || draggedServiceId === targetServiceId) {
            setDraggedServiceId(null);
            return
        };

        const currentServices = activeCircuit?.services ?? [];
        const draggedIndex = currentServices.findIndex(s => s.id === draggedServiceId);
        const targetIndex = currentServices.findIndex(s => s.id === targetServiceId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const reorderedServices = Array.from(currentServices);
        const [removed] = reorderedServices.splice(draggedIndex, 1);
        reorderedServices.splice(targetIndex, 0, removed);
        
        setSortConfig(null);
        dispatch({ type: 'REORDER_SERVICES', payload: { reorderedServices } });
        setDraggedServiceId(null);
    };

    const handleDragEnd = () => {
        setDraggedServiceId(null);
    };
    
    const getSortIndicator = (key: SortableKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    };

    if (!activeCircuit) return null;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Services on Circuit</CardTitle>
                    <CardDescription>A list of all services currently added to the active circuit. Drag and drop rows to reorder.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"><span className="sr-only">Drag handle</span></TableHead>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => requestSort('name')} className="justify-start w-full px-0">
                                            Name {getSortIndicator('name')}
                                        </Button>
                                    </TableHead>
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
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedServices.length > 0 ? (
                                    sortedServices.map(service => (
                                        <TableRow 
                                            key={service.id}
                                            draggable={editingNameId !== service.id}
                                            onDragStart={(e) => handleDragStart(e, service.id)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, service.id)}
                                            onDragEnd={handleDragEnd}
                                            data-dragging={draggedServiceId === service.id}
                                            className="cursor-move data-[dragging=true]:bg-muted"
                                        >
                                            <TableCell>
                                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {editingNameId === service.id ? (
                                                    <Input
                                                        value={editingNameValue}
                                                        onChange={(e) => setEditingNameValue(e.target.value)}
                                                        onBlur={() => commitEditingName(service)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                commitEditingName(service);
                                                            } else if (e.key === 'Escape') {
                                                                cancelEditingName();
                                                            }
                                                        }}
                                                        autoFocus
                                                        className="h-8"
                                                    />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="text-left hover:underline"
                                                        onClick={() => startEditingName(service)}
                                                    >
                                                        {service.name}
                                                    </button>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{service.serviceType}</Badge>
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
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                                <Button variant="ghost" size="icon" onClick={() => setEditingService(service)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDuplicate(service.id)} title="Duplicate service">
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No services added yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            <EditServiceDialog 
                service={editingService} 
                open={!!editingService} 
                onOpenChange={(isOpen) => !isOpen && setEditingService(null)}
            />
        </>
    );
}
