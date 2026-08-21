/**
 * Calculates great-circle distance between two coordinates in meters
 * using the Haversine Formula.
 */
export const calculateHaversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Returns distance in meters
};

/**
 * Validates whether given coordinates fall within company geofence
 */
export const validateGeofence = (userLat, userLng, company) => {
  if (userLat === undefined || userLng === undefined || userLat === null || userLng === null) {
    return {
      isValid: false,
      reason: 'Latitude and Longitude are required for GPS-based attendance.',
      distanceMeters: null,
    };
  }

  const officeLat = company.worksiteLocation?.latitude ?? 31.5204;
  const officeLng = company.worksiteLocation?.longitude ?? 74.3587;
  const allowedRadius = company.allowedRadiusMeters ?? 150;

  const distanceMeters = calculateHaversineDistanceMeters(
    Number(userLat),
    Number(userLng),
    Number(officeLat),
    Number(officeLng)
  );

  if (distanceMeters > allowedRadius) {
    return {
      isValid: false,
      distanceMeters,
      allowedRadius,
      reason: `You are ${distanceMeters}m away from the office. Allowed radius is ${allowedRadius}m.`,
    };
  }

  return {
    isValid: true,
    distanceMeters,
    allowedRadius,
  };
};