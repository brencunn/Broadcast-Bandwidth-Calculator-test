import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { BandwidthUnit, Circuit, DataService, Node, Service, VideoService, Event, Segment } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertBandwidthToMbps(value: number, unit: BandwidthUnit): number {
  switch (unit) {
    case 'Kbps':
      return value / 1000;
    case 'Gbps':
      return value * 1000;
    case 'Mbps':
    default:
      return value;
  }
}

export function formatBandwidthForDisplay(mbps: number): string {
  if (mbps >= 1000) {
      const gbps = mbps / 1000;
      return `${parseFloat(gbps.toFixed(2))} Gbps`;
  }
  return `${parseFloat(mbps.toFixed(2))} Mbps`;
}


// Helper function to find the path a service takes using BFS
export function findPath(sourceId: string, destId: string, circuit: Circuit, allNodes: Node[]): string[] {
    if (sourceId === destId) return [sourceId];

    if (!allNodes) return [];
    
    const nodeExists = (id: string) => allNodes.some(n => n.id === id);
    if (!nodeExists(sourceId) || !nodeExists(destId)) {
        return [];
    }

    const adj: { [key: string]: string[] } = {};
    for (const node of allNodes) {
        adj[node.id] = [];
    }
    for (const segment of circuit.segments) {
        adj[segment.node1Id].push(segment.node2Id);
        adj[segment.node2Id].push(segment.node1Id);
    }

    const queue: string[][] = [[sourceId]];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
        const path = queue.shift()!;
        const lastNodeId = path[path.length - 1];

        if (lastNodeId === destId) {
            return path;
        }

        for (const neighbor of adj[lastNodeId]) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                const newPath = [...path, neighbor];
                queue.push(newPath);
            }
        }
    }

    return []; // No path found
}


export function calculateAllEventMetrics(event: Event) {
    const serviceToCircuitMap = new Map<string, Circuit>();
    event.circuits.forEach(circuit => {
        circuit.services.forEach(service => {
            serviceToCircuitMap.set(service.id, circuit);
        });
    });

    const allSegments = new Map<string, Segment>();
    const allServices: Service[] = [];
    event.circuits.forEach(circuit => {
        (circuit.segments || []).forEach(segment => {
            if (!allSegments.has(segment.id)) {
                allSegments.set(segment.id, segment);
            }
        });
        allServices.push(...circuit.services);
    });

    const nodes = event.nodes || [];
    const segments = Array.from(allSegments.values());

    const nodeServiceCount = new Map<string, number>();
    nodes.forEach(node => nodeServiceCount.set(node.id, 0));
    
    const segmentServiceCount = new Map<string, number>();
    segments.forEach(segment => segmentServiceCount.set(segment.id, 0));

    const segmentUtils = new Map<string, { util1to2: number, util2to1: number }>();
    segments.forEach(s => segmentUtils.set(s.id, { util1to2: 0, util2to1: 0 }));

    for (const service of allServices) {
        const circuitForService = serviceToCircuitMap.get(service.id);
        
        if (!circuitForService) continue;
        
        const { sourceNodeId, destinationNodeId, bandwidth } = service;
        const path = findPath(sourceNodeId, destinationNodeId, circuitForService, nodes);

        const uniqueNodesInPath = new Set(path);
        uniqueNodesInPath.forEach(nodeId => {
             nodeServiceCount.set(nodeId, (nodeServiceCount.get(nodeId) || 0) + 1);
        });

        for (let i = 0; i < path.length - 1; i++) {
            const nodeA = path[i];
            const nodeB = path[i+1];
            
            const segment = (circuitForService.segments || []).find(s => 
                (s.node1Id === nodeA && s.node2Id === nodeB) ||
                (s.node1Id === nodeB && s.node2Id === nodeA)
            );

            if (segment) {
                segmentServiceCount.set(segment.id, (segmentServiceCount.get(segment.id) || 0) + 1);
                
                const segmentUtil = segmentUtils.get(segment.id);
                if (segmentUtil) {
                    const isBidirectionalData = service.serviceType === 'Data' && !(service as DataService).isAsymmetricLeg;

                    if (isBidirectionalData) {
                       segmentUtil.util1to2 += bandwidth;
                       segmentUtil.util2to1 += bandwidth;
                    } else {
                       if (segment.node1Id === nodeA && segment.node2Id === nodeB) {
                           segmentUtil.util1to2 += bandwidth;
                       } else {
                           segmentUtil.util2to1 += bandwidth;
                       }
                    }
                }
            }
        }
    }

    return { nodes, segments, nodeServiceCount, segmentServiceCount, segmentUtils };
}


// Main calculation function
export function calculateUtilisation(circuit: Circuit, allNodes: Node[]) {
    if (!circuit || circuit.segments.length === 0) {
      return [];
    }
  
    const { segments, services } = circuit;
  
    const segmentUtils: { [key: string]: { util1to2: number, util2to1: number } } = {};
    segments.forEach(s => segmentUtils[s.id] = { util1to2: 0, util2to1: 0 });

    for (const service of services) {
        const { sourceNodeId, destinationNodeId, bandwidth } = service;
        const path = findPath(sourceNodeId, destinationNodeId, circuit, allNodes);

        for (let i = 0; i < path.length - 1; i++) {
            const nodeA = path[i];
            const nodeB = path[i+1];
            
            const segment = segments.find(s => 
                (s.node1Id === nodeA && s.node2Id === nodeB) ||
                (s.node1Id === nodeB && s.node2Id === nodeA)
            );

            if (segment) {
                const isBidirectionalData = service.serviceType === 'Data' && !(service as DataService).isAsymmetricLeg;

                if (isBidirectionalData) {
                    segmentUtils[segment.id].util1to2 += bandwidth;
                    segmentUtils[segment.id].util2to1 += bandwidth;
                } else {
                    if (segment.node1Id === nodeA && segment.node2Id === nodeB) {
                        segmentUtils[segment.id].util1to2 += bandwidth;
                    } else {
                        segmentUtils[segment.id].util2to1 += bandwidth;
                    }
                }
            }
        }
    }

    return segments.map(s => ({
        segmentId: s.id,
        util1to2: segmentUtils[s.id].util1to2,
        util2to1: segmentUtils[s.id].util2to1,
    }));
}

export function getServiceDetails(service: Service) {
    switch (service.serviceType) {
        case 'Video': {
            const videoService = service as VideoService;
            let audioDetail: string;

            if (videoService.compressedAudio) {
                audioDetail = `${videoService.compressedAudio.channels} ch @ ${videoService.compressedAudio.bitratePerChannelKbps}kbps`;
            } else {
                audioDetail = `${videoService.audioChannels} ch (uncompressed)`;
            }
            
            return `${videoService.codec}, ${audioDetail}`;
        }
        case 'Audio':
             return service.channels ? `${service.audioType}, ${service.channels} ch` : service.audioType;
        case 'Data': {
             const dataService = service as DataService;
             if (dataService.isAsymmetricLeg) {
                return 'Asymmetric Data Leg';
             }
             return 'Data Service';
        }
    }
}
