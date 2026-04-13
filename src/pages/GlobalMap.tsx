import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MapToolbar from '@/components/global-map/MapToolbar';
import UserSidebar from '@/components/global-map/UserSidebar';
import RouteBuilder from '@/components/global-map/RouteBuilder';
import {
  type RouteRequestUser, type FilterState, type RouteStop,
  deduplicateRequests, AREA_PRESETS, isInRadius,
} from '@/components/global-map/types';
import { Loader2 } from 'lucide-react';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const cairoCenter = { lat: 30.0444, lng: 31.2357 };
const libraries: ('places' | 'drawing' | 'geometry')[] = ['places', 'drawing', 'geometry'];

const GlobalMap = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY, libraries });

  // Data
  const [allUsers, setAllUsers] = useState<RouteRequestUser[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [filters, setFilters] = useState<FilterState>({
    timeFrom: '', timeTo: '', days: [], areaPreset: '', areaRadius: 5000,
    areaFilterMode: 'both', pickupArea: null, dropoffArea: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<RouteRequestUser | null>(null);
  const [showLines, setShowLines] = useState(false);
  const [showConnectedRoutes, setShowConnectedRoutes] = useState(false);
  const [connectedDirections, setConnectedDirections] = useState<google.maps.DirectionsResult[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Route builder
  const [routeMode, setRouteMode] = useState(false);
  const [startPoint, setStartPoint] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [endPoint, setEndPoint] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [generatedRoute, setGeneratedRoute] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routeNameEn, setRouteNameEn] = useState('');
  const [routeNameAr, setRouteNameAr] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [reqRes, profRes] = await Promise.all([
        supabase.from('route_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, full_name, phone'),
      ]);
      const profileMap: Record<string, any> = {};
      (profRes.data || []).forEach(p => { profileMap[p.user_id] = p; });
      setAllUsers(deduplicateRequests(reqRes.data || [], profileMap));
      setLoading(false);
    };
    fetchData();
  }, []);

  // Get the active area preset
  const activePreset = filters.areaPreset ? AREA_PRESETS.find(a => a.name === filters.areaPreset) : null;

  // Filter logic — returns users AND controls which markers to show
  const filteredUsers = allUsers.filter(u => {
    if (hiddenUserIds.has(u.id)) return false;

    // Time filter
    if (filters.timeFrom && u.preferredTime) {
      if (u.preferredTime < filters.timeFrom) return false;
    }
    if (filters.timeTo && u.preferredTime) {
      if (u.preferredTime > filters.timeTo) return false;
    }
    if ((filters.timeFrom || filters.timeTo) && !u.preferredTime) return false;

    // Day filter
    if (filters.days.length > 0) {
      if (u.preferredDays.length === 0) return false;
      if (!filters.days.some(d => u.preferredDays.includes(d))) return false;
    }

    // Area filter with mode
    if (activePreset) {
      const r = filters.areaRadius;
      const pickupIn = isInRadius(u.originLat, u.originLng, activePreset.lat, activePreset.lng, r);
      const dropoffIn = isInRadius(u.destinationLat, u.destinationLng, activePreset.lat, activePreset.lng, r);

      if (filters.areaFilterMode === 'pickup') {
        // Only users whose pickup is inside the circle
        if (!pickupIn) return false;
      } else if (filters.areaFilterMode === 'dropoff') {
        // Only users whose dropoff is inside the circle
        if (!dropoffIn) return false;
      } else {
        // Both: at least one must be inside
        if (!pickupIn && !dropoffIn) return false;
      }
    }

    return true;
  });

  // Determine which markers to show based on area filter mode
  const showPickupMarker = (u: RouteRequestUser) => {
    if (!activePreset || filters.areaFilterMode === 'both') return true;
    if (filters.areaFilterMode === 'pickup') return true; // show pickup markers (they're filtered to be inside)
    // dropoff mode: only show dropoff markers of matching users, but also show their pickups? 
    // Per user request: "only the drop offs of the people inside the circle should only be seen"
    // So in dropoff mode, don't show pickups
    if (filters.areaFilterMode === 'dropoff') return false;
    return true;
  };

  const showDropoffMarker = (u: RouteRequestUser) => {
    if (!activePreset || filters.areaFilterMode === 'both') return true;
    if (filters.areaFilterMode === 'dropoff') return true;
    // pickup mode: show only pickups inside circle + their dropoffs
    // Per user request: "only these people inside the circle for pickup... and only the drop offs of the people inside the circle should only be seen"
    if (filters.areaFilterMode === 'pickup') return true; // show dropoffs of matched users
    return true;
  };

  // Map click handler for route building
  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!routeMode || !e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    const geocoder = new google.maps.Geocoder();
    let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    try {
      const res = await geocoder.geocode({ location: { lat, lng } });
      if (res.results[0]) name = res.results[0].formatted_address.split(',').slice(0, 2).join(',');
    } catch {}

    if (!startPoint) {
      setStartPoint({ lat, lng, name });
    } else if (!endPoint) {
      setEndPoint({ lat, lng, name });
    } else {
      const newStop: RouteStop = {
        id: crypto.randomUUID(),
        lat, lng, name,
        assignedUsers: [],
        order: routeStops.length,
      };
      setRouteStops(prev => [...prev, newStop]);
    }
  }, [routeMode, startPoint, endPoint, routeStops]);

  // Generate optimized route
  const handleGenerateRoute = useCallback(async () => {
    if (!startPoint || !endPoint) {
      toast({ title: 'Set start and end points first', variant: 'destructive' });
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    const waypoints = routeStops.map(s => ({
      location: new google.maps.LatLng(s.lat, s.lng),
      stopover: true,
    }));

    try {
      const result = await directionsService.route({
        origin: new google.maps.LatLng(startPoint.lat, startPoint.lng),
        destination: new google.maps.LatLng(endPoint.lat, endPoint.lng),
        waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      setGeneratedRoute(result);

      if (result.routes[0]?.waypoint_order) {
        const order = result.routes[0].waypoint_order;
        const reordered = order.map((i, idx) => ({ ...routeStops[i], order: idx }));
        setRouteStops(reordered);
      }

      const legs = result.routes[0]?.legs || [];
      const totalDist = legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
      const totalDur = legs.reduce((s, l) => s + (l.duration?.value || 0), 0);
      setRouteInfo({
        distance: `${(totalDist / 1000).toFixed(1)} km`,
        duration: `${Math.round(totalDur / 60)} min`,
      });
    } catch (err: any) {
      toast({ title: 'Route generation failed', description: err.message, variant: 'destructive' });
    }
  }, [startPoint, endPoint, routeStops, toast]);

  // Show connected routes: chain all pickups optimally, then connect to dropoffs
  const handleToggleConnectedRoutes = useCallback(async () => {
    if (showConnectedRoutes) {
      setShowConnectedRoutes(false);
      setConnectedDirections([]);
      return;
    }

    const users = filteredUsers.slice(0, 25); // Limit for API quota
    if (users.length < 2) {
      toast({ title: 'Need at least 2 visible users', variant: 'destructive' });
      return;
    }

    setLoadingRoutes(true);
    setShowConnectedRoutes(true);
    const ds = new google.maps.DirectionsService();
    const results: google.maps.DirectionsResult[] = [];

    try {
      // Step 1: Chain all pickups together optimally
      const pickupPoints = users.map(u => ({ lat: u.originLat, lng: u.originLng }));
      
      if (pickupPoints.length <= 25) {
        // Use first pickup as origin, last as destination, rest as waypoints
        const pickupOrigin = pickupPoints[0];
        const pickupDest = pickupPoints[pickupPoints.length - 1];
        const pickupWaypoints = pickupPoints.slice(1, -1).map(p => ({
          location: new google.maps.LatLng(p.lat, p.lng),
          stopover: true,
        }));

        try {
          const pickupRoute = await ds.route({
            origin: new google.maps.LatLng(pickupOrigin.lat, pickupOrigin.lng),
            destination: new google.maps.LatLng(pickupDest.lat, pickupDest.lng),
            waypoints: pickupWaypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
          });
          results.push(pickupRoute);
        } catch (e) {
          console.error('Pickup chain route failed:', e);
        }
      }

      // Step 2: Chain all dropoffs together optimally
      const dropoffPoints = users.map(u => ({ lat: u.destinationLat, lng: u.destinationLng }));

      if (dropoffPoints.length <= 25) {
        const dropOrigin = dropoffPoints[0];
        const dropDest = dropoffPoints[dropoffPoints.length - 1];
        const dropWaypoints = dropoffPoints.slice(1, -1).map(p => ({
          location: new google.maps.LatLng(p.lat, p.lng),
          stopover: true,
        }));

        try {
          const dropoffRoute = await ds.route({
            origin: new google.maps.LatLng(dropOrigin.lat, dropOrigin.lng),
            destination: new google.maps.LatLng(dropDest.lat, dropDest.lng),
            waypoints: dropWaypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
          });
          results.push(dropoffRoute);
        } catch (e) {
          console.error('Dropoff chain route failed:', e);
        }
      }

      // Step 3: Connect last pickup to first dropoff (bridge)
      if (results.length >= 1) {
        // Get the optimized last pickup point
        const pickupRoute = results[0];
        const lastPickupLeg = pickupRoute.routes[0]?.legs;
        const lastPickup = lastPickupLeg?.[lastPickupLeg.length - 1]?.end_location;
        
        // Get the optimized first dropoff point
        const dropoffRoute = results.length >= 2 ? results[1] : null;
        const firstDropoff = dropoffRoute?.routes[0]?.legs?.[0]?.start_location;

        if (lastPickup && firstDropoff) {
          try {
            const bridgeRoute = await ds.route({
              origin: lastPickup,
              destination: firstDropoff,
              travelMode: google.maps.TravelMode.DRIVING,
            });
            // Insert bridge between pickup and dropoff routes
            results.splice(1, 0, bridgeRoute);
          } catch (e) {
            console.error('Bridge route failed:', e);
          }
        }
      }
    } catch (err) {
      console.error('Connected routes error:', err);
    }

    setConnectedDirections(results);
    setLoadingRoutes(false);
  }, [showConnectedRoutes, filteredUsers, toast]);

  // Save route
  const handleSaveRoute = async () => {
    if (!startPoint || !endPoint || !routeNameEn) return;
    setSaving(true);
    try {
      const durationMin = routeInfo ? parseInt(routeInfo.duration) || 30 : 30;
      const { data: routeData, error: routeErr } = await supabase.from('routes').insert({
        name_en: routeNameEn,
        name_ar: routeNameAr || routeNameEn,
        origin_name_en: startPoint.name,
        origin_name_ar: startPoint.name,
        origin_lat: startPoint.lat,
        origin_lng: startPoint.lng,
        destination_name_en: endPoint.name,
        destination_name_ar: endPoint.name,
        destination_lat: endPoint.lat,
        destination_lng: endPoint.lng,
        price: parseFloat(price) || 0,
        estimated_duration_minutes: durationMin,
        status: 'active',
      }).select().single();

      if (routeErr) throw routeErr;

      if (routeStops.length > 0 && routeData) {
        const stopsToInsert = routeStops.map((s, i) => ({
          route_id: routeData.id,
          name_en: s.name,
          name_ar: s.name,
          lat: s.lat,
          lng: s.lng,
          stop_order: i + 1,
          stop_type: 'both' as const,
        }));
        await supabase.from('stops').insert(stopsToInsert);
      }

      toast({ title: 'Route saved!', description: `${routeNameEn} created with ${routeStops.length} stops` });
      handleClearRoute();
      navigate('/admin');
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteStops([]);
    setGeneratedRoute(null);
    setRouteInfo(null);
    setRouteNameEn('');
    setRouteNameAr('');
    setPrice('');
  };

  const handleAssignUser = (userId: string, stopId: string) => {
    setRouteStops(prev => prev.map(s => {
      if (s.id === stopId) {
        const has = s.assignedUsers.includes(userId);
        return { ...s, assignedUsers: has ? s.assignedUsers.filter(u => u !== userId) : [...s.assignedUsers, userId] };
      }
      return s;
    }));
  };

  const toggleHide = (userId: string) => {
    setHiddenUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  if (!isLoaded || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Route colors for connected routes visualization
  const routeColors = ['#22c55e', '#ef4444', '#f59e0b']; // green for pickups, red for dropoffs, amber for bridge

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <MapToolbar
        filters={filters}
        onFiltersChange={setFilters}
        showLines={showLines}
        onToggleLines={() => setShowLines(!showLines)}
        showConnectedRoutes={showConnectedRoutes}
        onToggleConnectedRoutes={handleToggleConnectedRoutes}
        onGenerateRoute={handleGenerateRoute}
        routeMode={routeMode}
        onToggleRouteMode={() => { setRouteMode(!routeMode); if (routeMode) handleClearRoute(); }}
        visibleCount={filteredUsers.length}
        totalCount={allUsers.length}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        loadingRoutes={loadingRoutes}
      />

      <UserSidebar
        users={allUsers}
        hiddenUserIds={hiddenUserIds}
        onToggleHide={toggleHide}
        onHideAll={(ids) => setHiddenUserIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
        onUnhideAll={() => setHiddenUserIds(new Set())}
        onSelectUser={(u) => setSelectedUser(selectedUser?.id === u.id ? null : u)}
        selectedUserId={selectedUser?.id || null}
        routeMode={routeMode}
        routeStops={routeStops}
        onAssignUser={handleAssignUser}
      />

      {routeMode && (
        <RouteBuilder
          stops={routeStops}
          startPoint={startPoint}
          endPoint={endPoint}
          onRemoveStop={(id) => setRouteStops(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })))}
          onReorderStops={setRouteStops}
          onClearRoute={handleClearRoute}
          onSaveRoute={handleSaveRoute}
          routeInfo={routeInfo}
          users={filteredUsers}
          saving={saving}
          routeNameEn={routeNameEn}
          routeNameAr={routeNameAr}
          onRouteNameEnChange={setRouteNameEn}
          onRouteNameArChange={setRouteNameAr}
          price={price}
          onPriceChange={setPrice}
        />
      )}

      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={cairoCenter}
        zoom={11}
        onClick={handleMapClick}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          gestureHandling: 'greedy',
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
        }}
      >
        {/* Area filter circle */}
        {activePreset && (
          <Circle
            center={{ lat: activePreset.lat, lng: activePreset.lng }}
            radius={filters.areaRadius}
            options={{
              fillColor: filters.areaFilterMode === 'pickup' ? '#22c55e' : filters.areaFilterMode === 'dropoff' ? '#ef4444' : '#3b82f6',
              fillOpacity: 0.1,
              strokeColor: filters.areaFilterMode === 'pickup' ? '#22c55e' : filters.areaFilterMode === 'dropoff' ? '#ef4444' : '#3b82f6',
              strokeWeight: 2,
              strokeOpacity: 0.6,
            }}
          />
        )}

        {/* Pickup markers (green) — only show based on area filter mode */}
        {filteredUsers.filter(showPickupMarker).map(u => (
          <Marker
            key={`p-${u.id}`}
            position={{ lat: u.originLat, lng: u.originLng }}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
              scaledSize: new google.maps.Size(32, 32),
            }}
            onClick={() => setSelectedUser(u)}
          />
        ))}

        {/* Dropoff markers (red) — only show based on area filter mode */}
        {filteredUsers.filter(showDropoffMarker).map(u => (
          <Marker
            key={`d-${u.id}`}
            position={{ lat: u.destinationLat, lng: u.destinationLng }}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
              scaledSize: new google.maps.Size(32, 32),
            }}
            onClick={() => setSelectedUser(u)}
          />
        ))}

        {/* Pickup→Dropoff lines */}
        {showLines && filteredUsers.map(u => (
          <Polyline
            key={`line-${u.id}`}
            path={[
              { lat: u.originLat, lng: u.originLng },
              { lat: u.destinationLat, lng: u.destinationLng },
            ]}
            options={{
              strokeColor: '#6366f1',
              strokeWeight: 1.5,
              strokeOpacity: 0.5,
              geodesic: true,
            }}
          />
        ))}

        {/* Connected routes (pickup chain → bridge → dropoff chain) */}
        {connectedDirections.map((dir, i) => (
          <DirectionsRenderer
            key={`cr-${i}`}
            directions={dir}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: routeColors[i] || '#f59e0b',
                strokeWeight: 3,
                strokeOpacity: 0.7,
              },
            }}
          />
        ))}

        {/* Generated route */}
        {generatedRoute && (
          <DirectionsRenderer
            directions={generatedRoute}
            options={{
              suppressMarkers: true,
              polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4, strokeOpacity: 0.8 },
            }}
          />
        )}

        {/* Route builder markers */}
        {startPoint && (
          <Marker
            position={{ lat: startPoint.lat, lng: startPoint.lng }}
            icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png', scaledSize: new google.maps.Size(40, 40) }}
            label={{ text: 'S', color: 'white', fontWeight: 'bold' }}
          />
        )}
        {endPoint && (
          <Marker
            position={{ lat: endPoint.lat, lng: endPoint.lng }}
            icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png', scaledSize: new google.maps.Size(40, 40) }}
            label={{ text: 'E', color: 'white', fontWeight: 'bold' }}
          />
        )}
        {routeStops.map((s, i) => (
          <Marker
            key={s.id}
            position={{ lat: s.lat, lng: s.lng }}
            icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png', scaledSize: new google.maps.Size(36, 36) }}
            label={{ text: `${i + 1}`, color: 'white', fontWeight: 'bold' }}
            draggable
            onDragEnd={(e) => {
              if (!e.latLng) return;
              setRouteStops(prev => prev.map(st => st.id === s.id ? { ...st, lat: e.latLng!.lat(), lng: e.latLng!.lng() } : st));
            }}
          />
        ))}

        {/* InfoWindow */}
        {selectedUser && (
          <InfoWindow
            position={{ lat: selectedUser.originLat, lng: selectedUser.originLng }}
            onCloseClick={() => setSelectedUser(null)}
          >
            <div className="text-xs space-y-1 max-w-[200px]">
              <p className="font-bold">{selectedUser.name}</p>
              {selectedUser.phone && <p>📞 {selectedUser.phone}</p>}
              <p>🟢 {selectedUser.originName}</p>
              <p>🔴 {selectedUser.destinationName}</p>
              {selectedUser.preferredTime && <p>🕐 {selectedUser.preferredTime}</p>}
              {selectedUser.preferredDays.length > 0 && (
                <p>📅 {selectedUser.preferredDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</p>
              )}
              <p className="text-gray-400">{selectedUser.requestIds.length} request(s)</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default GlobalMap;
