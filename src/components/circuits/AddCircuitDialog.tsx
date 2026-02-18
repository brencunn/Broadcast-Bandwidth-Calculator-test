'use client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useEvent } from "@/context/EventContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";

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


export default function AddCircuitDialog() {
    const [open, setOpen] = useState(false);
    const { activeEvent, dispatch } = useEvent();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            circuitName: '',
            nodes: [{ name: '' }, { name: '' }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "nodes"
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        dispatch({
          type: 'ADD_CIRCUIT',
          payload: {
            circuitName: values.circuitName,
            nodeNames: values.nodes.map(n => n.name),
          },
        });
        form.reset({ circuitName: '', nodes: [{ name: '' }, { name: '' }] });
        setOpen(false);
    }
    
    const allNodeNames = (activeEvent?.nodes || []).map(n => n.name);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add New Circuit
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add New Circuit</DialogTitle>
                    <DialogDescription>
                        Define the new circuit by giving it a name and specifying its path. Choose from existing nodes or type a new name to create one.
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
                            <datalist id="existing-node-names">
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
                                                        list={allNodeNames.length > 0 ? "existing-node-names" : undefined}
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
                            <Button type="submit">Create Circuit</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
