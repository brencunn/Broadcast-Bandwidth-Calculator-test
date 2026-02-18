'use client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEvent } from "@/context/EventContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Equipment } from "@/lib/types";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
  name: z.string().min(1, 'Equipment name is required.'),
  modelNumber: z.string().optional(),
  description: z.string().optional(),
  nodeId: z.string().optional(),
  assetNumber: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddEditEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentToEdit: Equipment | null;
}

export default function AddEditEquipmentDialog({ open, onOpenChange, equipmentToEdit }: AddEditEquipmentDialogProps) {
    const { activeEvent, dispatch } = useEvent();
    const isEditMode = !!equipmentToEdit;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            modelNumber: '',
            description: '',
            nodeId: '',
            assetNumber: '',
        },
    });

    useEffect(() => {
        if (open) {
            if (isEditMode && equipmentToEdit) {
                form.reset({
                    name: equipmentToEdit.name,
                    modelNumber: equipmentToEdit.modelNumber || '',
                    description: equipmentToEdit.description || '',
                    nodeId: equipmentToEdit.nodeId || '',
                    assetNumber: equipmentToEdit.assetNumber || '',
                });
            } else {
                form.reset({ name: '', modelNumber: '', description: '', nodeId: '', assetNumber: '' });
            }
        }
    }, [open, isEditMode, equipmentToEdit, form]);

    function onSubmit(values: FormValues) {
        const finalValues = { ...values, nodeId: (values.nodeId === '' || values.nodeId === 'unassigned') ? undefined : values.nodeId };
        if (isEditMode) {
            dispatch({ type: 'UPDATE_EQUIPMENT', payload: { id: equipmentToEdit!.id, values: finalValues } });
        } else {
            dispatch({ type: 'ADD_EQUIPMENT', payload: finalValues });
        }
        onOpenChange(false);
    }
    
    if (!activeEvent) return null;

    const nodes = activeEvent.nodes || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Edit Equipment' : 'Add New Equipment'}</DialogTitle>
                    <DialogDescription>
                        {isEditMode ? 'Modify the details for this piece of equipment.' : 'Add a new piece of equipment to the event library.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Equipment Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Main Router" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="modelNumber"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Model Number (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., HyperDeck Studio 4K Pro" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Any relevant details..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="assetNumber"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Asset Number (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., BBC15042" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="nodeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Node</FormLabel>
                                     <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Assign to a node (optional)" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {nodes.map(node => <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit">{isEditMode ? 'Save Changes' : 'Add Equipment'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
