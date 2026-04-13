import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ChevronLeft, Route, Layers, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AREA_PRESETS, type FilterState, type AreaFilterMode } from './types';

interface MapToolbarProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  showLines: boolean;
  onToggleLines: () => void;
  showConnectedRoutes: boolean;
  onToggleConnectedRoutes: () => void;
  onGenerateRoute: () => void;
  routeMode: boolean;
  onToggleRouteMode: () => void;
  visibleCount: number;
  totalCount: number;
  showFilters: boolean;
  onToggleFilters: () => void;
  loadingRoutes: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AREA_MODE_LABELS: { value: AreaFilterMode; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'pickup', label: 'Pickup only' },
  { value: 'dropoff', label: 'Dropoff only' },
];

const MapToolbar = ({
  filters, onFiltersChange,
  showLines, onToggleLines,
  showConnectedRoutes, onToggleConnectedRoutes,
  onGenerateRoute, routeMode, onToggleRouteMode,
  visibleCount, totalCount,
  showFilters, onToggleFilters,
  loadingRoutes,
}: MapToolbarProps) => {
  const toggleDay = (d: number) => {
    const days = filters.days.includes(d) ? filters.days.filter(x => x !== d) : [...filters.days, d];
    onFiltersChange({ ...filters, days });
  };

  const clearFilters = () => {
    onFiltersChange({ timeFrom: '', timeTo: '', days: [], areaPreset: '', areaRadius: 5000, areaFilterMode: 'both', pickupArea: null, dropoffArea: null });
  };

  const hasFilters = filters.timeFrom || filters.timeTo || filters.days.length > 0 || filters.areaPreset;

  return (
    <div className="absolute top-0 left-0 right-0 z-10 bg-card/95 backdrop-blur border-b border-border">
      {/* Main toolbar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-sm font-bold text-foreground shrink-0">Global Map</h1>
        <span className="text-xs text-muted-foreground shrink-0">
          {visibleCount}/{totalCount} users
        </span>
        
        <div className="flex-1" />

        <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" onClick={onToggleFilters} className="gap-1">
          <Filter className="w-3.5 h-3.5" />
          Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
        </Button>
        <Button variant={showLines ? 'secondary' : 'outline'} size="sm" onClick={onToggleLines} className="gap-1">
          <Layers className="w-3.5 h-3.5" />
          Lines
        </Button>
        <Button
          variant={showConnectedRoutes ? 'secondary' : 'outline'}
          size="sm"
          onClick={onToggleConnectedRoutes}
          className="gap-1"
          disabled={loadingRoutes}
        >
          <Route className="w-3.5 h-3.5" />
          {loadingRoutes ? 'Loading...' : showConnectedRoutes ? 'Hide Routes' : 'Show Routes'}
        </Button>
        <Button variant={routeMode ? 'default' : 'outline'} size="sm" onClick={onToggleRouteMode} className="gap-1">
          <Route className="w-3.5 h-3.5" />
          {routeMode ? 'Building...' : 'Build Route'}
        </Button>
        {routeMode && (
          <Button size="sm" onClick={onGenerateRoute}>
            Generate Route
          </Button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Time:</span>
              <Input type="time" className="w-28 h-7 text-xs" value={filters.timeFrom} onChange={e => onFiltersChange({ ...filters, timeFrom: e.target.value })} />
              <span className="text-xs">→</span>
              <Input type="time" className="w-28 h-7 text-xs" value={filters.timeTo} onChange={e => onFiltersChange({ ...filters, timeTo: e.target.value })} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Area:</span>
              <Select value={filters.areaPreset} onValueChange={v => onFiltersChange({ ...filters, areaPreset: v === 'all' ? '' : v })}>
                <SelectTrigger className="w-36 h-7 text-xs">
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {AREA_PRESETS.map(a => (
                    <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filters.areaPreset && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Mode:</span>
                  <Select value={filters.areaFilterMode} onValueChange={(v: AreaFilterMode) => onFiltersChange({ ...filters, areaFilterMode: v })}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AREA_MODE_LABELS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Radius: {(filters.areaRadius / 1000).toFixed(1)}km</span>
                  <Slider
                    value={[filters.areaRadius]}
                    min={1000}
                    max={20000}
                    step={500}
                    onValueChange={([v]) => onFiltersChange({ ...filters, areaRadius: v })}
                    className="w-24"
                  />
                </div>
              </>
            )}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1 text-xs">
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                  filters.days.includes(i)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapToolbar;
