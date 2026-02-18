
export const UNCOMPRESSED_PCM_AUDIO_CHANNEL_BANDWIDTH_MBPS = 1.152;
// Bandwidth per MADI channel, accounting for AES3-style encoding overhead.
export const MADI_PER_CHANNEL_BANDWIDTH_MBPS = 1.536;
export const MADI_STREAM_BANDWIDTH_MBPS = 125;

export const VIDEO_CODEC_TYPES = [
  'JPEG-XS',
  'JPEG-2000',
  'H.265 (HEVC)',
  'H.264',
  'Other',
] as const;

export const VIDEO_MANUAL_DEFAULTS = {
  'H.264': 10,
  'H.265 (HEVC)': 8,
  'JPEG-2000': 50,
  'Other': 20,
} as const;


export const AUDIO_TYPES = [
  'AES67 (per channel)',
  'Dante (per channel)',
  'MADI (per channel)',
  'MADI (125 Mbps Stream)',
  'Manual Input',
] as const;

export const COMPRESSED_AUDIO_BITRATES_KBPS = [64, 128, 192, 256, 320, 384, 448, 512, 576, 640] as const;

export const HANDOFF_TYPES = [
  'BNC (Coaxial)',
  'RJ-45 (Ethernet)',
  'SM LC Fibre',
  'SM SC Fibre',
  'MM SC Fibre',
  'MM LC Fibre',
  'XLR (Audio)',
  'Other/Not Specified',
] as const;

export const DATA_HANDOFF_TYPES = HANDOFF_TYPES.filter(
    type => type !== 'XLR (Audio)' && type !== 'BNC (Coaxial)'
);
