import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12h } from '@/lib/utils';
import BottomNav from '@/components/BottomNav';
import {
  Wallet as WalletIcon, Package, Clock, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Loader2, CreditCard, RotateCcw
} from 'lucide-react';

const Wallet = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [activePurchases, setActivePurchases] = useState<any[]>([]);
  const [expiredPurchases, setExpiredPurchases] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [routes, setRoutes] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const [
        { data: prof },
        { data: purchases },
        { data: refs },
        { data: routeList },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('bundle_purchases').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('refunds').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('routes').select('id, name_en, name_ar'),
      ]);
      setProfile(prof);
      const now = new Date().toISOString();
      setActivePurchases((purchases || []).filter(p => p.status === 'active' && p.rides_remaining > 0 && p.expires_at > now));
      setExpiredPurchases((purchases || []).filter(p => p.status !== 'active' || p.rides_remaining <= 0 || p.expires_at <= now));
      setRefunds(refs || []);
      const rm: Record<string, any> = {};
      (routeList || []).forEach(r => { rm[r.id] = r; });
      setRoutes(rm);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const walletBalance = profile?.wallet_balance || 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const routeName = (id: string) => {
    const r = routes[id];
    if (!r) return '';
    return lang === 'ar' ? r.name_ar : r.name_en;
  };

  const daysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/profile" className="p-2 rounded-full bg-primary-foreground/10">
            <Back className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">{lang === 'ar' ? 'المحفظة' : 'My Wallet'}</h1>
        </div>
        {/* Balance Card */}
        <div className="bg-primary-foreground/10 backdrop-blur rounded-2xl p-6 text-center">
          <p className="text-sm opacity-80 mb-1">{lang === 'ar' ? 'رصيد المحفظة' : 'Wallet Balance'}</p>
          <p className="text-4xl font-bold">{walletBalance} <span className="text-lg">{lang === 'ar' ? 'جنيه' : 'EGP'}</span></p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Active Packages */}
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-secondary" />
            {lang === 'ar' ? 'الباقات النشطة' : 'Active Packages'}
          </h2>
          {activePurchases.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا توجد باقات نشطة' : 'No active packages'}</p>
              <Link to="/dashboard" className="text-sm text-primary font-medium mt-2 inline-block">
                {lang === 'ar' ? 'تصفح الباقات' : 'Browse packages'}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activePurchases.map(p => (
                <div key={p.id} className="bg-card border-2 border-secondary/30 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{routeName(p.route_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'ar' ? 'تم الشراء' : 'Purchased'}: {new Date(p.purchased_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="bg-secondary/10 px-3 py-1.5 rounded-full">
                      <span className="text-secondary font-bold text-sm">
                        {p.status === 'active' ? (lang === 'ar' ? 'نشط' : 'Active') : p.status}
                      </span>
                    </div>
                  </div>
                  {/* Rides Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{lang === 'ar' ? 'رحلات متبقية' : 'Rides remaining'}</span>
                      <span className="font-bold text-foreground">{p.rides_remaining} / {p.rides_total}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all"
                        style={{ width: `${(p.rides_remaining / p.rides_total) * 100}%` }}
                      />
                    </div>
                  </div>
                  {/* Expiry */}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className={daysLeft(p.expires_at) <= 3 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                      {daysLeft(p.expires_at) === 0
                        ? (lang === 'ar' ? 'تنتهي اليوم!' : 'Expires today!')
                        : lang === 'ar'
                          ? `متبقي ${daysLeft(p.expires_at)} يوم`
                          : `${daysLeft(p.expires_at)} days left`}
                    </span>
                  </div>
                  {/* Payment confirmation */}
                  <div className="flex items-center gap-2 text-xs">
                    {p.payment_proof_url ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-green-700">{lang === 'ar' ? 'تم تأكيد الدفع' : 'Payment confirmed'}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-amber-600">{lang === 'ar' ? 'في انتظار تأكيد الدفع' : 'Payment pending'}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refunds */}
        {refunds.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
              <RotateCcw className="w-5 h-5 text-primary" />
              {lang === 'ar' ? 'المبالغ المستردة' : 'Refunds'}
            </h2>
            <div className="space-y-2">
              {refunds.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.amount} {lang === 'ar' ? 'جنيه' : 'EGP'}</p>
                    <p className="text-xs text-muted-foreground">{r.reason}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    r.status === 'processed' ? 'bg-green-100 text-green-700' :
                    r.status === 'credited' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {r.status === 'processed' ? (lang === 'ar' ? 'تم الاسترداد' : 'Processed') :
                     r.status === 'credited' ? (lang === 'ar' ? 'أُضيف للرصيد' : 'Credited') :
                     (lang === 'ar' ? 'قيد المراجعة' : 'Pending')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expired Packages */}
        {expiredPurchases.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              {lang === 'ar' ? 'باقات سابقة' : 'Past Packages'}
            </h2>
            <div className="space-y-2">
              {expiredPurchases.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4 opacity-60">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{routeName(p.route_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.rides_remaining}/{p.rides_total} {lang === 'ar' ? 'رحلة متبقية' : 'rides left'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.rides_remaining <= 0 ? (lang === 'ar' ? 'منتهية' : 'Used up') : (lang === 'ar' ? 'منتهية الصلاحية' : 'Expired')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Wallet;
