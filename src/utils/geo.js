import geohash from 'ngeohash';

const EARTH_KM = 6371;

/**
 * Straight-line distance in kilometres. Coordinates are GeoJSON [lng, lat].
 * @param {[number, number]} from
 * @param {[number, number]} to
 */
export function haversineKm(from, to) {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * ngeohash.encode expects latitude then longitude, the opposite of GeoJSON.
 * @param {number} lng
 * @param {number} lat
 * @param {number} [precision=6]
 */
export function geohashFor(lng, lat, precision = 6) {
  return geohash.encode(lat, lng, precision);
}

/**
 * @param {number} km
 */
export function kmToMeters(km) {
  return Math.round(km * 1000);
}
