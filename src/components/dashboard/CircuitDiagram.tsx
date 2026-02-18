'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { Circuit, Node, Service, Event, Segment, DataService } from '@/lib/types';
import { convertBandwidthToMbps, calculateAllEventMetrics } from '@/lib/utils';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import { useEvent } from '@/context/EventContext';


const WEATTHERMAP_COLORS = {
  healthy: '#16a34a',
  approaching: '#facc15',
  overSoft: '#f97316',
  overMax: '#ef4444',
  notConfigured: '#64748b'
};

const LegendItem = ({ color, label }: { color: string; label: string }) => (
    <div className="flex items-center gap-2">
        <div className="w-10 h-1.5 rounded" style={{ backgroundColor: color }} />
        <span className="text-sm text-muted-foreground">{label}</span>
    </div>
);

const WeathermapLegend = () => (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 p-4 border rounded-lg bg-muted/50">
        <LegendItem color={WEATTHERMAP_COLORS.healthy} label="Healthy" />
        <LegendItem color={WEATTHERMAP_COLORS.approaching} label="Approaching Limit" />
        <LegendItem color={WEATTHERMAP_COLORS.overSoft} label="Over Soft Limit" />
        <LegendItem color={WEATTHERMAP_COLORS.overMax} label="Over Max Limit" />
        <LegendItem color={WEATTHERMAP_COLORS.notConfigured} label="Not Configured" />
    </div>
);


export default function CircuitDiagram() {
    const { activeEvent: event } = useEvent();
    const [cy, setCy] = useState<cytoscape.Core | null>(null);
    const { elements, stylesheet, layout, hasOnlyNodes } = useMemo(() => {
        if (!event || !event.nodes) {
            return { elements: [], stylesheet: [], layout: { name: 'preset' }, hasOnlyNodes: false };
        }
        
        const { nodes, segments, nodeServiceCount, segmentServiceCount, segmentUtils } = calculateAllEventMetrics(event);
        
        const nodeColors = new Map<string, string>();
        const colorPalette = [
            '#2196F3', '#4CAF50', '#FFC107', '#F44336', '#9C27B0',
            '#00BCD4', '#FF9800', '#E91E63', '#8BC34A', '#673AB7',
            '#009688', '#FF5722', '#607D8B', '#795548', '#3F51B5'
        ];
        nodes.forEach((node, index) => {
            nodeColors.set(node.id, colorPalette[index % colorPalette.length]);
        });


        const getNodeSize = (node: cytoscape.NodeSingular) => {
            const serviceCount = node.data('serviceCount') || 0;
            // Base size 10, increments by 3, max increment 20 (so max size is 30)
            const size = 10 + Math.min(serviceCount * 3, 20);
            return size;
        };

        const nodeStyle = {
            selector: 'node',
            style: {
                'label': 'data(label)',
                'background-color': 'data(color)',
                'color': '#FFFFFF',
                'text-valign': 'bottom',
                'text-halign': 'center',
                'text-margin-y': 8,
                'font-size': '12px',
                'font-weight': 'bold',
                'width': getNodeSize,
                'height': getNodeSize,
                'text-wrap': 'wrap',
                'text-max-width': '80px',
            }
        };

        const initialCyNodes = nodes.map(node => ({
            data: {
                id: node.id,
                label: node.name,
                serviceCount: nodeServiceCount.get(node.id) || 0,
                color: nodeColors.get(node.id) || '#cccccc',
            }
        }));

        let positionedNodes = initialCyNodes;

        if (initialCyNodes.length > 0) {
            const centralNode = initialCyNodes.length > 1 ? initialCyNodes.reduce((max, node) =>
                (node.data.serviceCount > max.data.serviceCount ? node : max),
                initialCyNodes[0]
            ) : initialCyNodes[0];

            const otherNodes = initialCyNodes.filter(n => n.data.id !== centralNode.data.id);
            const radius = 250;
            const angleStep = otherNodes.length > 0 ? (2 * Math.PI) / otherNodes.length : 0;

            positionedNodes = initialCyNodes.map(node => {
                if (node.data.id === centralNode.data.id) {
                    return { ...node, position: { x: 0, y: 0 } };
                }
                const index = otherNodes.findIndex(n => n.data.id === node.data.id);
                if (index === -1) return { ...node, position: { x: 0, y: 0 } };

                const angle = index * angleStep;
                return {
                    ...node,
                    position: {
                        x: radius * Math.cos(angle),
                        y: radius * Math.sin(angle)
                    }
                };
            });
        }


        if (segments.length === 0) {
            return {
                elements: positionedNodes,
                stylesheet: [nodeStyle],
                layout: { name: 'preset', padding: 70, fit: true },
                hasOnlyNodes: true,
            };
        }
        
        const validNodeIds = new Set(initialCyNodes.map(n => n.data.id));

        const cyEdges = segments.flatMap(segment => {
            if (!validNodeIds.has(segment.node1Id) || !validNodeIds.has(segment.node2Id)) {
                return []; // Skip edge if one of its nodes doesn't exist.
            }
            const util = segmentUtils.get(segment.id) || { util1to2: 0, util2to1: 0 };
            const serviceCount = segmentServiceCount.get(segment.id) || 0;
            const maxBw1to2 = convertBandwidthToMbps(parseFloat(segment.maxBandwidth1to2Input) || 0, segment.maxBandwidth1to2Unit);
            const softBw1to2 = parseFloat(segment.softLimit1to2MbpsInput) || 0;
            const maxBw2to1 = convertBandwidthToMbps(parseFloat(segment.maxBandwidth2to1Input) || 0, segment.maxBandwidth2to1Unit);
            const softBw2to1 = parseFloat(segment.softLimit2to1MbpsInput) || 0;

            return [
                { data: { id: `${segment.id}-1to2`, source: segment.node1Id, target: segment.node2Id, util: util.util1to2, maxBw: maxBw1to2, softBw: softBw1to2, serviceCount } },
                { data: { id: `${segment.id}-2to1`, source: segment.node2Id, target: segment.node1Id, util: util.util2to1, maxBw: maxBw2to1, softBw: softBw2to1, serviceCount } }
            ];
        });

        const cytoscapeElements = [...positionedNodes, ...cyEdges];

        const getEdgeColor = (edge: cytoscape.EdgeSingular) => {
            const util = edge.data('util');
            const maxBw = edge.data('maxBw');
            const softBw = edge.data('softBw');
            
            if (maxBw === 0) return util > 0 ? WEATTHERMAP_COLORS.overMax : WEATTHERMAP_COLORS.notConfigured;
            if (util > maxBw) return WEATTHERMAP_COLORS.overMax;
            if (softBw > 0 && util > softBw) return WEATTHERMAP_COLORS.overSoft;
            const warningThreshold = (softBw > 0 ? softBw : maxBw) * 0.75;
            if (warningThreshold > 0 && util >= warningThreshold) return WEATTHERMAP_COLORS.approaching;
            return WEATTHERMAP_COLORS.healthy;
        };

        const getEdgeWidth = (edge: cytoscape.EdgeSingular) => {
            const serviceCount = edge.data('serviceCount') || 0;
            if (serviceCount <= 0) return 1.5;
            if (serviceCount >= 10) return 8;
            if (serviceCount >= 5) return 6;
            if (serviceCount >= 2) return 4;
            return 2;
        };

        const getEdgeLineStyle = (edge: cytoscape.EdgeSingular) => {
            const util = edge.data('util');
            return util > 0 ? 'dashed' : 'solid';
        };

        const cytoscapeStylesheet: cytoscape.Stylesheet[] = [
            nodeStyle,
            {
                selector: 'edge',
                style: {
                    'width': getEdgeWidth,
                    'line-color': getEdgeColor,
                    'target-arrow-color': getEdgeColor,
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'control-point-step-size': 20,
                    'line-style': getEdgeLineStyle,
                    'line-dash-pattern': [10, 5],
                }
            }
        ];
        
        const cytoscapeLayout = {
            name: 'preset',
            fit: true,
            padding: 100,
        };

        return { elements: cytoscapeElements, stylesheet: cytoscapeStylesheet, layout: cytoscapeLayout, hasOnlyNodes: false };

    }, [event]);

    useEffect(() => {
        if (!cy) return;
    
        let animationFrameId: number;
        let offset = 0;
    
        const animate = () => {
          offset -= 0.5;
          cy.edges('[util > 0]').style('line-dash-offset', offset);
          animationFrameId = requestAnimationFrame(animate);
        };
    
        animate();
    
        return () => {
          cancelAnimationFrame(animationFrameId);
        };
      }, [cy]);

    if (!event || elements.length === 0) {
        return <p className="text-muted-foreground text-center py-4">No circuits defined in this event to draw a map.</p>;
    }
    
    if (hasOnlyNodes) {
        return (
             <div className="flex flex-col items-center w-full">
                <CytoscapeComponent elements={elements} stylesheet={stylesheet} layout={layout} style={{ width: '100%', height: '450px' }} className="border rounded-lg" />
                <p className="text-muted-foreground text-center py-4 mt-4">This event has nodes but no connecting segments. The weathermap cannot be fully drawn.</p>
             </div>
         )
    }

    return (
        <div className="flex flex-col items-center w-full">
            <CytoscapeComponent
                elements={elements}
                stylesheet={stylesheet}
                layout={layout}
                style={{ width: '100%', height: '450px' }}
                className="border rounded-lg"
                cy={setCy}
            />
            <WeathermapLegend />
        </div>
    );
}
