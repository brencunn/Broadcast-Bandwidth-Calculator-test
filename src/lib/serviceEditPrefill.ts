import type { AudioType, VideoCodec, VideoService, AudioService } from '@/lib/types';
import { AUDIO_TYPES, VIDEO_CODEC_TYPES } from '@/lib/config';

export function normalizeVideoCodec(rawCodec: string | undefined): VideoCodec {
  const raw = (rawCodec || '').toString().trim();
  const normalized = raw.toUpperCase().replace(/[\s_-]/g, '');

  if (VIDEO_CODEC_TYPES.includes(raw as VideoCodec)) return raw as VideoCodec;
  if (normalized === 'J2K' || normalized === 'JPEG2000') return 'JPEG-2000';
  if (normalized === 'JPEGXS' || normalized === 'JPEGX/S') return 'JPEG-XS';
  if (normalized === 'H265' || normalized === 'HEVC') return 'H.265 (HEVC)';
  if (normalized === 'H264') return 'H.264';
  return 'Other';
}

export function normalizeAudioType(rawType: string | undefined): AudioType {
  const raw = (rawType || '').toString().trim();
  const normalized = raw.toUpperCase().replace(/[\s_-]/g, '');

  if (AUDIO_TYPES.includes(raw as AudioType)) return raw as AudioType;
  if (normalized === 'MADI') return 'MADI (125 Mbps Stream)';
  if (normalized === 'AES67') return 'AES67 (per channel)';
  if (normalized === 'DANTE') return 'Dante (per channel)';
  return 'Manual Input';
}

export function getServiceNodeIds(service: { sourceNodeId?: string; destinationNodeId?: string; node1Id?: string; node2Id?: string }) {
  return {
    sourceNodeId: service.sourceNodeId || service.node1Id || '',
    destinationNodeId: service.destinationNodeId || service.node2Id || '',
  };
}

export function getSelectedNodeIdsForEdit(
  service: { sourceNodeId?: string; destinationNodeId?: string; node1Id?: string; node2Id?: string } | undefined
) {
  if (!service) return [];
  const ids = getServiceNodeIds(service);
  return [ids.sourceNodeId, ids.destinationNodeId].filter(Boolean);
}

export function getVideoEditName(service: VideoService): string {
  return service.name;
}

export function getAudioEditBaseName(service: AudioService): string {
  return service.name.replace(/\s\([^)]+\)$/, '');
}
