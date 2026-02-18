'use client';
import { useEvent } from '@/context/EventContext';
import BandwidthConfigCard from './BandwidthConfigCard';
import ServiceManagementCard from './ServiceManagementCard';
import UtilisationOverview from './UtilizationOverview';
import ServiceList from './ServiceList';
import CircuitEndpointsCard from './CircuitEndpointsCard';

export default function Dashboard() {
    const { activeCircuit } = useEvent();

    if (!activeCircuit) {
        return null;
    }

    return (
        <div className="space-y-6">
             <div>
                 <h2 className="text-3xl font-bold tracking-tight">Circuit: {activeCircuit.name}</h2>
                 <p className="text-muted-foreground">Detailed configuration and utilisation for this circuit.</p>
            </div>
            <div className="grid grid-cols-1 gap-6">
                <UtilisationOverview />
                <ServiceList />
                <ServiceManagementCard />
                <CircuitEndpointsCard />
                <BandwidthConfigCard />
            </div>
        </div>
    );
}
