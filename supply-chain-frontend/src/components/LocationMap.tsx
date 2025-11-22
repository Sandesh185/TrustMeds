import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

interface Location {
  lat: number;
  lng: number;
  name?: string;
  productId?: string;
  timestamp?: string;
  color?: string; // Custom color for the marker
}

interface AuthorizedLocation {
  latitude: number;
  longitude: number;
  radius: number; // in meters
  locationName: string;
  participant?: string;
  registeredAt?: number;
}

interface LocationMapProps {
  location?: Location;
  height?: string;
  showPopup?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
  isSelectable?: boolean;
  multipleLocations?: Location[];
  authorizedLocations?: AuthorizedLocation[];
  center?: [number, number];
  zoom?: number;
}

// Component to update map view when location changes
// Must be a child of MapContainer to use useMap hook
function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (map && typeof map.setView === 'function') {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

const LocationMap: React.FC<LocationMapProps> = ({
  location,
  height = '400px',
  showPopup = true,
  onLocationSelect,
  isSelectable = false,
  multipleLocations = [],
  authorizedLocations = [],
  center,
  zoom = 13,
}) => {
  const [mounted, setMounted] = useState(false);

  // Ensure component only renders on client side (SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate center from locations or use provided center
  const calculateCenter = (): [number, number] => {
    if (center) return center;
    if (location) return [location.lat, location.lng];
    if (authorizedLocations && authorizedLocations.length > 0) {
      const firstLoc = authorizedLocations[0];
      return [firstLoc.latitude, firstLoc.longitude];
    }
    if (multipleLocations && multipleLocations.length > 0) {
      const firstLoc = multipleLocations[0];
      return [firstLoc.lat, firstLoc.lng];
    }
    return [19.0760, 72.8777]; // Default to Mumbai
  };
  
  const mapCenter: [number, number] = calculateCenter();

  // Create custom icons for different location types
  const createIcon = (color: string = '#3388ff') => {
    if (!L || !L.divIcon) return undefined;
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: 30px;
        height: 30px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  };

  // If no location provided and no authorized locations, show empty map with selection capability
  if (!location && !isSelectable && authorizedLocations.length === 0 && multipleLocations.length === 0) {
    return (
      <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          No location data available
        </div>
      </div>
    );
  }

  // Don't render map until mounted (SSR safety)
  if (!mounted || typeof window === 'undefined') {
    return (
      <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading map...
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden" style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        scrollWheelZoom={true}
        key={`map-${mapCenter[0]}-${mapCenter[1]}-${zoom}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Update map view when location changes */}
        <MapViewUpdater center={mapCenter} zoom={zoom} />

        {/* Main location marker */}
        {location && (
          <Marker
            position={[location.lat, location.lng]}
            icon={createIcon('#3b82f6')}
          >
            {showPopup && (
              <Popup>
                <div className="p-2">
                  {location.name && (
                    <h3 className="font-semibold text-sm mb-1">{location.name}</h3>
                  )}
                  {location.productId && (
                    <p className="text-xs text-gray-600 mb-1">Product: {location.productId}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}
                  </p>
                  {location.timestamp && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(location.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              </Popup>
            )}
          </Marker>
        )}

        {/* Multiple location markers (for location history) */}
        {multipleLocations && multipleLocations.length > 0 && multipleLocations.map((loc, index) => {
          // Use custom color if provided, otherwise use default color scheme
          const markerColor = loc.color || (index === 0 ? '#10b981' : '#f59e0b');
          return (
          <Marker
            key={`location-${index}-${loc.lat}-${loc.lng}`}
            position={[loc.lat, loc.lng]}
            icon={createIcon(markerColor)}
          >
            <Popup>
              <div className="p-2">
                {loc.name && (
                  <h3 className="font-semibold text-sm mb-1">{loc.name}</h3>
                )}
                {loc.productId && (
                  <p className="text-xs text-gray-600 mb-1">Product: {loc.productId}</p>
                )}
                <p className="text-xs text-gray-500">
                  Lat: {loc.lat.toFixed(4)}, Lng: {loc.lng.toFixed(4)}
                </p>
                {loc.timestamp && (
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(loc.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
          );
        })}

        {/* Authorized locations with radius circles */}
        {authorizedLocations && authorizedLocations.length > 0 && authorizedLocations.map((authLoc, index) => (
          <div key={`auth-loc-${index}`}>
            <Circle
              center={[authLoc.latitude, authLoc.longitude]}
              radius={authLoc.radius}
              pathOptions={{
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.2,
                weight: 2,
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm mb-1">🔒 {authLoc.locationName}</h3>
                  <p className="text-xs text-gray-600 mb-1">
                    Authorized Zone
                  </p>
                  <p className="text-xs text-gray-500">
                    Lat: {authLoc.latitude.toFixed(4)}, Lng: {authLoc.longitude.toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Radius: {(authLoc.radius / 1000).toFixed(2)} km
                  </p>
                  {authLoc.registeredAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Registered: {new Date(authLoc.registeredAt * 1000).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Popup>
            </Circle>
            <Marker
              position={[authLoc.latitude, authLoc.longitude]}
              icon={createIcon('#10b981')}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm mb-1">🔒 {authLoc.locationName}</h3>
                  <p className="text-xs text-gray-600 mb-1">
                    Authorized Zone Center
                  </p>
                  <p className="text-xs text-gray-500">
                    Lat: {authLoc.latitude.toFixed(4)}, Lng: {authLoc.longitude.toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Radius: {(authLoc.radius / 1000).toFixed(2)} km
                  </p>
                </div>
              </Popup>
            </Marker>
          </div>
        ))}
      </MapContainer>

      {isSelectable && (
        <div className="p-2 bg-blue-50 border-t">
          <p className="text-xs text-blue-700">
            💡 Click on the map to select a location
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationMap;
