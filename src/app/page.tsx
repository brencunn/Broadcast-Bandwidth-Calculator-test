'use client';

import { useEvent } from '@/context/EventContext';
import Header from '@/components/layout/Header';
import WelcomeScreen from '@/components/welcome/WelcomeScreen';
import Dashboard from '@/components/dashboard/Dashboard';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import CircuitSidebar from '@/components/layout/CircuitSidebar';
import NodeManagementView from '@/components/nodes/NodeManagementView';
import EquipmentManagementView from '@/components/equipment/EquipmentManagementView';

function AppContent() {
  const { activeEvent, activeCircuit, activeView } = useEvent();

  return (
    <SidebarProvider>
      <CircuitSidebar />
      <SidebarInset>
          <Header />
          <main className="flex-grow container mx-auto p-4 md:p-8">
            {activeEvent ? (
                <div className="space-y-6">
                    {activeView === 'circuit' && (
                        activeCircuit ? (
                            <Dashboard />
                        ) : (
                            <div className="text-center py-10">
                                <h2 className="text-2xl font-semibold tracking-tight">{activeEvent.name}</h2>
                                <p className="mt-2 text-muted-foreground">Select a circuit from the sidebar to view its details and the network weathermap.</p>
                            </div>
                        )
                    )}
                    {activeView === 'nodes' && <NodeManagementView />}
                    {activeView === 'equipment' && <EquipmentManagementView />}
                </div>
            ) : (
                <WelcomeScreen />
            )}
          </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function Home() {
  return (
      <AppContent />
  );
}
