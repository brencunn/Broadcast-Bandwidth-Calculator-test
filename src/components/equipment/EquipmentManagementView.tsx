'use client';
import { useEvent } from '@/context/EventContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, Upload } from 'lucide-react';
import React, { useMemo, useState, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AddEditEquipmentDialog from './AddEditEquipmentDialog';
import type { Equipment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const robustCsvParser = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  // Normalize line endings
  const text = csvText.replace(/\r\n/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next character
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Add the last field and row if the file doesn't end with a newline
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Handle case where file ends with a newline, which can create an empty row
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  return rows;
}


export default function EquipmentManagementView() {
    const { activeEvent, dispatch } = useEvent();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [equipmentToEdit, setEquipmentToEdit] = useState<Equipment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [selectedRows, setSelectedRows] = useState<string[]>([]);

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
        dispatch({ type: 'DELETE_EQUIPMENT', payload: { equipmentId } });
    };

    const handleDeleteSelected = () => {
        dispatch({ type: 'DELETE_MULTIPLE_EQUIPMENT', payload: { equipmentIds: selectedRows } });
        setSelectedRows([]);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const allRows = robustCsvParser(text);
                
                if (allRows.length < 2) {
                    throw new Error("CSV file must have a header row and at least one data row.");
                }
    
                const header = allRows[0].map(h => h.trim());
                
                const assetIdIndex = header.indexOf('Bbc asset id');
                const nameIndex = header.indexOf('Name');
                const modelIndex = header.indexOf('Model number');
                const descIndex = header.indexOf('Description');
                
                if (nameIndex === -1) {
                     throw new Error("CSV must contain a 'Name' column.");
                }
                
                const equipmentToImport = allRows.slice(1).map(values => {
                    const getVal = (index: number) => index > -1 ? values[index]?.trim() : undefined;
                    
                    return {
                        assetNumber: getVal(assetIdIndex),
                        name: getVal(nameIndex) ?? '',
                        modelNumber: getVal(modelIndex),
                        description: getVal(descIndex),
                    };
                }).filter(eq => eq.name);
    
                if (equipmentToImport.length > 0) {
                    dispatch({ type: 'IMPORT_EQUIPMENT', payload: { equipment: equipmentToImport } });
                    toast({
                        title: "Import Successful",
                        description: `${equipmentToImport.length} equipment items were imported.`,
                    });
                } else {
                     throw new Error("No valid equipment found to import.");
                }
    
            } catch (error: any) {
                console.error("Error parsing CSV file", error);
                toast({
                    variant: "destructive",
                    title: "Import Failed",
                    description: error.message || "Could not parse the CSV file. Please ensure it's a valid CSV file.",
                });
            } finally {
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked === true) {
            setSelectedRows(activeEvent?.equipment.map(eq => eq.id) ?? []);
        } else {
            setSelectedRows([]);
        }
    };

    const handleRowSelect = (rowId: string) => {
        setSelectedRows(prev => 
            prev.includes(rowId) 
                ? prev.filter(id => id !== rowId)
                : [...prev, rowId]
        );
    };

    if (!activeEvent) return null;
    
    const allEquipment = activeEvent.equipment || [];
    const isAllSelected = selectedRows.length > 0 && selectedRows.length === allEquipment.length;
    const isSomeSelected = selectedRows.length > 0 && selectedRows.length < allEquipment.length;

    return (
        <>
             <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
            />
            <div>
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Equipment Library</h2>
                        <p className="text-muted-foreground">Manage all equipment for this event. Equipment is shared across all circuits.</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <Button onClick={handleAddNew}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Equipment
                            </Button>
                            <Button variant="outline" onClick={handleImportClick}>
                                <Upload className="mr-2 h-4 w-4" /> Import csv from EZoffice
                            </Button>
                        </div>
                        {selectedRows.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete ({selectedRows.length})
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete {selectedRows.length} equipment item(s).
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteSelected}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px] p-2">
                                        <Checkbox
                                            checked={isAllSelected ? true : (isSomeSelected ? 'indeterminate' : false)}
                                            onCheckedChange={(checked) => handleSelectAll(checked)}
                                            aria-label="Select all rows"
                                        />
                                    </TableHead>
                                    <TableHead className="p-2">Name / Model</TableHead>
                                    <TableHead className="p-2">Description</TableHead>
                                    <TableHead className="p-2">Asset Number</TableHead>
                                    <TableHead className="p-2">Node</TableHead>
                                    <TableHead className="w-[100px] text-right p-2">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allEquipment.length > 0 ? (
                                    allEquipment.map(eq => (
                                        <TableRow key={eq.id} data-state={selectedRows.includes(eq.id) ? 'selected' : undefined}>
                                            <TableCell className="p-2">
                                                 <Checkbox
                                                    checked={selectedRows.includes(eq.id)}
                                                    onCheckedChange={() => handleRowSelect(eq.id)}
                                                    aria-label={`Select row for ${eq.name}`}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium p-2 align-top">
                                                <div>{eq.name}</div>
                                                {eq.modelNumber && <div className="text-xs text-muted-foreground">{eq.modelNumber}</div>}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate p-2 align-top" title={eq.description}>
                                                {eq.description || 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground p-2 align-top">{eq.assetNumber || 'N/A'}</TableCell>
                                            <TableCell className="p-2 align-top">{nodeMap.get(eq.nodeId || '') || 'Unassigned'}</TableCell>
                                            <TableCell className="text-right p-2 align-top">
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
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No equipment added yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
            <AddEditEquipmentDialog 
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                equipmentToEdit={equipmentToEdit}
            />
        </>
    );
}