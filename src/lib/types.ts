'use client';

import type { VIDEO_CODEC_TYPES, AUDIO_TYPES, HANDOFF_TYPES } from './config';

export type BandwidthUnit = 'Kbps' | 'Mbps' | 'Gbps';

export const bandwidthUnits: BandwidthUnit[] = ['Kbps', 'Mbps', 'Gbps'];

export interface Node {
  id: string;
  name: string;
}

export interface Equipment {
  id: string;
  name: string;
  modelNumber?: string;
  description?: string;
  nodeId?: string;
  assetNumber?: string;
}

export interface Segment {
  id:string;
  node1Id: string;
  node2Id: string;

  // Limits for Node 1 -> Node 2
  maxBandwidth1to2Input: string;
  maxBandwidth1to2Unit: BandwidthUnit;
  softLimit1to2MbpsInput: string;

  // Limits for Node 2 -> Node 1
  maxBandwidth2to1Input: string;
  maxBandwidth2to1Unit: BandwidthUnit;
  softLimit2to1MbpsInput: string;
}

// --- New Service Types ---

export type VideoCodec = (typeof VIDEO_CODEC_TYPES)[number];
export type AudioType = (typeof AUDIO_TYPES)[number];
export type HandoffType = (typeof HANDOFF_TYPES)[number];
export interface AudioLayoutTrack {
  track: number;
  level: number;
  group: number;
  content: string;
  notes?: string;
}

interface BaseService {
  id: string;
  name: string; // Will be auto-generated if not provided
  bandwidth: number; // Final calculated bandwidth in Mbps
  sourceNodeId: string;
  destinationNodeId: string;
  sourceHandoffType: HandoffType;
  destinationHandoffType: HandoffType;
  sourceCableNumber?: string;
  destinationCableNumber?: string;
  sourceEquipmentId?: string;
  destinationEquipmentId?: string;
}

export interface VideoService extends BaseService {
  serviceType: 'Video';
  codec: VideoCodec;
  videoBandwidth: number;
  audioChannels: number;
  audioLayout?: AudioLayoutTrack[];
  audioBitrate?: number;
  compressedAudio?: {
      channels: number;
      bitratePerChannelKbps: number;
  };
  bitrateMode?: 'video' | 'transport';
}

export interface AudioService extends BaseService {
  serviceType: 'Audio';
  audioType: AudioType;
  // For channel based, this is calculated. For manual, it's user input.
  audioBandwidth: number;
  // Only for channel based
  channels?: number;
}

export interface DataService extends BaseService {
  serviceType: 'Data';
  isAsymmetricLeg?: boolean;
}

export type Service = VideoService | AudioService | DataService;
// --- End New Service Types ---

export interface Circuit {
  id: string;
  name: string;
  nodeIds: string[];
  segments: Segment[];
  services: Service[];
  endpoint1HandoffType?: HandoffType;
  endpoint1EquipmentId?: string;
  endpoint2HandoffType?: HandoffType;
  endpoint2EquipmentId?: string;
}

export interface Event {
  id: string;
  name: string;
  nodes: Node[];
  equipment: Equipment[];
  circuits: Circuit[];
}
