'use client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import { useEvent } from "@/context/EventContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import type { Circuit } from "@/lib/types";

const formSchema = z.object({
  circuitName: z.string().min(1, 'Circuit name is required.'),
  nodes: z.array(z.object({ name: z.string().min(1, 'Node name is required.') })).min(2, 'At least two nodes are required.'),
}).refine(data => {
    const names = data.nodes.map(n => n.name.trim()).filter(Boolean);
    return new Set(names).size === names.length;
}, {
    message: 'Node names must be unique within the circuit.',
    path: ['nodes'],
});

type FormValues = z.infer<typeof formSchema>;

export default function EditCircuitDialog({ circuit }: { circuit: Circuit }) {
    const [open, setOpen] = useState(false);
    const { activeEvent, dispatch } = useEvent();

    const initialNodes = useMemo(() => {
        const nodeMap = new Map((activeEvent?.nodes || []).map(node => [node.id, node.name]));
        return circuit.nodeIds.map(nodeId => ({ name: nodeMap.get(nodeId) || '' })).filter(node => node.name);
    }, [activeEvent?.nodes, circuit.nodeIds]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            circuitName: circuit.name,
            nodes: initialNodes.length >= 2 ? initialNodes : [{ name: '' }, { name: '' }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "nodes"
    });

    const allNodeNames = (activeEvent?.nodes || []).map(node => node.name);

    const onOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            form.reset({
                circuitName: circuit.name,
                nodes: initialNodes.length >= 2 ? initialNodes : [{ name: '' }, { name: '' }],
            });
        }
    };

    function onSubmit(values: FormValues) {
        dispatch({
            type: 'UPDATE_CIRCUIT',
            payload: {
                circuitId: circuit.id,
                circuitName: values.circuitName,
                nodeNames: values.nodes.map(node => node.name),
            },
        });
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <SidebarMenuAction showOnHover className="right-7" title="Edit circuit">
                    <Pencil />
                </SidebarMenuAction>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Circuit</DialogTitle>
                    <DialogDescription>
                        Update the circuit name and its node path. Choose from existing nodes or type a new name to create one.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                        <FormField
                            control={form.control}
                            name="circuitName"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Circuit Name</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., Tokyo to LA via Honolulu" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <div className="space-y-4">
                            <datalist id={`existing-node-names-${circuit.id}`}>
                                {allNodeNames.map((nodeName) => (
                                    <option key={nodeName} value={nodeName} />
                                ))}
                            </datalist>
                            {fields.map((field, index) => (
                                <FormField
                                    key={field.id}
                                    control={form.control}
                                    name={`nodes.${index}.name`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Node {index + 1}</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        placeholder={`e.g., Location ${index + 1}`}
                                                        list={allNodeNames.length > 0 ? `existing-node-names-${circuit.id}` : undefined}
                                                        {...field}
                                                        autoComplete="off"
                                                    />
                                                    {fields.length > 2 && (
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => remove(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            <span className="sr-only">Remove Node</span>
                                                        </Button>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                            {form.formState.errors.nodes && (
                                <p className="text-sm font-medium text-destructive">
                                    {form.formState.errors.nodes.root?.message || form.formState.errors.nodes.message}
                                </p>
                            )}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => append({ name: '' })}
                            className="w-full"
                        >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Node to Path
                        </Button>

                        <DialogFooter>
                            <Button type="submit">Save Circuit</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
