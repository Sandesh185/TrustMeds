import { lazy, Suspense, useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';

// Dynamically import LocationPicker to ensure it's only loaded on client side
const LocationPicker = lazy(() => import('./LocationPicker'));

interface LocationPickerWrapperProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  height?: string;
}

const LocationPickerWrapper: React.FC<LocationPickerWrapperProps> = (props) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || typeof window === 'undefined') {
    return (
      <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height: props.height || '400px' }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading map...
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height: props.height || '400px' }}>
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading map...
            </div>
          </div>
        }
      >
        <LocationPicker {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default LocationPickerWrapper;

