import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import MapView from '@/components/MapView';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Users, Fuel,
  RefreshCw, MessageCircle, Send, User, Phone, Navigation
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const CarpoolRoute = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [route, setRoute] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [myRequest, setMyRequest] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [requestMsg, setRequestMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verification, setVerification] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    fetchData();
  }, [id, user]);

  // Listen for live driver location via broadcast
  useEffect(() => {
    if (!id || myRequest?.status !== 'accepted') return;
    const channel = supabase
      .channel(`driver-location-${id}`)
      .on('broadcast', { event: 'location' }, (payload) => {
        setDriverLocation(payload.payload as { lat: number; lng: number });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, myRequest?.status]);

  // Realtime chat
  useEffect(() => {
    if (!id || myRequest?.status !== 'accepted') return;
    const chan = supabase
      .channel(`carpool-chat-passenger-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'carpool_messages', filter: `route_id=eq.${id}` }, (payload) => {
        const msg = payload.new as any;
        setMessages(prev => [...prev, msg]);
        if (!profiles[msg.sender_id]) {
          supabase.from('profiles').select('*').eq('user_id', msg.sender_id).maybeSingle().then(({ data }) => {
            if (data) setProfiles(prev => ({ ...prev, [data.user_id]: data }));
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [id, myRequest?.status, profiles]);

  const fetchData = async () => {
    setLoading(true);
    const [routeRes, requestRes, verRes] = await Promise.all([
      supabase.from('carpool_routes').select('*').eq('id', id).single(),
      supabase.from('carpool_requests').select('*').eq('route_id', id).eq('user_id', user!.id).maybeSingle(),
      supabase.from('carpool_verifications').select('*').eq('user_id', user!.id).maybeSingle(),
    ]);
    const r = routeRes.data;
    setRoute(r);
    setMyRequest(requestRes.data);
    setVerification(verRes.data);

    if (r) {
      const { data: ownerData } = await supabase.from('profiles').select('*').eq('user_id', r.user_id).maybeSingle();
      setOwner(ownerData);
    }

    if (requestRes.data?.status === 'accepted') {
      const { data: msgs } = await supabase.from('carpool_messages').select('*').eq('route_id', id).order('created_at');
      setMessages(msgs || []);
      // Fetch all chat profiles
      const senderIds = new Set<string>();
      msgs?.forEach((m: any) => senderIds.add(m.sender_id));
      if (senderIds.size > 0) {
        const { data: profs } = await supabase.from('profiles').select('*').in('user_id', Array.from(senderIds));
        const map: Record<string, any> = {};
        profs?.forEach(p => { map[p.user_id] = p; });
        setProfiles(map);
      }
    }

    setLoading(false);
  };

  const handleRequest = async () => {
    if (!user || !pickup || !dropoff) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: lang === 'ar' ? 'حدد نقطة الركوب والنزول' : 'Set your pickup and dropoff', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('carpool_requests').insert({
        route_id: id,
        user_id: user.id,
        pickup_name: pickup.name,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_name: dropoff.name,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        message: requestMsg || null,
      });
      if (error) throw error;
      toast({ title: lang === 'ar' ? 'تم!' : 'Sent!', description: lang === 'ar' ? 'تم إرسال طلبك' : 'Your request has been sent' });
      fetchData();
    } catch (e: any) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !user) return;
    await supabase.from('carpool_messages').insert({
      route_id: id,
      sender_id: user.id,
      message: newMsg.trim(),
    });
    setNewMsg('');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!route) return null;

  const isOwner = route.user_id === user?.id;
  const isVerified = verification?.status === 'approved';
  const dayNames = lang === 'ar' ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const mapMarkers = [
    { lat: route.origin_lat, lng: route.origin_lng, color: 'green' as const },
    { lat: route.destination_lat, lng: route.destination_lng, color: 'red' as const },
    ...(driverLocation ? [{ lat: driverLocation.lat, lng: driverLocation.lng, color: 'blue' as const }] : []),
  ];

  return (
    <div className="min-h-screen bg-background pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
        <button onClick={() => navigate('/carpool')} className="mb-3"><Back className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">{lang === 'ar' ? 'تفاصيل الرحلة' : 'Ride Details'}</h1>
      </div>

      <div className="h-56 relative">
        <MapView
          center={driverLocation || { lat: route.origin_lat, lng: route.origin_lng }}
          origin={{ lat: route.origin_lat, lng: route.origin_lng }}
          destination={{ lat: route.destination_lat, lng: route.destination_lng }}
          showDirections
          markers={mapMarkers}
          zoom={11}
        />
        {driverLocation && (
          <div className="absolute top-2 left-2 right-2 bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 z-10 shadow">
            <Navigation className="w-3.5 h-3.5 animate-pulse" />
            {lang === 'ar' ? 'السائق في الطريق إليك!' : 'Driver is on the way!'}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Route Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <p className="font-medium">{route.origin_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <p className="font-medium">{route.destination_name}</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{route.departure_time?.slice(0, 5)}</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" />{route.available_seats} {lang === 'ar' ? 'مقاعد' : 'seats'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {route.is_daily && <Badge variant="secondary">{lang === 'ar' ? 'يومي' : 'Daily'}</Badge>}
              {route.share_fuel && <Badge variant="secondary"><Fuel className="w-3 h-3 mr-1" />EGP {route.fuel_share_amount}</Badge>}
              {route.allow_car_swap && <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1" />{lang === 'ar' ? 'تبادل سيارات' : 'Car Swap'}</Badge>}
            </div>
            {route.is_daily && route.days_of_week?.length > 0 && (
              <div className="flex gap-1">
                {route.days_of_week.map((d: number) => (
                  <span key={d} className="text-xs bg-muted px-2 py-0.5 rounded">{dayNames[d]}</span>
                ))}
              </div>
            )}
            {route.notes && <p className="text-sm text-muted-foreground border-t pt-2">{route.notes}</p>}
          </CardContent>
        </Card>

        {/* Owner with phone */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{owner?.full_name || (lang === 'ar' ? 'مستخدم' : 'User')}</p>
              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'صاحب الرحلة' : 'Ride owner'}</p>
            </div>
            {owner?.phone && myRequest?.status === 'accepted' && (
              <a href={`tel:${owner.phone}`} className="flex items-center gap-1.5 text-sm text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                <Phone className="w-4 h-4" />
                {owner.phone}
              </a>
            )}
          </CardContent>
        </Card>

        {/* Request to join */}
        {!isOwner && !myRequest && isVerified && (
          <Card>
            <CardHeader><CardTitle className="text-base">{lang === 'ar' ? 'انضم لهذه الرحلة' : 'Join this ride'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>{lang === 'ar' ? 'نقطة ركوبك' : 'Your pickup point'}</Label>
                <PlacesAutocomplete
                  placeholder={lang === 'ar' ? 'أين ستركب' : 'Where to pick you up'}
                  onSelect={p => setPickup({ name: p.name, lat: p.lat, lng: p.lng })}
                />
                {pickup && <p className="text-xs text-green-600 mt-1">✓ {pickup.name}</p>}
              </div>
              <div>
                <Label>{lang === 'ar' ? 'نقطة نزولك' : 'Your dropoff point'}</Label>
                <PlacesAutocomplete
                  placeholder={lang === 'ar' ? 'أين ستنزل' : 'Where to drop you off'}
                  onSelect={p => setDropoff({ name: p.name, lat: p.lat, lng: p.lng })}
                />
                {dropoff && <p className="text-xs text-green-600 mt-1">✓ {dropoff.name}</p>}
              </div>
              <div>
                <Label>{lang === 'ar' ? 'رسالة (اختياري)' : 'Message (optional)'}</Label>
                <Textarea value={requestMsg} onChange={e => setRequestMsg(e.target.value)} placeholder={lang === 'ar' ? 'مرحباً...' : 'Hey...'} />
              </div>
              <Button className="w-full" onClick={handleRequest} disabled={submitting}>
                {submitting ? (lang === 'ar' ? 'جاري الإرسال...' : 'Sending...') : (lang === 'ar' ? 'طلب الانضمام' : 'Request to Join')}
              </Button>
            </CardContent>
          </Card>
        )}

        {!isOwner && !isVerified && !myRequest && (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                {lang === 'ar' ? 'يجب التحقق من هويتك أولاً' : 'You need to verify your identity first'}
              </p>
              <Button onClick={() => navigate('/carpool/verify')}>
                {lang === 'ar' ? 'ابدأ التحقق' : 'Start Verification'}
              </Button>
            </CardContent>
          </Card>
        )}

        {myRequest && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{lang === 'ar' ? 'طلبك' : 'Your request'}</p>
                <Badge variant={myRequest.status === 'accepted' ? 'default' : myRequest.status === 'pending' ? 'secondary' : 'destructive'}>
                  {myRequest.status === 'accepted' ? (lang === 'ar' ? 'مقبول' : 'Accepted') : myRequest.status === 'pending' ? (lang === 'ar' ? 'قيد الانتظار' : 'Pending') : (lang === 'ar' ? 'مرفوض' : 'Rejected')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{myRequest.pickup_name} → {myRequest.dropoff_name}</p>
            </CardContent>
          </Card>
        )}

        {/* Chat (only for accepted requests) */}
        {myRequest?.status === 'accepted' && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4" />{lang === 'ar' ? 'المحادثة' : 'Chat'}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="max-h-60 overflow-y-auto space-y-2">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">{lang === 'ar' ? 'لا رسائل بعد' : 'No messages yet'}</p>
                )}
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {m.sender_id !== user?.id && <p className="text-[10px] font-medium mb-0.5">{profiles[m.sender_id]?.full_name || 'User'}</p>}
                      {m.message}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder={lang === 'ar' ? 'اكتب رسالة...' : 'Type a message...'} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                <Button size="icon" onClick={sendMessage}><Send className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default CarpoolRoute;
