import { describe, expect, it } from 'vitest';
import { parsePolygon } from './polygon.js';

const closed = [
  [72.77, 18.89],
  [73.05, 18.89],
  [73.05, 19.3],
  [72.77, 19.3],
  [72.77, 18.89],
];

describe('parsePolygon', () => {
  it('accepts a closed [lng, lat] ring', () => {
    const result = parsePolygon({ type: 'Polygon', coordinates: [closed] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.polygon.coordinates[0]).toHaveLength(5);
  });

  it('rejects an open ring', () => {
    const result = parsePolygon({ type: 'Polygon', coordinates: [closed.slice(0, 4)] });
    expect(result.ok).toBe(false);
  });

  it('rejects a latitude above 90', () => {
    const ring = [
      [72, 0],
      [73, 0],
      [73, 91],
      [72, 91],
      [72, 0],
    ];
    const result = parsePolygon({ type: 'Polygon', coordinates: [ring] });
    expect(result.ok).toBe(false);
  });
});
