export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

const LOCATION_STORAGE_KEY = 'drug_supply_chain_locations';

// Default locations that come pre-loaded
const DEFAULT_LOCATIONS: Location[] = [
  {
    id: 'default-1',
    name: 'Mumbai Warehouse',
    latitude: 19.0760,
    longitude: 72.8777,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-2',
    name: 'Delhi Factory',
    latitude: 28.6139,
    longitude: 77.2090,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-3',
    name: 'Bangalore Distribution Center',
    latitude: 12.9716,
    longitude: 77.5946,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Get all locations from localStorage
 */
export const getLocations = (): Location[] => {
  const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
  if (!stored) {
    // Initialize with default locations
    saveLocations(DEFAULT_LOCATIONS);
    return DEFAULT_LOCATIONS;
  }
  return JSON.parse(stored);
};

/**
 * Save locations to localStorage
 */
export const saveLocations = (locations: Location[]) => {
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locations));
};

/**
 * Add a new location
 */
export const addLocation = (location: Omit<Location, 'id' | 'createdAt'>): Location => {
  const locations = getLocations();
  const newLocation: Location = {
    ...location,
    id: `loc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  locations.push(newLocation);
  saveLocations(locations);
  return newLocation;
};

/**
 * Update an existing location
 */
export const updateLocation = (id: string, updates: Partial<Omit<Location, 'id' | 'createdAt'>>): boolean => {
  const locations = getLocations();
  const index = locations.findIndex(loc => loc.id === id);
  if (index !== -1) {
    locations[index] = { ...locations[index], ...updates };
    saveLocations(locations);
    return true;
  }
  return false;
};

/**
 * Delete a location
 */
export const deleteLocation = (id: string): boolean => {
  const locations = getLocations();
  const filtered = locations.filter(loc => loc.id !== id);
  if (filtered.length < locations.length) {
    saveLocations(filtered);
    return true;
  }
  return false;
};

/**
 * Get a location by ID
 */
export const getLocationById = (id: string): Location | null => {
  const locations = getLocations();
  return locations.find(loc => loc.id === id) || null;
};

/**
 * Get a location by name
 */
export const getLocationByName = (name: string): Location | null => {
  const locations = getLocations();
  return locations.find(loc => loc.name === name) || null;
};

