import { describe, expect, it } from 'vitest';
import { getSelectedNodeIdsForEdit, normalizeAudioType, normalizeVideoCodec } from './serviceEditPrefill';

describe('service edit prefill helpers', () => {
  it('normalizes video codec aliases for edit prefill', () => {
    expect(normalizeVideoCodec('J2K')).toBe('JPEG-2000');
    expect(normalizeVideoCodec('jpeg xs')).toBe('JPEG-XS');
    expect(normalizeVideoCodec('HEVC')).toBe('H.265 (HEVC)');
    expect(normalizeVideoCodec('H.264')).toBe('H.264');
  });

  it('normalizes audio type aliases for edit prefill', () => {
    expect(normalizeAudioType('MADI')).toBe('MADI (125 Mbps Stream)');
    expect(normalizeAudioType('AES67')).toBe('AES67 (per channel)');
    expect(normalizeAudioType('DANTE')).toBe('Dante (per channel)');
  });

  it('preserves legacy node id keys when building selected node ids', () => {
    expect(getSelectedNodeIdsForEdit({ sourceNodeId: 'src', destinationNodeId: 'dst' })).toEqual(['src', 'dst']);
    expect(getSelectedNodeIdsForEdit({ node1Id: 'n1', node2Id: 'n2' })).toEqual(['n1', 'n2']);
  });
});
