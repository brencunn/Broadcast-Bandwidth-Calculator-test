'use client';

import React, { createContext, useContext, useReducer, ReactNode, useEffect, useRef } from 'react';
import type { Circuit, Node, Segment, Service, BandwidthUnit, HandoffType, Event, Equipment, VideoService, DataService, AudioService } from '@/lib/types';
import { VideoServiceFormValues } from '@/components/dashboard/forms/AddVideoService';
import { AudioServiceFormValues } from '@/components/dashboard/forms/AddAudioService';
import { DataServiceFormValues } from '@/components/dashboard/forms/AddDataService';
import { MADI_PER_CHANNEL_BANDWIDTH_MBPS, MADI_STREAM_BANDWIDTH_MBPS, UNCOMPRESSED_PCM_AUDIO_CHANNEL_BANDWIDTH_MBPS } from '@/lib/config';

const EVENTS_API_URL = '/api/events';

const generateId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // UUID v4 bit layout
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

interface EventState {
  events: Event[];
  activeEventId: string | null;
  activeCircuitId: string | null;
  lastJpegXsBitrate: number | null;
  activeView: 'circuit' | 'nodes' | 'equipment';
}

type AddServicePayload = (VideoServiceFormValues | AudioServiceFormValues | DataServiceFormValues) & { isAsymmetricLeg?: boolean };

type CreateEventPayload = { eventName: string; nodeNames: string[] };
type AddCircuitPayload = { circuitName: string; nodeNames:string[] };
type UpdateCircuitPayload = { circuitId: string; circuitName: string; nodeNames: string[] };
type UpdateCircuitEndpointsPayload = {
    updates: {
        endpoint1HandoffType?: string;
        endpoint1EquipmentId?: string;
        endpoint1NewEquipmentName?: string;
        endpoint1NewAssetNumber?: string;
        endpoint2HandoffType?: string;
        endpoint2EquipmentId?: string;
        endpoint2NewEquipmentName?: string;
        endpoint2NewAssetNumber?: string;
    }
};

type AddNodePayload = { name: string };
type DeleteNodePayload = { nodeId: string };
type UpdateNodePayload = { nodeId: string; name: string };
type AddEquipmentPayload = { name: string; modelNumber?: string; description?: string; nodeId?: string; assetNumber?: string; };
type UpdateEquipmentPayload = { id: string; values: AddEquipmentPayload };
type DeleteEquipmentPayload = { equipmentId: string };
type DeleteMultipleEquipmentPayload = { equipmentIds: string[] };
type ImportEquipmentPayload = { equipment: Partial<Omit<Equipment, 'id'>>[] };

type Action =
  | { type: 'LOAD_STATE'; payload: EventState }
  | { type: 'CREATE_EVENT_WITH_CIRCUIT'; payload: CreateEventPayload }
  | { type: 'ADD_CIRCUIT'; payload: AddCircuitPayload }
  | { type: 'REORDER_CIRCUITS'; payload: { reorderedCircuitIds: string[] } }
  | { type: 'UPDATE_CIRCUIT'; payload: UpdateCircuitPayload }
  | { type: 'DELETE_CIRCUIT'; payload: { circuitId: string } }
  | { type: 'DELETE_EVENT'; payload: { eventId: string } }
  | { type: 'SET_ACTIVE_EVENT'; payload: { eventId: string } }
  | { type: 'SET_ACTIVE_CIRCUIT'; payload: { circuitId: string } }
  | { type: 'UPDATE_SEGMENT'; payload: { segmentId: string; newValues: Partial<Segment> } }
  | { type: 'ADD_SERVICE'; payload: AddServicePayload }
  | { type: 'DUPLICATE_SERVICE'; payload: { serviceId: string } }
  | { type: 'UPDATE_SERVICE'; payload: { updatedService: Service } }
  | { type: 'DELETE_SERVICE'; payload: { serviceId: string } }
  | { type: 'REORDER_SERVICES'; payload: { reorderedServices: Service[] } }
  | { type: 'START_NEW_EVENT_CREATION' }
  | { type: 'UPDATE_CIRCUIT_ENDPOINTS'; payload: UpdateCircuitEndpointsPayload }
  | { type: 'IMPORT_EVENT'; payload: Event }
  | { type: 'ADD_NODE'; payload: AddNodePayload }
  | { type: 'DELETE_NODE'; payload: DeleteNodePayload }
  | { type: 'UPDATE_NODE'; payload: UpdateNodePayload }
  | { type: 'ADD_EQUIPMENT'; payload: AddEquipmentPayload }
  | { type: 'UPDATE_EQUIPMENT'; payload: UpdateEquipmentPayload }
  | { type: 'DELETE_EQUIPMENT'; payload: DeleteEquipmentPayload }
  | { type: 'DELETE_MULTIPLE_EQUIPMENT'; payload: DeleteMultipleEquipmentPayload }
  | { type: 'IMPORT_EQUIPMENT'; payload: ImportEquipmentPayload }
  | { type: 'SET_ACTIVE_VIEW'; payload: { view: 'circuit' | 'nodes' | 'equipment' } };

const initialState: EventState = {
  events: [],
  activeEventId: null,
  activeCircuitId: null,
  lastJpegXsBitrate: null,
  activeView: 'circuit',
};

const EventContext = createContext<{
  state: EventState;
  dispatch: React.Dispatch<Action>;
  lastSyncAt: Date | null;
  conflictDetected: boolean;
  dismissConflict: () => void;
} | undefined>(undefined);


function createService(payload: AddServicePayload, sourceEquipmentId?: string, destinationEquipmentId?: string): Service {
    const base = {
        id: generateId(),
        sourceNodeId: payload.sourceNodeId,
        destinationNodeId: payload.destinationNodeId,
        sourceHandoffType: payload.sourceHandoffType as HandoffType,
        destinationHandoffType: payload.destinationHandoffType as HandoffType,
        sourceCableNumber: payload.sourceCableNumber,
        destinationCableNumber: payload.destinationCableNumber,
        sourceEquipmentId,
        destinationEquipmentId,
    };

    switch (payload.serviceType) {
        case 'Video': {
            const { audioChannels, audioMode, manualAudioChannels, manualAudioBitrateKbps } = payload;
    
            let audioBwForCalc = 0;
            let compressedAudioConfig: VideoService['compressedAudio'] | undefined = undefined;
            let audioNamePart: string;

            if (audioMode === 'manual') {
                const channels = manualAudioChannels || 0;
                const bitrateKbps = manualAudioBitrateKbps || 0;
                audioBwForCalc = (channels * bitrateKbps) / 1000; // to Mbps
                if (channels > 0 && bitrateKbps > 0) {
                    compressedAudioConfig = { channels, bitratePerChannelKbps: bitrateKbps };
                }
                audioNamePart = `${channels}ch @ ${bitrateKbps}kbps`;
            } else {
                audioBwForCalc = (audioChannels || 0) * UNCOMPRESSED_PCM_AUDIO_CHANNEL_BANDWIDTH_MBPS;
                audioNamePart = `${audioChannels || 0} aud ch`;
            }

            let calculatedVideoBandwidth: number;
            if (payload.bitrateMode === 'transport') {
                calculatedVideoBandwidth = (payload.transportStreamBandwidth || 0) - audioBwForCalc;
            } else { // 'video' mode
                calculatedVideoBandwidth = payload.videoBandwidth || 0;
            }
            
            const totalBandwidth = calculatedVideoBandwidth + audioBwForCalc;
            const name = payload.name || `${payload.codec} ${(payload.videoBandwidth || 0)}Mbps + ${audioNamePart}`;

            return {
                ...base,
                serviceType: 'Video',
                name,
                bandwidth: totalBandwidth > 0 ? totalBandwidth : 0,
                codec: payload.codec,
                videoBandwidth: calculatedVideoBandwidth > 0 ? calculatedVideoBandwidth : 0,
                audioChannels: payload.audioChannels || 0,
                audioBitrate: audioBwForCalc,
                compressedAudio: compressedAudioConfig,
                bitrateMode: payload.bitrateMode,
            };
        }
        case 'Audio': {
            let audioBandwidth: number;
            if (payload.audioType === 'Manual Input') {
                audioBandwidth = payload.bandwidth || 0;
            } else if (payload.audioType === 'MADI (125 Mbps Stream)') {
                audioBandwidth = MADI_STREAM_BANDWIDTH_MBPS;
            } else if (payload.audioType === 'MADI (per channel)') {
                audioBandwidth = (payload.channels || 0) * MADI_PER_CHANNEL_BANDWIDTH_MBPS;
            } else { // AES67, Dante
                audioBandwidth = (payload.channels || 0) * UNCOMPRESSED_PCM_AUDIO_CHANNEL_BANDWIDTH_MBPS;
            }
            
            const name = payload.name || (payload.audioType === 'Manual Input' ? `${(payload.bandwidth || 0)}Mbps Audio` : `${(payload.channels || 0)}ch ${payload.audioType}`);

            return {
                ...base,
                serviceType: 'Audio',
                name,
                bandwidth: audioBandwidth,
                audioType: payload.audioType,
                audioBandwidth: audioBandwidth,
                channels: payload.channels,
            };
        }
        case 'Data': {
            const name = payload.name || `${(payload.bandwidth || 0)}Mbps Data`;
            return {
                ...base,
                serviceType: 'Data',
                name,
                bandwidth: payload.bandwidth || 0,
                isAsymmetricLeg: payload.isAsymmetricLeg,
            };
        }
    }
}

function createCircuitFromPayload(payload: { circuitName?: string, nodeNames: string[] }, allNodes: Node[]): { circuit: Circuit; newNodes: Node[] } {
    const { nodeNames } = payload;
    let { circuitName } = payload;

    if (!circuitName && nodeNames.length >= 2) {
      circuitName = `${nodeNames[0]} to ${nodeNames[nodeNames.length - 1]}`;
      if (nodeNames.length > 2) {
         circuitName += ` via ${nodeNames.slice(1, -1).join(', ')}`;
      }
    } else if (!circuitName) {
        circuitName = 'New Circuit';
    }

    const existingNodesMap = new Map(allNodes.map(n => [n.name.toLowerCase(), n]));
    const nodesForCircuit: Node[] = [];
    const newNodes: Node[] = [];

    for (const name of nodeNames) {
        const lowerName = name.trim().toLowerCase();
        if (existingNodesMap.has(lowerName)) {
            nodesForCircuit.push(existingNodesMap.get(lowerName)!);
        } else {
            const newNode: Node = { id: generateId(), name: name.trim() };
            nodesForCircuit.push(newNode);
            newNodes.push(newNode);
            existingNodesMap.set(lowerName, newNode);
        }
    }
    
    const segments: Segment[] = [];
    const defaultSegmentValues = {
      maxBandwidth1to2Input: '1000',
      maxBandwidth1to2Unit: 'Mbps' as BandwidthUnit,
      softLimit1to2MbpsInput: '800',
      maxBandwidth2to1Input: '1000',
      maxBandwidth2to1Unit: 'Mbps' as BandwidthUnit,
      softLimit2to1MbpsInput: '800',
    };

    for (let i = 0; i < nodesForCircuit.length - 1; i++) {
        const node1 = nodesForCircuit[i];
        const node2 = nodesForCircuit[i+1];
        segments.push({
            id: generateId(),
            node1Id: node1.id,
            node2Id: node2.id,
            ...defaultSegmentValues,
        });
    }

    const circuit: Circuit = {
      id: generateId(),
      name: circuitName!,
      nodeIds: nodesForCircuit.map(n => n.id),
      segments,
      services: [],
    };
    
    return { circuit, newNodes };
}


const eventReducer = (state: EventState, action: Action): EventState => {
  switch (action.type) {
    case 'LOAD_STATE': {
        const savedState = action.payload;
        // Guard against null/undefined state from storage
        if (!savedState) {
            return state; // Keep current state if loaded state is invalid
        }
        // This destructuring is to safely remove the `failoverActive` property 
        // from older versions of the state that might still be persisted.
        const { failoverActive, ...restOfState } = savedState as any;
        return { ...initialState, ...restOfState };
    }

    case 'CREATE_EVENT_WITH_CIRCUIT': {
      const { eventName, nodeNames } = action.payload;
      const { circuit: newCircuit, newNodes } = createCircuitFromPayload({ nodeNames }, []);
      const newEvent: Event = {
        id: generateId(),
        name: eventName,
        nodes: newNodes,
        equipment: [],
        circuits: [newCircuit],
      };
      return {
        ...state,
        events: [...state.events, newEvent],
        activeEventId: newEvent.id,
        activeCircuitId: newCircuit.id,
        activeView: 'circuit',
      };
    }

    case 'ADD_CIRCUIT': {
        if (!state.activeEventId) return state;

        let newCircuitId = '';
        const newEvents = state.events.map(event => {
            if (event.id === state.activeEventId) {
                const { circuit: newCircuit, newNodes } = createCircuitFromPayload(action.payload, event.nodes);
                newCircuitId = newCircuit.id;
                return { 
                    ...event, 
                    nodes: [...event.nodes, ...newNodes],
                    circuits: [...event.circuits, newCircuit] 
                };
            }
            return event;
        });
        
        return {
            ...state,
            events: newEvents,
            activeCircuitId: newCircuitId,
            activeView: 'circuit',
        };
    }

    case 'REORDER_CIRCUITS': {
        if (!state.activeEventId) return state;
        const orderedIds = action.payload.reorderedCircuitIds;

        const updatedEvents = state.events.map((event) => {
            if (event.id !== state.activeEventId) return event;

            const circuitById = new Map(event.circuits.map((circuit) => [circuit.id, circuit]));
            const reorderedCircuits = orderedIds
                .map((id) => circuitById.get(id))
                .filter((circuit): circuit is Circuit => !!circuit);

            if (reorderedCircuits.length !== event.circuits.length) {
                return event;
            }

            return { ...event, circuits: reorderedCircuits };
        });

        return {
            ...state,
            events: updatedEvents,
        };
    }

    case 'UPDATE_CIRCUIT': {
        if (!state.activeEventId) return state;

        const { circuitId, circuitName, nodeNames } = action.payload;
        const normalizedNodeNames = nodeNames.map(name => name.trim()).filter(Boolean);
        if (normalizedNodeNames.length < 2) return state;

        const updatedEvents = state.events.map(event => {
            if (event.id !== state.activeEventId) return event;

            const existingCircuit = event.circuits.find(circuit => circuit.id === circuitId);
            if (!existingCircuit) return event;

            const { circuit: recalculatedCircuit, newNodes } = createCircuitFromPayload(
                { circuitName: circuitName.trim(), nodeNames: normalizedNodeNames },
                event.nodes
            );

            const updatedCircuits = event.circuits.map(circuit => {
                if (circuit.id !== circuitId) return circuit;
                return {
                    ...circuit,
                    name: recalculatedCircuit.name,
                    nodeIds: recalculatedCircuit.nodeIds,
                    segments: recalculatedCircuit.segments,
                };
            });

            return {
                ...event,
                nodes: [...event.nodes, ...newNodes],
                circuits: updatedCircuits,
            };
        });

        return {
            ...state,
            events: updatedEvents,
            activeCircuitId: circuitId,
            activeView: 'circuit',
        };
    }
    
    case 'DELETE_CIRCUIT': {
        if (!state.activeEventId) return state;

        let newActiveCircuitId = state.activeCircuitId;
        const newEvents = state.events.map(event => {
            if (event.id !== state.activeEventId) return event;
            const circuitsAfterDeletion = event.circuits.filter(c => c.id !== action.payload.circuitId);
            if (state.activeCircuitId === action.payload.circuitId) {
                newActiveCircuitId = circuitsAfterDeletion[0]?.id ?? null;
            }
            return { ...event, circuits: circuitsAfterDeletion };
        });

        return {
            ...state,
            events: newEvents,
            activeCircuitId: newActiveCircuitId,
        };
    }

    case 'DELETE_EVENT': {
        const { eventId } = action.payload;
        const eventsAfterDeletion = state.events.filter(e => e.id !== eventId);
        
        if (state.activeEventId !== eventId) return { ...state, events: eventsAfterDeletion };
        
        if (eventsAfterDeletion.length > 0) {
            const newActiveEvent = eventsAfterDeletion[0];
            return {
                ...state,
                events: eventsAfterDeletion,
                activeEventId: newActiveEvent.id,
                activeCircuitId: newActiveEvent.circuits[0]?.id ?? null,
                activeView: 'circuit',
            };
        } else {
            return { ...initialState };
        }
    }

    case 'SET_ACTIVE_EVENT': {
        const activeEvent = state.events.find(e => e.id === action.payload.eventId);
        const firstCircuitId = activeEvent?.circuits[0]?.id ?? null;
        return { ...state, activeEventId: action.payload.eventId, activeCircuitId: firstCircuitId, activeView: 'circuit' };
    }

    case 'SET_ACTIVE_CIRCUIT': {
        return { ...state, activeCircuitId: action.payload.circuitId, activeView: 'circuit' };
    }
    
    case 'SET_ACTIVE_VIEW': {
        return { ...state, activeView: action.payload.view };
    }

    case 'START_NEW_EVENT_CREATION': {
        return { ...state, activeEventId: null, activeCircuitId: null, activeView: 'circuit' };
    }
    
    case 'IMPORT_EVENT': {
        const importedEventFromFile = action.payload;
        const idMap = new Map<string, string>();
        const remap = (id: string | undefined) => {
            if (!id) return undefined;
            if (!idMap.has(id)) idMap.set(id, generateId());
            return idMap.get(id)!;
        };
        
        remap(importedEventFromFile.id);
        (importedEventFromFile.nodes || []).forEach(n => remap(n.id));
        (importedEventFromFile.equipment || []).forEach(e => remap(e.id));
        importedEventFromFile.circuits.forEach(c => {
            remap(c.id);
            c.services.forEach(s => remap(s.id));
        });
        
        const remappedEvent: Event = {
            id: remap(importedEventFromFile.id)!,
            name: state.events.some(e => e.name === importedEventFromFile.name) 
                ? `${importedEventFromFile.name} (Imported)` 
                : importedEventFromFile.name,
            nodes: (importedEventFromFile.nodes || []).map(n => ({...n, id: remap(n.id)!})),
            equipment: (importedEventFromFile.equipment || []).map(e => ({...e, id: remap(e.id)!, nodeId: remap(e.nodeId)!})),
            circuits: importedEventFromFile.circuits.map(c => ({
                ...c,
                id: remap(c.id)!,
                nodeIds: (c.nodeIds || []).map(id => remap(id)!),
                endpoint1EquipmentId: remap(c.endpoint1EquipmentId),
                endpoint2EquipmentId: remap(c.endpoint2EquipmentId),
                segments: (c.segments || []).map(s => ({ ...s, id: generateId(), node1Id: remap(s.node1Id)!, node2Id: remap(s.node2Id)! })),
                services: c.services.map(s => {
                    const { backupCircuitId, ...restOfService } = s as any;
                    return {
                        ...restOfService,
                        id: remap(s.id)!,
                        sourceNodeId: remap(s.sourceNodeId)!,
                        destinationNodeId: remap(s.destinationNodeId)!,
                        sourceEquipmentId: remap(s.sourceEquipmentId),
                        destinationEquipmentId: remap(s.destinationEquipmentId),
                    };
                }),
            })),
        };

        return {
            ...state,
            events: [...state.events, remappedEvent],
            activeEventId: remappedEvent.id,
            activeCircuitId: remappedEvent.circuits[0]?.id ?? null,
            activeView: 'circuit',
        };
    }

    case 'ADD_SERVICE': {
        if (!state.activeEventId || !state.activeCircuitId) return state;
        
        const payload = action.payload;
        let newLastJpegXsBitrate = state.lastJpegXsBitrate;
        if (payload.serviceType === 'Video' && payload.codec === 'JPEG-XS') {
            newLastJpegXsBitrate = payload.videoBandwidth || null;
        }

        const updatedEvents = state.events.map(event => {
            if (event.id !== state.activeEventId) return event;
            
            const updatedEquipment: Equipment[] = [...(event.equipment || [])];
            let sourceEquipmentId: string | undefined = payload.sourceEquipmentId;
            let destinationEquipmentId: string | undefined = payload.destinationEquipmentId;

            if (payload.sourceEquipmentId === 'new' && payload.sourceEquipmentName) {
                const newEquipment = { id: generateId(), name: payload.sourceEquipmentName, nodeId: payload.sourceNodeId, assetNumber: undefined };
                updatedEquipment.push(newEquipment);
                sourceEquipmentId = newEquipment.id;
            }

            if (payload.destinationEquipmentId === 'new' && payload.destinationEquipmentName) {
                const newEquipment = { id: generateId(), name: payload.destinationEquipmentName, nodeId: payload.destinationNodeId, assetNumber: undefined };
                updatedEquipment.push(newEquipment);
                destinationEquipmentId = newEquipment.id;
            }

            const newService = createService(payload, sourceEquipmentId, destinationEquipmentId);
            
            const updatedCircuits = event.circuits.map(circuit => {
                if (circuit.id === state.activeCircuitId) {
                    return { ...circuit, services: [...circuit.services, newService] };
                }
                return circuit;
            });
            return { ...event, equipment: updatedEquipment, circuits: updatedCircuits };
        });

        return {
            ...state,
            lastJpegXsBitrate: newLastJpegXsBitrate,
            events: updatedEvents,
        };
    }

    case 'DUPLICATE_SERVICE': {
        if (!state.activeEventId || !state.activeCircuitId) return state;

        let newLastJpegXsBitrate = state.lastJpegXsBitrate;
        const updatedEvents = state.events.map(event => {
            if (event.id !== state.activeEventId) return event;

            const updatedCircuits = event.circuits.map(circuit => {
                if (circuit.id !== state.activeCircuitId) return circuit;
                const serviceToCopy = circuit.services.find(s => s.id === action.payload.serviceId);
                if (!serviceToCopy) return circuit;

                const duplicatedService = {
                    ...serviceToCopy,
                    id: generateId(),
                    name: `${serviceToCopy.name} (Copy)`,
                };

                if (
                    duplicatedService.serviceType === 'Video' &&
                    (duplicatedService as VideoService).codec === 'JPEG-XS' &&
                    (duplicatedService as VideoService).bitrateMode === 'video'
                ) {
                    newLastJpegXsBitrate = (duplicatedService as VideoService).videoBandwidth;
                }

                return { ...circuit, services: [...circuit.services, duplicatedService] };
            });

            return { ...event, circuits: updatedCircuits };
        });

        return { ...state, lastJpegXsBitrate: newLastJpegXsBitrate, events: updatedEvents };
    }
    
    case 'UPDATE_CIRCUIT_ENDPOINTS': {
        if (!state.activeEventId || !state.activeCircuitId) return state;
        
        const updatedEvents = state.events.map(event => {
            if (event.id !== state.activeEventId) return event;

            const circuitToUpdate = event.circuits.find(c => c.id === state.activeCircuitId);
            if (!circuitToUpdate || !circuitToUpdate.nodeIds || circuitToUpdate.nodeIds.length < 2) return event;
            
            const { updates } = action.payload;
            const updatedEquipmentList: Equipment[] = [...(event.equipment || [])];
            
            let endpoint1EquipmentId = updates.endpoint1EquipmentId;
            if (updates.endpoint1EquipmentId === 'new' && updates.endpoint1NewEquipmentName) {
                const endpoint1NodeId = circuitToUpdate.nodeIds[0];
                const newEq = { id: generateId(), name: updates.endpoint1NewEquipmentName, nodeId: endpoint1NodeId, assetNumber: updates.endpoint1NewAssetNumber };
                updatedEquipmentList.push(newEq);
                endpoint1EquipmentId = newEq.id;
            }

            let endpoint2EquipmentId = updates.endpoint2EquipmentId;
            const lastNodeIndex = circuitToUpdate.nodeIds.length - 1;
            if (updates.endpoint2EquipmentId === 'new' && updates.endpoint2NewEquipmentName) {
                const endpoint2NodeId = circuitToUpdate.nodeIds[lastNodeIndex];
                const newEq = { id: generateId(), name: updates.endpoint2NewEquipmentName, nodeId: endpoint2NodeId, assetNumber: updates.endpoint2NewAssetNumber };
                updatedEquipmentList.push(newEq);
                endpoint2EquipmentId = newEq.id;
            }

            const updatedCircuits = event.circuits.map(circuit => {
                if (circuit.id === state.activeCircuitId) {
                    return {
                        ...circuit,
                        endpoint1HandoffType: (updates.endpoint1HandoffType as HandoffType) || undefined,
                        endpoint1EquipmentId: endpoint1EquipmentId === 'new' ? undefined : (endpoint1EquipmentId || undefined),
                        endpoint2HandoffType: (updates.endpoint2HandoffType as HandoffType) || undefined,
                        endpoint2EquipmentId: endpoint2EquipmentId === 'new' ? undefined : (endpoint2EquipmentId || undefined),
                    };
                }
                return circuit;
            });
            return { ...event, circuits: updatedCircuits, equipment: updatedEquipmentList };
        });

        return { ...state, events: updatedEvents };
    }
    
    case 'ADD_NODE': {
      if (!state.activeEventId) return state;
      return {
        ...state,
        events: state.events.map(event => 
          event.id === state.activeEventId 
            ? { ...event, nodes: [...(event.nodes || []), { id: generateId(), name: action.payload.name }] } 
            : event
        ),
      };
    }
    
    case 'DELETE_NODE': {
        if (!state.activeEventId) return state;
        return {
            ...state,
            events: state.events.map(event => {
                if (event.id !== state.activeEventId) return event;
                
                const nodeIdToDelete = action.payload.nodeId;
    
                const isNodeInUseInCircuitPath = event.circuits.some(c => 
                    (c.nodeIds || []).includes(nodeIdToDelete)
                );
                
                if (isNodeInUseInCircuitPath) {
                    alert("This node is currently part of a circuit's path and cannot be deleted.");
                    return event;
                }
    
                // Also check if any service directly uses this node.
                const isNodeInUseInServices = event.circuits.some(c => 
                    c.services.some(s => s.sourceNodeId === nodeIdToDelete || s.destinationNodeId === nodeIdToDelete)
                );
    
                if (isNodeInUseInServices) {
                    alert("This node is currently used as an endpoint for a service and cannot be deleted.");
                    return event;
                }
    
                return {
                    ...event,
                    nodes: (event.nodes || []).filter(n => n.id !== nodeIdToDelete),
                    // When a node is deleted, equipment at that node becomes unassigned.
                    equipment: (event.equipment || []).map(e => 
                        e.nodeId === nodeIdToDelete ? { ...e, nodeId: undefined } : e
                    ),
                };
            }),
        };
    }

    case 'UPDATE_NODE': {
        if (!state.activeEventId) return state;
        const trimmedName = action.payload.name.trim();
        if (!trimmedName) return state;

        return {
            ...state,
            events: state.events.map(event => {
                if (event.id !== state.activeEventId) return event;

                const duplicateExists = (event.nodes || []).some(
                    node => node.id !== action.payload.nodeId && node.name.trim().toLowerCase() === trimmedName.toLowerCase()
                );
                if (duplicateExists) return event;

                return {
                    ...event,
                    nodes: (event.nodes || []).map(node =>
                        node.id === action.payload.nodeId ? { ...node, name: trimmedName } : node
                    ),
                };
            }),
        };
    }

    case 'ADD_EQUIPMENT':
    case 'UPDATE_EQUIPMENT':
    case 'DELETE_EQUIPMENT':
    case 'DELETE_MULTIPLE_EQUIPMENT': {
        if (!state.activeEventId) return state;
        return {
            ...state,
            events: state.events.map(event => {
                if (event.id !== state.activeEventId) return event;
                let newEquipment: Equipment[] = [...(event.equipment || [])];
                if (action.type === 'ADD_EQUIPMENT') {
                    newEquipment.push({ id: generateId(), ...action.payload });
                } else if (action.type === 'UPDATE_EQUIPMENT') {
                    newEquipment = newEquipment.map(e => e.id === action.payload.id ? { ...e, ...action.payload.values } : e);
                } else if (action.type === 'DELETE_EQUIPMENT') {
                    // TODO: Check if equipment is in use before deleting
                    newEquipment = newEquipment.filter(e => e.id !== action.payload.equipmentId);
                } else if (action.type === 'DELETE_MULTIPLE_EQUIPMENT') {
                    const equipmentIdsToDelete = new Set(action.payload.equipmentIds);
                    // TODO: Check if equipment is in use before deleting
                    newEquipment = newEquipment.filter(e => !equipmentIdsToDelete.has(e.id));
                }
                return { ...event, equipment: newEquipment };
            }),
        };
    }
    
    case 'IMPORT_EQUIPMENT': {
        if (!state.activeEventId) return state;
        const newEquipment = action.payload.equipment.map(eq => ({
            id: generateId(),
            ...eq,
        })) as Equipment[];
        
        return {
            ...state,
            events: state.events.map(event => {
                if (event.id !== state.activeEventId) return event;
                // Avoid duplicates based on assetNumber
                const existingAssetNumbers = new Set((event.equipment || []).map(e => e.assetNumber).filter(Boolean));
                const uniqueNewEquipment = newEquipment.filter(e => !e.assetNumber || !existingAssetNumbers.has(e.assetNumber));

                return {
                    ...event,
                    equipment: [...(event.equipment || []), ...uniqueNewEquipment],
                };
            }),
        };
    }


    case 'UPDATE_SERVICE': {
        if (!state.activeEventId || !state.activeCircuitId) return state;
        const { updatedService } = action.payload;
        let newLastJpegXsBitrate = state.lastJpegXsBitrate;
        if (updatedService.serviceType === 'Video' && (updatedService as VideoService).codec === 'JPEG-XS' && (updatedService as VideoService).bitrateMode === 'video') {
            newLastJpegXsBitrate = (updatedService as VideoService).videoBandwidth;
        }

        const updatedEvents = state.events.map(event => {
            if (event.id !== state.activeEventId) return event;
            const updatedCircuits = event.circuits.map(circuit => {
                if (circuit.id !== state.activeCircuitId) return circuit;
                return { ...circuit, services: circuit.services.map(s => s.id === updatedService.id ? updatedService : s) };
            });
            return { ...event, circuits: updatedCircuits };
        });

        return { ...state, lastJpegXsBitrate: newLastJpegXsBitrate, events: updatedEvents };
    }

    case 'UPDATE_SEGMENT':
    case 'DELETE_SERVICE':
    case 'REORDER_SERVICES': {
        if (!state.activeEventId) return state;
        const updateEvent = (event: Event): Event => {
            const updatedCircuits = event.circuits.map(circuit => {
                if (circuit.id !== state.activeCircuitId) return circuit;
                switch (action.type) {
                    case 'UPDATE_SEGMENT':
                        return { ...circuit, segments: circuit.segments.map(segment => segment.id === action.payload.segmentId ? { ...segment, ...action.payload.newValues } : segment) };
                    case 'DELETE_SERVICE':
                        return { ...circuit, services: circuit.services.filter(s => s.id !== action.payload.serviceId) };
                    case 'REORDER_SERVICES':
                        return { ...circuit, services: action.payload.reorderedServices };
                    default: return circuit;
                }
            });
            return { ...event, circuits: updatedCircuits };
        }
        return { ...state, events: state.events.map(event => event.id === state.activeEventId ? updateEvent(event) : event) };
      }

    default:
      return state;
  }
};

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(eventReducer, initialState);
  const [lastSyncAt, setLastSyncAt] = React.useState<Date | null>(null);
  const [conflictDetected, setConflictDetected] = React.useState(false);
  const clientIdRef = useRef(generateId());
  const stateRef = useRef<EventState>(state);
  const hasLoadedRef = useRef(false);
  const lastSavedEventsRef = useRef<string>('');
  const lastLoadedEventsRef = useRef<string>('');
  const localChangeSinceLastLoadRef = useRef(false);
  const lastLocalSaveAtRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const reconcileState = (events: Event[], current: EventState): EventState => {
      let activeEventId = current.activeEventId;
      if (!events.find(e => e.id === activeEventId)) {
          activeEventId = events[0]?.id ?? null;
      }

      const activeEvent = events.find(e => e.id === activeEventId) || null;
      let activeCircuitId = current.activeCircuitId;
      if (!activeEvent || !activeEvent.circuits.some(c => c.id === activeCircuitId)) {
          activeCircuitId = activeEvent?.circuits[0]?.id ?? null;
      }

      return {
          ...current,
          events,
          activeEventId,
          activeCircuitId,
      };
  };

  const loadEvents = async () => {
      try {
          const response = await fetch(EVENTS_API_URL, { cache: 'no-store' });
          const data = await response.json();
          const events = Array.isArray(data?.events) ? data.events : [];
          const nextState = reconcileState(events, stateRef.current ?? initialState);
          const serialized = JSON.stringify(events);
          lastSavedEventsRef.current = serialized;
          lastLoadedEventsRef.current = serialized;
          localChangeSinceLastLoadRef.current = false;
          hasLoadedRef.current = true;
          dispatch({ type: 'LOAD_STATE', payload: nextState });
          setLastSyncAt(new Date());
      } catch (error) {
          console.error('Could not load events from server', error);
      }
  };

  useEffect(() => {
      void loadEvents();
  }, []);

  useEffect(() => {
      if (!hasLoadedRef.current) return;
      const serialized = JSON.stringify(state.events);
      if (serialized !== lastLoadedEventsRef.current) {
          localChangeSinceLastLoadRef.current = true;
      }
      if (serialized === lastSavedEventsRef.current) return;
      lastSavedEventsRef.current = serialized;

      const persist = async () => {
          try {
              await fetch(EVENTS_API_URL, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ events: state.events, clientId: clientIdRef.current }),
              });
              lastLocalSaveAtRef.current = Date.now();
              lastLoadedEventsRef.current = serialized;
              localChangeSinceLastLoadRef.current = false;
          } catch (error) {
              console.error('Could not save events to server', error);
          }
      };
      void persist();
  }, [state.events]);

  useEffect(() => {
      const eventSource = new EventSource('/api/events/stream');
      eventSource.onmessage = (event) => {
          let payload: { timestamp?: number; clientId?: string | null } = {};
          try {
              payload = JSON.parse(event.data) as { timestamp?: number; clientId?: string | null };
          } catch {
              payload = {};
          }

          if (payload.clientId && payload.clientId === clientIdRef.current) {
              setConflictDetected(false);
              void loadEvents();
              return;
          }

          const now = Date.now();
          const likelyOwnUpdate = now - lastLocalSaveAtRef.current < 10000;
          if (localChangeSinceLastLoadRef.current && !likelyOwnUpdate) {
              setConflictDetected(true);
          }
          void loadEvents();
      };
      eventSource.onerror = () => {
          eventSource.close();
      };
      return () => {
          eventSource.close();
      };
  }, []);

  return (
    <EventContext.Provider
      value={{
        state,
        dispatch,
        lastSyncAt,
        conflictDetected,
        dismissConflict: () => setConflictDetected(false),
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
    const context = useContext(EventContext);
    if (context === undefined) {
      throw new Error('useEvent must be used within a EventProvider');
    }
    const { state, dispatch, lastSyncAt, conflictDetected, dismissConflict } = context;
    const { events, activeEventId, activeCircuitId, lastJpegXsBitrate, activeView } = state;
    
    const activeEvent = events.find(e => e.id === activeEventId) || null;
      
    const activeCircuit = activeEvent && activeCircuitId
      ? activeEvent.circuits.find(c => c.id === activeCircuitId) || activeEvent.circuits[0] || null
      : null;
      
    return { events, activeEvent, activeCircuit, dispatch, lastJpegXsBitrate, activeView, lastSyncAt, conflictDetected, dismissConflict };
};
