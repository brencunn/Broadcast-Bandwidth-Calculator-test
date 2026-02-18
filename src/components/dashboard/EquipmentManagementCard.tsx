'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvent } from '@/context/EventContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AddEditEquipmentDialog from '../equipment/AddEditEquipmentDialog';
import type { Equipment } from '@/lib/types';

export default function EquipmentManagementCard() {
    const { activeEvent, dispatch } = useEvent();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [equipmentToEdit, setEquipmentToEdit] = useState<Equipment | null>(null);

    const nodeMap = useMemo(() => {
        if (!activeEvent?.nodes) return new Map();
        return new Map(activeEvent.nodes.map(n => [n.id, n.name]));
    }, [activeEvent]);

    const handleAddNew = () => {
        setEquipmentToEdit(null);
        setDialogOpen(true);
    };

    const handleEdit = (equipment: Equipment) => {
        setEquipmentToEdit(equipment);
        setDialogOpen(true);
    };

    const handleDelete = (equipmentId: string) => {
        // TODO: Check if equipment is in use before deleting
        dispatch({ type: 'DELETE_EQUIPMENT', payload: { equipmentId } });
    };

    if (!activeEvent) return null;
    
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Equipment Library</CardTitle>
                    <CardDescription>Manage all equipment for this event.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>Show/Hide Equipment List</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <div className="space-y-4">
                                    <Button onClick={handleAddNew}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Equipment
                                    </Button>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Asset Number</TableHead>
                                                    <TableHead>Node</TableHead>
                                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {activeEvent.equipment.length > 0 ? (
                                                    activeEvent.equipment.map(eq => (
                                                        <TableRow key={eq.id}>
                                                            <TableCell className="font-medium">{eq.name}</TableCell>
                                                            <TableCell className="text-muted-foreground">{eq.assetNumber || 'N/A'}</TableCell>
                                                            <TableCell>{nodeMap.get(eq.nodeId) || 'N/A'}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(eq)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(eq.id)}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                            No equipment added yet.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
            <AddEditEquipmentDialog 
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                equipmentToEdit={equipmentToEdit}
            />
        </>
    );
}
