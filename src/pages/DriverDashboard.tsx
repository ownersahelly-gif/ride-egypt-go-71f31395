import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Globe, LogOut, User, MapPin, Clock, Users, Car, Calendar, DollarSign, Navigation, CheckCircle2, XCircle, Loader2, Play, Plus, Trash2, Repeat } from 'lucide-react';
import { useDriverBookingNotifications } from '@/hooks/useBookingNotifications';

type TabType = 'overview' | 'trips' | 'schedule' | 'shuttle';

const DriverDashboard = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabType>('overview');
  const [shuttle, setShuttle] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [route, setRoute] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Schedule states
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [driverSchedules, setDriverSchedules] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    route_id: '',
    days: [] as number[],
    departure_time: '08:00',
    is_recurring: true,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  useDriverBookingNotifications(shuttle?.id || null);

  const dayNames = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: profileData }, { data: shuttleData }, { data: routesData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('shuttles').select('*, routes(*)').eq('driver_id', user.id).limit(1).maybeSingle(),
        supabase.from('routes').select('*').eq('status', 'active'),
      ]);

      setProfile(profileData);
      setAllRoutes(routesData || []);

      if (shuttleData) {
        setShuttle(shuttleData);
        setRoute(shuttleData.routes);

        const [{ data: bookingsData }, { data: schedulesData }] = await Promise.all([
          supabase.from('bookings').select('*, routes(*)').eq('shuttle_id', shuttleData.id).order('scheduled_date', { ascending: true }).limit(50),
          supabase.from('driver_schedules').select('*, routes(name_en, name_ar)').eq('driver_id', user.id).order('day_of_week'),
        ]);
        setBookings(bookingsData || []);
        setDriverSchedules(schedulesData || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const updateShuttleStatus = async (newStatus: string) => {
    if (!shuttle) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from('shuttles').update({ status: newStatus }).eq('id', shuttle.id);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setShuttle({ ...shuttle, status: newStatus });
      toast({ title: t('driverDash.statusUpdated') });
    }
    setUpdatingStatus(false);
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      toast({ title: t('driverDash.bookingUpdated') });
    }
  };

  const toggleDay = (day: number) => {
    setScheduleForm(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day],
    }));
  };

  const saveSchedule = async () => {
    if (!user || !shuttle || !scheduleForm.route_id || scheduleForm.days.length === 0) return;
    setSavingSchedule(true);

    const entries = scheduleForm.days.map(day => ({
      driver_id: user.id,
      route_id: scheduleForm.route_id,
      shuttle_id: shuttle.id,
      day_of_week: day,
      departure_time: scheduleForm.departure_time,
      is_recurring: scheduleForm.is_recurring,
      is_active: true,
    }));

    const { error } = await supabase.from('driver_schedules').insert(entries);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'ar' ? 'تم حفظ الجدول' : 'Schedule saved!' });
      // Generate ride instances for the next 4 weeks
      await generateRideInstances(entries);
      // Refresh
      const { data } = await supabase.from('driver_schedules').select('*, routes(name_en, name_ar)').eq('driver_id', user.id).order('day_of_week');
      setDriverSchedules(data || []);
      setShowScheduleForm(false);
      setScheduleForm({ route_id: '', days: [], departure_time: '08:00', is_recurring: true });
    }
    setSavingSchedule(false);
  };

  const generateRideInstances = async (scheduleEntries: any[]) => {
    if (!user || !shuttle) return;
    const instances: any[] = [];
    const today = new Date();

    for (const entry of scheduleEntries) {
      const weeksAhead = entry.is_recurring ? 4 : 1;
      for (let w = 0; w < weeksAhead; w++) {
        for (let d = 0; d < 7; d++) {
          const date = new Date(today);
          date.setDate(today.getDate() + (w * 7) + d);
          if (date.getDay() === entry.day_of_week && date >= today) {
            instances.push({
              driver_id: user.id,
              route_id: entry.route_id,
              shuttle_id: shuttle.id,
              ride_date: date.toISOString().split('T')[0],
              departure_time: entry.departure_time,
              available_seats: shuttle.capacity,
              total_seats: shuttle.capacity,
              status: 'scheduled',
            });
          }
        }
      }
    }

    if (instances.length > 0) {
      await supabase.from('ride_instances').upsert(instances, { onConflict: 'shuttle_id,ride_date,departure_time' });
    }
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase.from('driver_schedules').delete().eq('id', id);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setDriverSchedules(prev => prev.filter(s => s.id !== id));
      toast({ title: lang === 'ar' ? 'تم حذف الجدول' : 'Schedule removed' });
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-muted text-muted-foreground',
    maintenance: 'bg-secondary/20 text-secondary',
    pending: 'bg-secondary/20 text-secondary',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const tabs: { key: TabType; icon: any; label: string }[] = [
    { key: 'overview', icon: Car, label: t('driverDash.overview') },
    { key: 'trips', icon: Navigation, label: t('driverDash.trips') },
    { key: 'schedule', icon: Calendar, label: t('driverDash.schedule') },
    { key: 'shuttle', icon: MapPin, label: t('driverDash.shuttleInfo') },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const todayBookings = bookings.filter(b => b.scheduled_date === new Date().toISOString().split('T')[0] && b.status !== 'cancelled');
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const totalEarnings = bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="text-2xl font-bold text-primary font-arabic">{lang === 'ar' ? 'مسار' : 'Massar'}</Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{t('driverDash.driverPanel')}</span>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground"><Globe className="w-5 h-5" /></button>
            <Link to="/profile"><Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button></Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {!shuttle && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Car className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">{t('driverDash.noShuttle')}</h2>
            <p className="text-muted-foreground mb-4">{t('driverDash.noShuttleDesc')}</p>
            <Link to="/driver-apply"><Button>{t('driverDash.applyNow')}</Button></Link>
          </div>
        )}

        {shuttle && (
          <>
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6 overflow-x-auto">
              {tabs.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: Navigation, value: todayBookings.length, label: t('driverDash.todayTrips'), bg: 'bg-primary/10', color: 'text-primary' },
                    { icon: Clock, value: pendingBookings.length, label: t('driverDash.pendingBookings'), bg: 'bg-secondary/10', color: 'text-secondary' },
                    { icon: DollarSign, value: `${totalEarnings.toFixed(0)} EGP`, label: t('driverDash.totalEarnings'), bg: 'bg-green-50', color: 'text-green-600' },
                    { icon: Users, value: shuttle.capacity, label: t('driverDash.capacity'), bg: 'bg-primary/10', color: 'text-primary' },
                  ].map((s, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-5">
                      <div className={`w-10 h-10 rounded-lg mb-2 flex items-center justify-center ${s.bg}`}>
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.value}</p>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{t('driverDash.shuttleStatus')}</h3>
                      <p className="text-sm text-muted-foreground">{shuttle.vehicle_model} · {shuttle.vehicle_plate}</p>
                    </div>
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusColors[shuttle.status] || ''}`}>
                      {t(`driverDash.status.${shuttle.status}`)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={shuttle.status === 'active' ? 'default' : 'outline'}
                      onClick={() => updateShuttleStatus('active')} disabled={updatingStatus}>
                      <CheckCircle2 className="w-4 h-4 me-1" />{t('driverDash.goOnline')}
                    </Button>
                    <Button size="sm" variant={shuttle.status === 'inactive' ? 'destructive' : 'outline'}
                      onClick={() => updateShuttleStatus('inactive')} disabled={updatingStatus}>
                      <XCircle className="w-4 h-4 me-1" />{t('driverDash.goOffline')}
                    </Button>
                  </div>
                  {shuttle.status === 'active' && todayBookings.length > 0 && (
                    <Link to="/active-ride" className="mt-3 block">
                      <Button className="w-full" size="lg">
                        <Play className="w-5 h-5 me-2" />{lang === 'ar' ? 'بدء الرحلة' : 'Start Ride'}
                      </Button>
                    </Link>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-3">{t('driverDash.todaySchedule')}</h3>
                  {todayBookings.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('driverDash.noTripsToday')}</div>
                  ) : (
                    <div className="space-y-2">
                      {todayBookings.map(b => (
                        <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-foreground text-sm">{b.scheduled_time} · {b.seats} {t('booking.seat')}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[b.status]}`}>{t(`booking.status.${b.status}`)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trips Tab */}
            {tab === 'trips' && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-foreground mb-4">{t('driverDash.allBookings')}</h2>
                {bookings.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">{t('driverDash.noBookingsYet')}</div>
                ) : bookings.map(b => (
                  <div key={b.id} className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                        <p className="text-sm text-muted-foreground">{b.scheduled_date} · {b.scheduled_time}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[b.status]}`}>{t(`booking.status.${b.status}`)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{b.seats} {t('booking.seat')}</span>
                        <span className="font-medium text-foreground">{b.total_price} EGP</span>
                      </div>
                      {b.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateBookingStatus(b.id, 'confirmed')}>
                            <CheckCircle2 className="w-3.5 h-3.5 me-1" />{t('driverDash.confirm')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b.id, 'cancelled')}>
                            <XCircle className="w-3.5 h-3.5 me-1" />{t('driverDash.reject')}
                          </Button>
                        </div>
                      )}
                      {b.status === 'confirmed' && (
                        <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b.id, 'completed')}>{t('driverDash.complete')}</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Schedule Tab - NEW */}
            {tab === 'schedule' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">
                    {lang === 'ar' ? 'جدول الرحلات' : 'My Route Schedule'}
                  </h2>
                  <Button onClick={() => setShowScheduleForm(!showScheduleForm)}>
                    <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة جدول' : 'Add Schedule'}
                  </Button>
                </div>

                {showScheduleForm && (
                  <div className="bg-card border border-border rounded-xl p-6 space-y-5">
                    <h3 className="font-semibold text-foreground">{lang === 'ar' ? 'جدول جديد' : 'New Schedule'}</h3>

                    {/* Route selection */}
                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'اختر المسار' : 'Select Route'}</Label>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={scheduleForm.route_id} onChange={e => setScheduleForm(p => ({ ...p, route_id: e.target.value }))}>
                        <option value="">{lang === 'ar' ? 'اختر مسار...' : 'Choose a route...'}</option>
                        {allRoutes.map(r => (
                          <option key={r.id} value={r.id}>
                            {lang === 'ar' ? r.name_ar : r.name_en} - {r.price} EGP
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Day selection */}
                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'اختر الأيام' : 'Select Days'}</Label>
                      <div className="flex flex-wrap gap-2">
                        {dayNames.map((name, i) => (
                          <button key={i} onClick={() => toggleDay(i)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              scheduleForm.days.includes(i)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                            }`}>
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Time */}
                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'وقت الانطلاق' : 'Departure Time'}</Label>
                      <Input type="time" value={scheduleForm.departure_time}
                        onChange={e => setScheduleForm(p => ({ ...p, departure_time: e.target.value }))}
                        className="w-48" />
                    </div>

                    {/* Recurring toggle */}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={scheduleForm.is_recurring}
                        onCheckedChange={(checked) => setScheduleForm(p => ({ ...p, is_recurring: !!checked }))}
                      />
                      <div>
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <Repeat className="w-4 h-4 text-primary" />
                          {lang === 'ar' ? 'تكرار أسبوعي (كل أسبوع نفس الأيام)' : 'Repeat weekly (same days every week)'}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {scheduleForm.is_recurring
                            ? (lang === 'ar' ? 'سيتم إنشاء رحلات تلقائياً لمدة 4 أسابيع قادمة' : 'Rides will be auto-created for the next 4 weeks')
                            : (lang === 'ar' ? 'هذا الأسبوع فقط' : 'This week only')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button onClick={saveSchedule} disabled={savingSchedule || !scheduleForm.route_id || scheduleForm.days.length === 0}>
                        {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <CheckCircle2 className="w-4 h-4 me-1" />}
                        {lang === 'ar' ? 'حفظ الجدول' : 'Save Schedule'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowScheduleForm(false)}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Existing schedules */}
                {driverSchedules.length === 0 && !showScheduleForm ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">{lang === 'ar' ? 'لم تحدد أي جدول بعد' : 'No schedules set yet'}</p>
                    <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'أضف جدولك ليظهر للركاب' : 'Add your schedule so riders can see and book your rides'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Group schedules by route */}
                    {Object.entries(
                      driverSchedules.reduce((acc: Record<string, any[]>, s) => {
                        const key = s.route_id;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(s);
                        return acc;
                      }, {})
                    ).map(([routeId, schedules]) => (
                      <div key={routeId} className="bg-card border border-border rounded-xl p-5">
                        <h4 className="font-semibold text-foreground mb-3">
                          {lang === 'ar' ? schedules[0]?.routes?.name_ar : schedules[0]?.routes?.name_en}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(schedules as any[]).sort((a: any, b: any) => a.day_of_week - b.day_of_week).map((s: any) => (
                            <div key={s.id} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2">
                              <span className="text-sm font-medium text-foreground">{dayNames[s.day_of_week]}</span>
                              <span className="text-xs text-muted-foreground">{s.departure_time?.slice(0, 5)}</span>
                              {s.is_recurring && <Repeat className="w-3 h-3 text-primary" />}
                              <button onClick={() => deleteSchedule(s.id)} className="text-destructive/60 hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Shuttle Info Tab */}
            {tab === 'shuttle' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-foreground mb-6">{t('driverDash.vehicleInfo')}</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driver.vehicleModel')}</p>
                      <p className="font-medium text-foreground">{shuttle.vehicle_model}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driver.vehiclePlate')}</p>
                      <p className="font-medium text-foreground">{shuttle.vehicle_plate}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driverDash.capacity')}</p>
                      <p className="font-medium text-foreground">{shuttle.capacity} {t('booking.seat')}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driverDash.shuttleStatus')}</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[shuttle.status]}`}>
                        {t(`driverDash.status.${shuttle.status}`)}
                      </span>
                    </div>
                  </div>
                </div>

                {route && (
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-semibold text-foreground mb-4">{t('driverDash.assignedRoute')}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-green-500" />
                      <span className="text-foreground">{lang === 'ar' ? route.origin_name_ar : route.origin_name_en}</span>
                      <span className="text-muted-foreground">→</span>
                      <MapPin className="w-4 h-4 text-destructive" />
                      <span className="text-foreground">{lang === 'ar' ? route.destination_name_ar : route.destination_name_en}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span>{route.estimated_duration_minutes} {t('booking.min')}</span>
                      <span>{route.price} EGP/{t('booking.perSeat')}</span>
                    </div>
                  </div>
                )}

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground mb-4">{t('driverDash.updateStatus')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {['active', 'inactive', 'maintenance'].map(s => (
                      <Button key={s} size="sm" variant={shuttle.status === s ? 'default' : 'outline'}
                        onClick={() => updateShuttleStatus(s)} disabled={updatingStatus}>
                        {t(`driverDash.status.${s}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
