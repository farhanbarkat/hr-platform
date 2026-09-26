import { useEffect, useState } from 'react';
import L from 'leaflet';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [31.5204, 74.3587];

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const MapViewport = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
};

const MapClickHandler = ({ onChange }) => {
  useMapEvents({
    click: ({ latlng }) => onChange([latlng.lat, latlng.lng]),
  });

  return null;
};

export default function WorksiteMapPicker({ latitude, longitude, radius, onChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);
  const center = [
    Number.isFinite(numericLatitude) ? numericLatitude : DEFAULT_CENTER[0],
    Number.isFinite(numericLongitude) ? numericLongitude : DEFAULT_CENTER[1],
  ];
  const numericRadius = Number(radius);

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    try {
      setSearching(true);
      setLocationMessage('');
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=pk&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) throw new Error('Search request failed.');
      const results = await response.json();
      setSearchResults(Array.isArray(results) ? results : []);
      if (!results.length) setLocationMessage('No locations found. Try a nearby landmark or full address.');
    } catch (error) {
      console.error('Failed to search map locations:', error);
      setSearchResults([]);
      setLocationMessage('Location search is unavailable right now.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    onChange([Number(result.lat), Number(result.lon)]);
    setSearchQuery(result.display_name);
    setSearchResults([]);
    setLocationMessage('Location selected. Drag the pin for finer placement.');
  };

  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Device location is not supported by this browser.');
      return;
    }

    setLocating(true);
    setLocationMessage('Requesting your device location...');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange([coords.latitude, coords.longitude]);
        setLocationMessage('Device location selected. Drag the pin for finer placement.');
        setLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. You can search for the office instead.'
          : 'Unable to read device location. You can search for the office instead.';
        setLocationMessage(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[#D5CEC2] bg-[#E8EEF2]">
      <div className="space-y-2 border-b border-[#D5CEC2] bg-white p-3">
        <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="worksite-map-search" className="sr-only">Search for a worksite location</label>
          <input
            id="worksite-map-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search city, building, or office address"
            className="min-w-0 flex-1 rounded border border-[#D5CEC2] bg-[#FAF8F5] px-3 py-2 text-xs text-[#111C2E] outline-none focus:border-[#8C5D17]"
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="rounded border border-[#D5CEC2] bg-[#FAF8F5] px-3 py-2 text-xs font-mono font-semibold text-[#111C2E] transition-colors hover:bg-[#F2EFE9] disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search location'}
          </button>
          <button
            type="button"
            onClick={handleUseDeviceLocation}
            disabled={locating}
            className="rounded bg-[#111C2E] px-3 py-2 text-xs font-mono font-semibold text-white transition-colors hover:bg-[#1E2B3E] disabled:opacity-50"
          >
            {locating ? 'Locating...' : 'Use my location'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-1 rounded border border-[#E3DED4] bg-[#FAF8F5] p-1">
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => handleSelectSearchResult(result)}
                className="block w-full rounded px-2 py-1.5 text-left text-[11px] text-[#546274] transition-colors hover:bg-[#F2EFE9] hover:text-[#111C2E]"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
        {locationMessage && <p className="text-[10.5px] text-[#69788A]">{locationMessage}</p>}
      </div>
      <MapContainer
        center={center}
        zoom={16}
        scrollWheelZoom
        className="h-90 w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport center={center} />
        <MapClickHandler onChange={onChange} />
        <Marker
          position={center}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const marker = event.target;
              const position = marker.getLatLng();
              onChange([position.lat, position.lng]);
            },
          }}
        />
        <Circle
          center={center}
          radius={Number.isFinite(numericRadius) ? numericRadius : 150}
          pathOptions={{
            color: '#8C5D17',
            fillColor: '#C98A2C',
            fillOpacity: 0.18,
            weight: 2,
          }}
        />
      </MapContainer>
      <div className="flex items-center justify-between gap-3 border-t border-[#D5CEC2] bg-white px-3 py-2 text-[10px] font-mono text-[#69788A]">
        <span>Click the map or drag the pin to set the office location.</span>
        <span className="whitespace-nowrap text-[#8C5D17]">{Math.round(Number.isFinite(numericRadius) ? numericRadius : 150)}m boundary</span>
      </div>
    </div>
  );
}