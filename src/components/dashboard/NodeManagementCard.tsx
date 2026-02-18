'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvent } from '@/context/EventContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function NodeManagementCard() {
    const { activeEvent, dispatch } = useEvent();
    const [newNodeName, setNewNodeName] = useState('');

    const handleAddNode = () => {
        if (newNodeName.trim()) {
            dispatch({ type: 'ADD_NODE', payload: { name: newNodeName.trim() } });
            setNewNodeName('');
        }
    };
    
    const handleDeleteNode = (nodeId: string) => {
        dispatch({ type: 'DELETE_NODE', payload: { nodeId } });
    };

    if (!activeEvent) return null;
    
    const nodes = activeEvent.nodes || [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Node Management</CardTitle>
                <CardDescription>Manage all nodes for this event.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Show/Hide Node List</AccordionTrigger>
                        <AccordionContent className="pt-4">
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input 
                                        value={newNodeName} 
                                        onChange={(e) => setNewNodeName(e.target.value)}
                                        placeholder="New node name"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddNode()}
                                    />
                                    <Button onClick={handleAddNode}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Node
                                    </Button>
                                </div>
                                <div className="space-y-2 rounded-md border p-2 max-h-60 overflow-y-auto">
                                    {nodes.length > 0 ? (
                                        nodes.map(node => (
                                            <div key={node.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                                                <span>{node.name}</span>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteNode(node.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-muted-foreground text-center p-4">No nodes defined for this event yet.</p>
                                    )}
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
}
