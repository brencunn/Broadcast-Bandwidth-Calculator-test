'use client';

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction } from "@/components/ui/sidebar";
import { useEvent } from "@/context/EventContext";
import AddCircuitDialog from "../circuits/AddCircuitDialog";
import EditCircuitDialog from "../circuits/EditCircuitDialog";
import { Separator } from "@/components/ui/separator";
import EventSwitcher from "./EventSwitcher";
import { Trash2, GitFork, HardDrive, GripVertical } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useState, type DragEvent } from "react";

export default function CircuitSidebar() {
    const { activeEvent, activeCircuit, activeView, dispatch } = useEvent();
    const [draggedCircuitId, setDraggedCircuitId] = useState<string | null>(null);

    const handleCircuitSelect = (circuitId: string) => {
        dispatch({ type: 'SET_ACTIVE_CIRCUIT', payload: { circuitId } });
    }

    const handleViewSelect = (view: 'nodes' | 'equipment') => {
        dispatch({ type: 'SET_ACTIVE_VIEW', payload: { view } });
    }

    const handleCircuitDelete = (circuitId: string) => {
        dispatch({ type: 'DELETE_CIRCUIT', payload: { circuitId } });
    }

    const handleDragStart = (e: DragEvent<HTMLLIElement>, circuitId: string) => {
        setDraggedCircuitId(circuitId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', circuitId);
    };

    const handleDragOver = (e: DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: DragEvent<HTMLLIElement>, targetCircuitId: string) => {
        e.preventDefault();
        if (!activeEvent || !draggedCircuitId || draggedCircuitId === targetCircuitId) {
            setDraggedCircuitId(null);
            return;
        }

        const currentCircuits = activeEvent.circuits;
        const draggedIndex = currentCircuits.findIndex((circuit) => circuit.id === draggedCircuitId);
        const targetIndex = currentCircuits.findIndex((circuit) => circuit.id === targetCircuitId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedCircuitId(null);
            return;
        }

        const reorderedCircuits = Array.from(currentCircuits);
        const [movedCircuit] = reorderedCircuits.splice(draggedIndex, 1);
        reorderedCircuits.splice(targetIndex, 0, movedCircuit);

        dispatch({
            type: 'REORDER_CIRCUITS',
            payload: { reorderedCircuitIds: reorderedCircuits.map((circuit) => circuit.id) },
        });
        setDraggedCircuitId(null);
    };

    const handleDragEnd = () => {
        setDraggedCircuitId(null);
    };

    return (
        <Sidebar>
            <SidebarHeader>
                <EventSwitcher />
            </SidebarHeader>
            <Separator />
            {activeEvent && (
                <>
                    <SidebarContent>
                        <SidebarMenu>
                            {activeEvent.circuits.map(circuit => (
                                <SidebarMenuItem
                                    key={circuit.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, circuit.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, circuit.id)}
                                    onDragEnd={handleDragEnd}
                                    data-dragging={draggedCircuitId === circuit.id}
                                    className="data-[dragging=true]:opacity-60"
                                >
                                    <SidebarMenuButton
                                        isActive={activeView === 'circuit' && circuit.id === activeCircuit?.id}
                                        onClick={() => handleCircuitSelect(circuit.id)}
                                    >
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{circuit.name}</span>
                                    </SidebarMenuButton>

                                    <EditCircuitDialog circuit={circuit} />

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <SidebarMenuAction showOnHover>
                                                <Trash2 className="text-destructive" />
                                            </SidebarMenuAction>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the 
                                                    circuit "{circuit.name}" and all of its services.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction asChild>
                                                    <Button 
                                                        variant="destructive"
                                                        onClick={() => handleCircuitDelete(circuit.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>

                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                        <Separator className="my-2" />
                        <SidebarMenu>
                             <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={activeView === 'nodes'}
                                    onClick={() => handleViewSelect('nodes')}
                                >
                                    <GitFork />
                                    <span>Nodes</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                             <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={activeView === 'equipment'}
                                    onClick={() => handleViewSelect('equipment')}
                                >
                                    <HardDrive />
                                    <span>Equipment</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarContent>
                    <SidebarFooter>
                        <AddCircuitDialog />
                    </SidebarFooter>
                </>
            )}
        </Sidebar>
    );
}
