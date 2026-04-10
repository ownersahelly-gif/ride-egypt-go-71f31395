import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BottomNav from '@/components/BottomNav';
import MapView from '@/components/MapView';
import {
  Plus, MapPin, Clock, Users, Fuel, RefreshCw, Car,
  ChevronRight, ChevronLeft, Search, Filter, Shield, AlertCircle,
  Map, List, X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const DEMO_ROUTES = [
  {
    id: 'demo-1',
    user_id: 'demo-user-1',
    origin_name: 'Maadi, Cairo',
    origin_lat: 29.9602,
    origin_lng: 31.2569,
    destination_name: 'Smart Village, 6th October',
    destination_lat: 30.0711,
    destination_lng: 31.0175,
    departure_time: '07:30:00',
    available_seats: 3,
    is_daily: true,
    days_of_week: [0, 1, 2, 3, 4],
    share_fuel: true,
    fuel_share_amount: 25,
    allow_car_swap: true,
    notes: 'Leaving sharp at 7:30. AC car.',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    user_id: 'demo-user-2',
    origin_name: 'Heliopolis, Cairo',
    origin_lat: 30.0870,
    origin_lng: 31.3225,
    destination_name: 'Cairo University',
    destination_lat: 30.0261,
    destination_lng: 31.2118,
    departure_time: '08:00:00',
    available_seats: 2,
    is_daily: true,
    days_of_week: [0, 1, 2, 3],
    share_fuel: true,
    fuel_share_amount: 20,
    allow_car_swap: false,
    notes: null,
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    user_id: 'demo-user-3',
    origin_name: 'Nasr City, Cairo',
    origin_lat: 30.0626,
    origin_lng: 31.3387,
    destination_name: 'New Cairo, AUC',
    destination_lat: 30.0194,
    destination_lng: 31.4998,
    departure_time: '09:00:00',
    available_seats: 4,
    is_daily: false,
    days_of_week: [],
    share_fuel: false,
    fuel_share_amount: 0,
    allow_car_swap: false,
    notes: 'One-time trip on Thursday.',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-4',
    user_id: 'demo-user-4',
    origin_name: 'Zamalek, Cairo',
    origin_lat: 30.0609,
    origin_lng: 31.2194,
    destination_name: 'New Administrative Capital',
    destination_lat: 30.0197,
    destination_lng: 31.7601,
    departure_time: '06:30:00',
    available_seats: 3,
    is_daily: true,
    days_of_week: [0, 1, 2, 3, 4],
    share_fuel: true,
    fuel_share_amount: 40,
    allow_car_swap: true,
    notes: 'Daily commute to NAC. Fuel split equally.',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-5',
    user_id: 'demo-user-5',
    origin_name: 'Dokki, Giza',
    origin_lat: 30.0382,
    origin_lng: 31.2012,
    destination_name: 'Ain Shams University',
    destination_lat: 30.0793,
    destination_lng: 31.2834,
    departure_time: '07:00:00',
    available_seats: 2,
    is_daily: true,
    days_of_week: [0, 1, 2, 3, 4],
    share_fuel: true,
    fuel_share_amount: 15,
    allow_car_swap: false,
    notes: null,
    status: 'active',
    created_at: new Date().toISOString(),
  },
];

const Carpool = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [routes, setRoutes] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'browse' | 'my-rides' | 'my-routes'>('browse');
  const [browseMode, setBrowseMode] = useState<'list' | 'map'>('list');

  // Filters
  const [filterTime, setFilterTime] = useState<string>('');
  const [filterDay, setFilterDay] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const reqChannel = supabase
      .channel('carpool-req-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'carpool_requests' }, async (payload) => {
        const req = payload.new as any;
        const myRoute = routes.find(r => r.id === req.route_id && r.user_id === user.id);
        if (myRoute) {
          toast({
            title: lang === 'ar' ? '🚗 طلب انضمام جديد!' : '🚗 New join request!',
            description: lang === 'ar'
              ? `شخص يريد الانضمام لرحلتك ${myRoute.origin_name} → ${myRoute.destination_name}`
              : `Someone wants to join your ride ${myRoute.origin_name} → ${myRoute.destination_name}`,
          });
          fetchData();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'carpool_requests' }, async (payload) => {
        const req = payload.new as any;
        if (req.user_id === user.id && req.status === 'accepted') {
          toast({ title: lang === 'ar' ? '✅ تم قبول طلبك!' : '✅ Request accepted!' });
          fetchData();
        }
        if (req.user_id === user.id && req.status === 'rejected') {
          toast({ title: lang === 'ar' ? '❌ تم رفض طلبك' : '❌ Request rejected', variant: 'destructive' });
          fetchData();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(reqChannel); };
  }, [user, routes, lang]);

  const fetchData = async () => {
    setLoading(true);
    const [routesRes, requestsRes, verRes] = await Promise.all([
      supabase.from('carpool_routes').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('carpool_requests').select('*, carpool_routes(*)').eq('user_id', user!.id),
      supabase.from('carpool_verifications').select('*').eq('user_id', user!.id).maybeSingle(),
    ]);
    const dbRoutes = routesRes.data || [];
    // Merge demo routes if DB is empty
    const allRoutes = dbRoutes.length > 0 ? dbRoutes : [...DEMO_ROUTES, ...dbRoutes];
    setRoutes(allRoutes);
    setMyRequests(requestsRes.data || []);
    setVerification(verRes.data);
    setLoading(false);
  };

  const isVerified = verification?.status === 'approved';
  const hasPendingVerification = verification?.status === 'pending';

  const dayNames = lang === 'ar'
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const filteredRoutes = routes.filter(r => {
    if (r.user_id === user?.id) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r.origin_name?.toLowerCase().includes(s) && !r.destination_name?.toLowerCase().includes(s)) return false;
    }
    if (filterTime) {
      const routeHour = parseInt(r.departure_time?.slice(0, 2) || '0');
      if (filterTime === 'early' && routeHour >= 8) return false;
      if (filterTime === 'morning' && (routeHour < 8 || routeHour >= 10)) return false;
      if (filterTime === 'midday' && (routeHour < 10 || routeHour >= 14)) return false;
      if (filterTime === 'afternoon' && routeHour < 14) return false;
    }
    if (filterDay && filterDay !== 'any') {
      const dayNum = parseInt(filterDay);
      if (r.is_daily && r.days_of_week?.length > 0 && !r.days_of_week.includes(dayNum)) return false;
    }
    return true;
  });

  const myRoutes = routes.filter(r => r.user_id === user?.id);

  const mapMarkers = filteredRoutes.flatMap(r => [
    { lat: r.origin_lat, lng: r.origin_lng, label: r.origin_name?.slice(0, 15), color: 'green' as const },
    { lat: r.destination_lat, lng: r.destination_lng, label: r.destination_name?.slice(0, 15), color: 'red' as const },
  ]);

  const hasActiveFilters = !!filterTime || (!!filterDay && filterDay !== 'any');

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold font-heading">
            {lang === 'ar' ? 'مشاركة الرحلات' : 'Carpooling'}
          </h1>
          {isVerified ? (
            <Button size="sm" variant="secondary" onClick={() => navigate('/carpool/post')}>
              <Plus className="w-4 h-4 mr-1" />
              {lang === 'ar' ? 'أضف رحلة' : 'Post Ride'}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => navigate('/carpool/verify')}>
              <Shield className="w-4 h-4 mr-1" />
              {lang === 'ar' ? 'التحقق' : 'Verify'}
            </Button>
          )}
        </div>

        {!isVerified && (
          <div className="bg-secondary/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {hasPendingVerification
                  ? (lang === 'ar' ? 'التحقق قيد المراجعة' : 'Verification under review')
                  : (lang === 'ar' ? 'يجب التحقق من هويتك للمشاركة' : 'Verify your identity to participate')
                }
              </p>
              {!hasPendingVerification && (
                <Button size="sm" variant="link" className="text-primary-foreground p-0 h-auto" onClick={() => navigate('/carpool/verify')}>
                  {lang === 'ar' ? 'ابدأ التحقق ←' : 'Start verification →'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card">
        {(['browse', 'my-rides', 'my-routes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            {t === 'browse'
              ? (lang === 'ar' ? 'استكشاف' : 'Browse')
              : t === 'my-rides'
                ? (lang === 'ar' ? 'رحلاتي' : 'My Rides')
                : (lang === 'ar' ? 'مساراتي' : 'My Routes')
            }
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === 'browse' && (
          <>
            {/* Search + Filter + View Toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder={lang === 'ar' ? 'ابحث عن موقع...' : 'Search locations...'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Button
                variant={hasActiveFilters ? 'default' : 'outline'}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setBrowseMode(browseMode === 'list' ? 'map' : 'list')}
              >
                {browseMode === 'list' ? <Map className="w-4 h-4" /> : <List className="w-4 h-4" />}
              </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <Card>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{lang === 'ar' ? 'تصفية' : 'Filters'}</p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={() => { setFilterTime(''); setFilterDay(''); }}>
                        <X className="w-3 h-3 mr-1" />{lang === 'ar' ? 'مسح' : 'Clear'}
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {lang === 'ar' ? 'وقت المغادرة' : 'Departure Time'}
                      </label>
                      <Select value={filterTime} onValueChange={setFilterTime}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder={lang === 'ar' ? 'أي وقت' : 'Any time'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="early">{lang === 'ar' ? 'مبكر (قبل 8)' : 'Early (before 8am)'}</SelectItem>
                          <SelectItem value="morning">{lang === 'ar' ? 'صباحي (8-10)' : 'Morning (8-10am)'}</SelectItem>
                          <SelectItem value="midday">{lang === 'ar' ? 'ظهر (10-2)' : 'Midday (10am-2pm)'}</SelectItem>
                          <SelectItem value="afternoon">{lang === 'ar' ? 'عصر (بعد 2)' : 'Afternoon (after 2pm)'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {lang === 'ar' ? 'يوم الأسبوع' : 'Day of Week'}
                      </label>
                      <Select value={filterDay} onValueChange={setFilterDay}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder={lang === 'ar' ? 'أي يوم' : 'Any day'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">{lang === 'ar' ? 'أي يوم' : 'Any day'}</SelectItem>
                          {dayNames.map((name, i) => (
                            <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Map View */}
            {browseMode === 'map' && (
              <div className="h-80 rounded-xl overflow-hidden border border-border">
                <MapView markers={mapMarkers} zoom={10} showUserLocation />
              </div>
            )}

            {/* Route cards */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? (lang === 'ar' ? 'لا نتائج تطابق الفلاتر' : 'No rides match your filters')
                    : (lang === 'ar' ? 'لا توجد رحلات متاحة حالياً' : 'No rides available right now')
                  }
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-3" onClick={() => { setFilterTime(''); setFilterDay(''); }}>
                    {lang === 'ar' ? 'مسح الفلاتر' : 'Clear filters'}
                  </Button>
                )}
              </div>
            ) : (
              filteredRoutes.map(route => (
                <Card
                  key={route.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    if (route.id.startsWith('demo-')) {
                      toast({ title: lang === 'ar' ? 'تجريبي' : 'Demo', description: lang === 'ar' ? 'هذه رحلة تجريبية' : 'This is a demo ride' });
                      return;
                    }
                    navigate(`/carpool/route/${route.id}`);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <p className="text-sm font-medium truncate">{route.origin_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-destructive" />
                          <p className="text-sm font-medium truncate">{route.destination_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {route.id.startsWith('demo-') && (
                          <Badge variant="outline" className="text-[10px] mb-1">{lang === 'ar' ? 'تجريبي' : 'Demo'}</Badge>
                        )}
                        {route.share_fuel && route.fuel_share_amount > 0 && (
                          <Badge variant="secondary" className="mb-1">
                            <Fuel className="w-3 h-3 mr-1" />
                            EGP {route.fuel_share_amount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {route.departure_time?.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {route.available_seats} {lang === 'ar' ? 'مقاعد' : 'seats'}
                      </span>
                      {route.is_daily && (
                        <Badge variant="outline" className="text-[10px]">
                          {lang === 'ar' ? 'يومي' : 'Daily'}
                        </Badge>
                      )}
                      {route.allow_car_swap && (
                        <Badge variant="outline" className="text-[10px]">
                          <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                          {lang === 'ar' ? 'تبادل' : 'Swap'}
                        </Badge>
                      )}
                    </div>
                    {route.is_daily && route.days_of_week?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {route.days_of_week.map((d: number) => (
                          <span key={d} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{dayNames[d]}</span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {tab === 'my-rides' && (
          <>
            {myRequests.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {lang === 'ar' ? 'لم تنضم لأي رحلة بعد' : "You haven't joined any rides yet"}
                </p>
              </div>
            ) : (
              myRequests.map(req => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">
                        {req.carpool_routes?.origin_name} → {req.carpool_routes?.destination_name}
                      </p>
                      <Badge variant={req.status === 'accepted' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'}>
                        {req.status === 'accepted' ? (lang === 'ar' ? 'مقبول' : 'Accepted') : req.status === 'pending' ? (lang === 'ar' ? 'قيد الانتظار' : 'Pending') : (lang === 'ar' ? 'مرفوض' : 'Rejected')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'الركوب:' : 'Pickup:'} {req.pickup_name}</p>
                    <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'النزول:' : 'Dropoff:'} {req.dropoff_name}</p>
                    {req.status === 'accepted' && (
                      <Button size="sm" className="mt-2 w-full" onClick={() => navigate(`/carpool/route/${req.route_id}`)}>
                        {lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {tab === 'my-routes' && (
          <>
            {myRoutes.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {lang === 'ar' ? 'لم تنشر أي رحلة بعد' : "You haven't posted any rides yet"}
                </p>
                {isVerified && (
                  <Button className="mt-4" onClick={() => navigate('/carpool/post')}>
                    {lang === 'ar' ? 'أضف رحلة جديدة' : 'Post a Ride'}
                  </Button>
                )}
              </div>
            ) : (
              myRoutes.map(route => (
                <Card key={route.id} className="cursor-pointer" onClick={() => navigate(`/carpool/manage/${route.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{route.origin_name} → {route.destination_name}</p>
                        <p className="text-xs text-muted-foreground">{route.departure_time?.slice(0, 5)}</p>
                      </div>
                      <Badge variant={route.status === 'active' ? 'default' : 'secondary'}>
                        {route.status === 'active' ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'متوقف' : 'Paused')}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{route.available_seats} {lang === 'ar' ? 'مقاعد' : 'seats'}</span>
                      {route.share_fuel && <span>• {lang === 'ar' ? 'مشاركة بنزين' : 'Fuel share'}</span>}
                      {route.allow_car_swap && <span>• {lang === 'ar' ? 'تبادل سيارات' : 'Car swap'}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Carpool;
