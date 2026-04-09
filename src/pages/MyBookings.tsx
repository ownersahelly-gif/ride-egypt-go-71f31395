import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Ticket, ChevronLeft, ChevronRight, MessageCircle, Navigation, Key, Star, Share2, Phone, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import RideChat from '@/components/RideChat';
import RideRating from '@/components/RideRating';

const MyBookings = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [ratedBookingIds, setRatedBookingIds] = useState<Set<string>>(new Set());
  const [driverProfiles, setDriverProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) return;
    const fetchBookings = async () => {
      const [{ data: bookingsData }, { data: ratingsData }] = await Promise.all([
        supabase.from('bookings').select('*, routes(*), shuttles(*)').eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('ratings').select('booking_id').eq('user_id', user.id),
      ]);
      setBookings(bookingsData || []);
      setRatedBookingIds(new Set((ratingsData || []).map(r => r.booking_id)));

      // Fetch driver profiles
      const driverIds = [...new Set((bookingsData || []).map((b: any) => b.shuttles?.driver_id).filter(Boolean))];
      if (driverIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', driverIds);
        const map: Record<string, any> = {};
        (profiles || []).forEach(p => { map[p.user_id] = p; });
        setDriverProfiles(map);
      }

      setLoading(false);
    };
    fetchBookings();
  }, [user]);

  const cancelBooking = async (id: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (error) { toast({ title: t('auth.error'), description: error.message, variant: 'destructive' }); return; }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    toast({ title: t('booking.cancelled') });
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-secondary/20 text-secondary',
    confirmed: 'bg-green-100 text-green-700',
    boarded: 'bg-primary/10 text-primary',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{t('dashboard.myBookings')}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : bookings.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Ticket className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('dashboard.noBookings')}</p>
            <Link to="/book"><Button className="mt-4">{t('dashboard.bookFirst')}</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{lang === 'ar' ? booking.routes?.name_ar : booking.routes?.name_en}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[booking.status] || ''}`}>
                    {booking.status === 'boarded' 
                      ? (lang === 'ar' ? 'في الشاتل' : 'On Board')
                      : t(`booking.status.${booking.status}`)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{booking.scheduled_date}</span>
                  <span>{booking.scheduled_time}</span>
                  <span>{booking.seats} {t('booking.seat')}</span>
                </div>

                {/* Boarding code */}
                {booking.boarding_code && ['confirmed', 'pending'].includes(booking.status) && (
                  <div className="bg-surface rounded-lg p-3 mb-3 flex items-center gap-3">
                    <Key className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'رمز الصعود' : 'Boarding Code'}</p>
                      <p className="text-xl font-mono font-bold text-foreground tracking-widest">{booking.boarding_code}</p>
                    </div>
                    <p className="text-xs text-muted-foreground ms-auto max-w-[120px] text-end">
                      {lang === 'ar' ? 'أظهر هذا الرمز للسائق' : 'Show this to your driver'}
                    </p>
                  </div>
                )}

                {/* Rating prompt for completed rides */}
                {booking.status === 'completed' && !ratedBookingIds.has(booking.id) && (
                  <div className="bg-secondary/10 rounded-lg p-3 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-secondary" />
                      <span className="text-sm font-medium text-foreground">
                        {lang === 'ar' ? 'كيف كانت رحلتك؟' : 'How was your ride?'}
                      </span>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setRatingBooking(booking)}>
                      {lang === 'ar' ? 'قيّم الآن' : 'Rate Now'}
                    </Button>
                  </div>
                )}

                {/* Rated indicator */}
                {booking.status === 'completed' && ratedBookingIds.has(booking.id) && (
                  <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground">
                    <Star className="w-3 h-3 fill-secondary text-secondary" />
                    {lang === 'ar' ? 'تم التقييم' : 'Rated'}
                  </div>
                )}

                {/* Driver info */}
                {(() => {
                  const dp = driverProfiles[booking.shuttles?.driver_id];
                  if (!dp) return null;
                  return (
                    <div className="flex items-center gap-2 mb-3 bg-surface rounded-lg p-3 text-sm">
                      <Users className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{dp.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.shuttles?.vehicle_model} · {booking.shuttles?.vehicle_plate}
                        </p>
                      </div>
                      {dp.phone && (
                        <a href={`tel:${dp.phone}`}>
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8">
                            <Phone className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">{booking.total_price} EGP</span>
                  <div className="flex items-center gap-2">
                    {['confirmed', 'boarded'].includes(booking.status) && (
                      <Button variant="outline" size="sm" onClick={() => setChatBookingId(booking.id)}>
                        <MessageCircle className="w-3.5 h-3.5 me-1" />
                        {lang === 'ar' ? 'محادثة' : 'Chat'}
                      </Button>
                    )}
                    {['confirmed', 'boarded'].includes(booking.status) && (
                      <Link to={`/track?booking=${booking.id}`}>
                        <Button variant="outline" size="sm">
                          <Navigation className="w-3.5 h-3.5 me-1" />
                          {lang === 'ar' ? 'تتبع' : 'Track'}
                        </Button>
                      </Link>
                    )}
                    {booking.status === 'pending' && (
                      <Button variant="destructive" size="sm" onClick={() => cancelBooking(booking.id)}>{t('booking.cancel')}</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <RideChat
        bookingId={chatBookingId || ''}
        isOpen={!!chatBookingId}
        onClose={() => setChatBookingId(null)}
      />

      {ratingBooking && (
        <RideRating
          bookingId={ratingBooking.id}
          driverId={ratingBooking.shuttles?.driver_id}
          routeName={lang === 'ar' ? ratingBooking.routes?.name_ar : ratingBooking.routes?.name_en}
          isOpen={!!ratingBooking}
          onClose={() => setRatingBooking(null)}
          onRated={() => setRatedBookingIds(prev => new Set([...prev, ratingBooking.id]))}
        />
      )}
    </div>
  );
};

export default MyBookings;
