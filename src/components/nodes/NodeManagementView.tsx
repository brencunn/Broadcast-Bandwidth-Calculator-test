'use client';
import { useEvent } from '@/context/EventContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, Pencil, PlusCircle, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';

export default function NodeManagementView() {
    const { activeEvent, dispatch } = useEvent();
    const [newNodeName, setNewNodeName] = useState('');
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleAddNode = () => {
        if (newNodeName.trim()) {
            dispatch({ type: 'ADD_NODE', payload: { name: newNodeName.trim() } });
            setNewNodeName('');
        }
    };
    
    const handleDeleteNode = (nodeId: string) => {
        dispatch({ type: 'DELETE_NODE', payload: { nodeId } });
    };

    const startEditNode = (nodeId: string, currentName: string) => {
        setEditingNodeId(nodeId);
        setEditingName(currentName);
    };

    const cancelEditNode = () => {
        setEditingNodeId(null);
        setEditingName('');
    };

    const saveEditNode = (nodeId: string) => {
        const trimmedName = editingName.trim();
        if (!trimmedName) {
            cancelEditNode();
            return;
        }
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId, name: trimmedName } });
        cancelEditNode();
    };

    if (!activeEvent) return null;
    
    const nodes = activeEvent.nodes || [];

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-3xl font-bold tracking-tight">Node Management</h2>
                <p className="text-muted-foreground">Manage all nodes for this event. Nodes are shared across all circuits.</p>
            </div>
            <div className="space-y-4">
                <div className="flex gap-2 max-w-sm">
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
                <div className="space-y-2 rounded-md border p-2 max-w-sm">
                    {nodes.length > 0 ? (
                        nodes.map(node => (
                            <div key={node.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                                {editingNodeId === node.id ? (
                                    <div className="flex w-full items-center gap-2">
                                        <Input
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEditNode(node.id);
                                                if (e.key === 'Escape') cancelEditNode();
                                            }}
                                            className="h-8"
                                            autoFocus
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => saveEditNode(node.id)} title="Save node name">
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={cancelEditNode} title="Cancel edit">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <span>{node.name}</span>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => startEditNode(node.id, node.name)} title="Edit node name">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteNode(node.id)} title="Delete node">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground text-center p-4">No nodes defined for this event yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
