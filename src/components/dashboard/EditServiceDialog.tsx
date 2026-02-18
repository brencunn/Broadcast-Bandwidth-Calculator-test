'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Service } from '@/lib/types';
import AddVideoService from './forms/AddVideoService';
import AddAudioService from './forms/AddAudioService';
import AddDataService from './forms/AddDataService';
import { useEffect, useState } from 'react';

export default function EditServiceDialog({ service, open, onOpenChange }: { service: Service | null, open: boolean, onOpenChange: (open: boolean) => void }) {
    const [isDirty, setIsDirty] = useState(false);
    const serviceId = service?.id;

    useEffect(() => {
        if (open) setIsDirty(false);
    }, [open, serviceId]);

    if (!service) return null;

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && isDirty) {
            const shouldClose = window.confirm('You have unsaved changes. Discard them and close?');
            if (!shouldClose) return;
        }
        onOpenChange(nextOpen);
    };

    const onFinished = () => {
        setIsDirty(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Service: {service.name}</DialogTitle>
                    <DialogDescription>
                        Modify the details for this service.
                    </DialogDescription>
                </DialogHeader>
                
                {service.serviceType === 'Video' && <AddVideoService key={`${service.id}-${open ? 'open' : 'closed'}`} serviceToEdit={service} onFinished={onFinished} onDirtyChange={setIsDirty} />}
                {service.serviceType === 'Audio' && <AddAudioService key={`${service.id}-${open ? 'open' : 'closed'}`} serviceToEdit={service} onFinished={onFinished} onDirtyChange={setIsDirty} />}
                {service.serviceType === 'Data' && <AddDataService key={`${service.id}-${open ? 'open' : 'closed'}`} serviceToEdit={service} onFinished={onFinished} onDirtyChange={setIsDirty} />}
                
            </DialogContent>
        </Dialog>
    );
}
