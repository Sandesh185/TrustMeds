/**
 * Location Validation Service
 * 
 * Provides fraud detection through:
 * 1. Geofencing validation (compare current location with authorized zones)
 * 2. Travel time validation (detect impossibly fast movements)
 * 3. Participant verification (check if location matches participant's registered region)
 */

export interface AuthorizedLocation {
  participant: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  registeredAt: number;
}

export interface LocationValidationResult {
  isValid: boolean;
  isSuspicious: boolean;
  warnings: string[];
  expectedLocation?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  actualLocation: {
    latitude: number;
    longitude: number;
  };
  distanceFromExpected?: number; // in meters
  travelTimeIssue?: {
    distance: number; // in meters
    timeElapsed: number; // in seconds
    speed: number; // in km/h
    maxReasonableSpeed: number; // in km/h
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a location is within an authorized zone
 */
export function isWithinAuthorizedZone(
  lat: number,
  lon: number,
  authorizedLocation: AuthorizedLocation
): boolean {
  const distance = calculateDistance(
    lat,
    lon,
    authorizedLocation.latitude,
    authorizedLocation.longitude
  );
  return distance <= authorizedLocation.radius;
}

/**
 * Validate location against authorized locations for a participant
 */
export function validateLocationAgainstAuthorizedZones(
  currentLat: number,
  currentLon: number,
  participantAddress: string,
  authorizedLocations: AuthorizedLocation[]
): LocationValidationResult {
  const warnings: string[] = [];
  let isValid = false;
  let isSuspicious = false;
  let expectedLocation: { name: string; latitude: number; longitude: number } | undefined;
  let distanceFromExpected: number | undefined;

  // Filter authorized locations for this participant
  const participantLocations = authorizedLocations.filter(
    (loc) => loc.participant.toLowerCase() === participantAddress.toLowerCase()
  );

  if (participantLocations.length === 0) {
    // No authorized locations registered - can't validate
    warnings.push(
      `⚠️ No authorized locations registered for this participant. Location validation unavailable.`
    );
    return {
      isValid: false,
      isSuspicious: false, // Not suspicious, just unverifiable
      warnings,
      actualLocation: { latitude: currentLat, longitude: currentLon },
    };
  }

  // Check if current location is within any authorized zone
  let foundMatch = false;
  let closestLocation: AuthorizedLocation | null = null;
  let closestDistance = Infinity;

  // Debug logging
  console.log('🔍 Location Validation Debug:', {
    currentLocation: { lat: currentLat, lon: currentLon },
    participantAddress,
    authorizedLocationsCount: participantLocations.length,
    authorizedLocations: participantLocations.map(loc => ({
      name: loc.locationName,
      lat: loc.latitude,
      lon: loc.longitude,
      radius: loc.radius
    }))
  });

  for (const authLoc of participantLocations) {
    const distance = calculateDistance(
      currentLat,
      currentLon,
      authLoc.latitude,
      authLoc.longitude
    );

    console.log(`📍 Checking against "${authLoc.locationName}":`, {
      authLocation: { lat: authLoc.latitude, lon: authLoc.longitude },
      currentLocation: { lat: currentLat, lon: currentLon },
      distance: `${(distance / 1000).toFixed(2)} km`,
      radius: `${(authLoc.radius / 1000).toFixed(2)} km`,
      isWithinRadius: distance <= authLoc.radius
    });

    if (distance < closestDistance) {
      closestDistance = distance;
      closestLocation = authLoc;
    }

    if (isWithinAuthorizedZone(currentLat, currentLon, authLoc)) {
      foundMatch = true;
      expectedLocation = {
        name: authLoc.locationName,
        latitude: authLoc.latitude,
        longitude: authLoc.longitude,
      };
      distanceFromExpected = distance;
      console.log(`✅ Location MATCHES authorized zone "${authLoc.locationName}"`);
      break;
    }
  }

  if (!foundMatch) {
    console.warn(`❌ Location does NOT match any authorized zone. Closest: ${closestLocation?.locationName} at ${(closestDistance / 1000).toFixed(2)} km`);
  }

  if (foundMatch) {
    isValid = true;
    isSuspicious = false;
  } else {
    // Location is outside all authorized zones
    isValid = false;
    isSuspicious = true;
    
    if (closestLocation) {
      expectedLocation = {
        name: closestLocation.locationName,
        latitude: closestLocation.latitude,
        longitude: closestLocation.longitude,
      };
      distanceFromExpected = closestDistance;
      
      const distanceKm = (closestDistance / 1000).toFixed(2);
      warnings.push(
        `⚠️ Location Mismatch: Product found ${distanceKm}km away from authorized zone "${closestLocation.locationName}"`
      );
      warnings.push(
        `Expected location: ${closestLocation.locationName} (${closestLocation.latitude.toFixed(4)}, ${closestLocation.longitude.toFixed(4)})`
      );
    } else {
      warnings.push(
        `⚠️ Location Mismatch: Product found outside all authorized zones for this participant`
      );
    }
  }

  return {
    isValid,
    isSuspicious,
    warnings,
    expectedLocation,
    actualLocation: { latitude: currentLat, longitude: currentLon },
    distanceFromExpected,
  };
}

/**
 * Validate travel time between two locations
 * Returns warning if product moved impossibly fast
 */
export function validateTravelTime(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  fromTimestamp: number, // in milliseconds
  toTimestamp: number // in milliseconds
): {
  isValid: boolean;
  distance: number;
  timeElapsed: number;
  speed: number;
  maxReasonableSpeed: number;
  warning?: string;
} {
  const distance = calculateDistance(fromLat, fromLon, toLat, toLon);
  const timeElapsed = (toTimestamp - fromTimestamp) / 1000; // convert to seconds

  if (timeElapsed <= 0) {
    // Invalid time - same or future timestamp
    return {
      isValid: false,
      distance,
      timeElapsed: 0,
      speed: Infinity,
      maxReasonableSpeed: 1000, // 1000 km/h
      warning: "Invalid timestamp: product appears to have moved backwards in time",
    };
  }

  // Calculate speed in km/h
  const distanceKm = distance / 1000;
  const timeHours = timeElapsed / 3600;
  const speed = distanceKm / timeHours;

  // Maximum reasonable speed for ground transportation: 200 km/h (very generous)
  // For air freight: 1000 km/h
  // We'll use 200 km/h as default, but allow up to 1000 km/h for air freight
  const maxReasonableSpeed = 200; // km/h
  const maxAirSpeed = 1000; // km/h

  let isValid = true;
  let warning: string | undefined;

  if (speed > maxAirSpeed) {
    isValid = false;
    warning = `🚨 Suspicious Movement: Product moved ${distanceKm.toFixed(2)}km in ${(timeElapsed / 3600).toFixed(2)} hours (${speed.toFixed(0)} km/h). This exceeds even air freight speeds!`;
  } else if (speed > maxReasonableSpeed) {
    isValid = false;
    warning = `⚠️ Fast Movement: Product moved ${distanceKm.toFixed(2)}km in ${(timeElapsed / 3600).toFixed(2)} hours (${speed.toFixed(0)} km/h). This may indicate air freight or data error.`;
  }

  return {
    isValid,
    distance,
    timeElapsed,
    speed,
    maxReasonableSpeed,
    warning,
  };
}

/**
 * Comprehensive location validation
 * Combines geofencing and travel time validation
 */
export function validateLocation(
  currentLat: number,
  currentLon: number,
  currentTimestamp: number,
  participantAddress: string,
  authorizedLocations: AuthorizedLocation[],
  previousLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  }
): LocationValidationResult {
  const warnings: string[] = [];
  
  // 1. Validate against authorized zones
  const zoneValidation = validateLocationAgainstAuthorizedZones(
    currentLat,
    currentLon,
    participantAddress,
    authorizedLocations
  );
  
  warnings.push(...zoneValidation.warnings);
  
  // 2. Validate travel time if previous location exists
  let travelTimeIssue: LocationValidationResult['travelTimeIssue'] | undefined;
  if (previousLocation) {
    const travelValidation = validateTravelTime(
      previousLocation.latitude,
      previousLocation.longitude,
      currentLat,
      currentLon,
      previousLocation.timestamp,
      currentTimestamp
    );
    
    if (!travelValidation.isValid && travelValidation.warning) {
      warnings.push(travelValidation.warning);
      travelTimeIssue = {
        distance: travelValidation.distance,
        timeElapsed: travelValidation.timeElapsed,
        speed: travelValidation.speed,
        maxReasonableSpeed: travelValidation.maxReasonableSpeed,
      };
    }
  }
  
  // Determine overall validity
  const isValid = zoneValidation.isValid && (!travelTimeIssue || travelTimeIssue.speed <= 1000);
  const isSuspicious = !isValid || zoneValidation.isSuspicious || (travelTimeIssue !== undefined && travelTimeIssue.speed > 200);
  
  return {
    isValid,
    isSuspicious,
    warnings,
    expectedLocation: zoneValidation.expectedLocation,
    actualLocation: { latitude: currentLat, longitude: currentLon },
    distanceFromExpected: zoneValidation.distanceFromExpected,
    travelTimeIssue,
  };
}

