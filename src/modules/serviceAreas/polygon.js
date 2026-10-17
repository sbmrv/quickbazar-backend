/**
 * Validate a GeoJSON Polygon. Coordinates are [lng, lat].
 * @param {unknown} input
 * @returns {{ ok: true, polygon: { type: 'Polygon', coordinates: number[][][] } } | { ok: false, message: string }}
 */
export function parsePolygon(input) {
  if (!input || typeof input !== 'object' || input.type !== 'Polygon' || !Array.isArray(input.coordinates)) {
    return { ok: false, message: 'Expected a GeoJSON Polygon' };
  }
  if (input.coordinates.length === 0) {
    return { ok: false, message: 'Polygon needs at least one ring' };
  }

  /** @type {number[][][]} */
  const coordinates = [];
  for (let ringIndex = 0; ringIndex < input.coordinates.length; ringIndex += 1) {
    const ring = input.coordinates[ringIndex];
    if (!Array.isArray(ring) || ring.length < 4) {
      return { ok: false, message: `Ring ${ringIndex + 1} needs at least 4 positions` };
    }
    /** @type {number[][]} */
    const positions = [];
    for (let index = 0; index < ring.length; index += 1) {
      const position = ring[index];
      if (!Array.isArray(position) || position.length !== 2) {
        return { ok: false, message: `Position ${index + 1} in ring ${ringIndex + 1} must be [lng, lat]` };
      }
      const lng = Number(position[0]);
      const lat = Number(position[1]);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(lat) || lat < -90 || lat > 90) {
        return { ok: false, message: `Position ${index + 1} in ring ${ringIndex + 1} is out of range` };
      }
      positions.push([lng, lat]);
    }
    const first = positions[0];
    const last = positions[positions.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return { ok: false, message: `Ring ${ringIndex + 1} must be closed` };
    }
    coordinates.push(positions);
  }

  return { ok: true, polygon: { type: 'Polygon', coordinates } };
}
