import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  height?: string;
}

// MapClickHandler must be a child of MapContainer to use useMap hook
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof map.on !== 'function') {
      return;
    }

    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    };

    map.on('click', handleClick);
    return () => {
      if (map && typeof map.off === 'function') {
        map.off('click', handleClick);
      }
    };
  }, [map, onLocationSelect]);

  return null;
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

const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLat = 19.0760,
  initialLng = 72.8777,
  onLocationSelect,
  height = '400px',
}) => {
  const [mounted, setMounted] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(
    initialLat && initialLng ? [initialLat, initialLng] : null
  );

  // Ensure component only renders on client side (SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedLocation([lat, lng]);
    onLocationSelect(lat, lng);
  };

  const createIcon = (color: string = '#ef4444') => {
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

  const centerLocation: [number, number] = selectedLocation || [initialLat, initialLng];

  return (
    <div className="border rounded-lg overflow-hidden" style={{ height }}>
      <MapContainer
        center={centerLocation}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        scrollWheelZoom={true}
        key={`picker-${centerLocation[0]}-${centerLocation[1]}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapViewUpdater center={centerLocation} zoom={13} />
        <MapClickHandler onLocationSelect={handleLocationSelect} />

        {selectedLocation && (
          <Marker
            position={selectedLocation}
            icon={createIcon('#ef4444')}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm mb-1">Selected Location</h3>
                <p className="text-xs text-gray-500">
                  Latitude: {selectedLocation[0].toFixed(6)}
                </p>
                <p className="text-xs text-gray-500">
                  Longitude: {selectedLocation[1].toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <div className="p-3 bg-blue-50 border-t">
        <p className="text-sm text-blue-700 font-medium mb-1">📍 Location Picker</p>
        <p className="text-xs text-blue-600">
          Click anywhere on the map to select a location
        </p>
        {selectedLocation && (
          <div className="mt-2 text-xs text-gray-700">
            <p>Lat: <span className="font-mono">{selectedLocation[0].toFixed(6)}</span></p>
            <p>Lng: <span className="font-mono">{selectedLocation[1].toFixed(6)}</span></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationPicker;
