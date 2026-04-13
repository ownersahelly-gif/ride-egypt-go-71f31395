import { useState, useRef, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const libraries: ('places' | 'drawing' | 'geometry')[] = ['places', 'drawing', 'geometry'];

interface PlacesAutocompleteProps {
  placeholder?: string;
  value?: string;
  onSelect: (place: { name: string; lat: number; lng: number }) => void;
  iconColor?: string;
  className?: string;
}

const PlacesAutocomplete = ({ placeholder, value, onSelect, iconColor = 'text-primary', className }: PlacesAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY, libraries });

  useEffect(() => {
    if (isLoaded && !autocompleteService.current) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      const div = document.createElement('div');
      placesService.current = new google.maps.places.PlacesService(div);
    }
  }, [isLoaded]);

  useEffect(() => {
    if (value !== undefined) setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInput = (val: string) => {
    setInputValue(val);
    if (!val || val.length < 2 || !autocompleteService.current) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }
    autocompleteService.current.getPlacePredictions(
      { input: val, componentRestrictions: { country: 'eg' } },
      (results) => {
        setPredictions(results || []);
        setShowDropdown(true);
      }
    );
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;
    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry', 'name', 'formatted_address'] },
      (place) => {
        if (place?.geometry?.location) {
          const name = place.formatted_address || place.name || prediction.description;
          setInputValue(name || '');
          setShowDropdown(false);
          onSelect({
            name: name || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      }
    );
  };

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="relative">
        <MapPin className={`absolute start-3 top-3 h-4 w-4 ${iconColor}`} />
        <Input placeholder={placeholder} className="ps-10" value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); onSelect({ name: e.target.value, lat: 30.0444, lng: 31.2357 }); }} />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="relative">
        <Loader2 className="absolute start-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
        <Input placeholder={placeholder} className="ps-10" disabled />
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <MapPin className={`absolute start-3 top-3 h-4 w-4 ${iconColor}`} />
      <Input placeholder={placeholder} className={`ps-10 ${className || ''}`} value={inputValue}
        onChange={(e) => handleInput(e.target.value)} onFocus={() => predictions.length > 0 && setShowDropdown(true)} />
      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <button key={p.place_id} onClick={() => handleSelect(p)}
              className="w-full text-start px-4 py-3 text-sm hover:bg-muted transition-colors border-b border-border last:border-0">
              <p className="font-medium text-foreground">{p.structured_formatting.main_text}</p>
              <p className="text-xs text-muted-foreground">{p.structured_formatting.secondary_text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlacesAutocomplete;
