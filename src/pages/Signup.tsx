import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, User, ArrowRight, ArrowLeft, Car, Users } from 'lucide-react';

type UserRole = 'rider' | 'driver';

const Signup = () => {
  const { signUp } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [drivingLicense, setDrivingLicense] = useState('');
  const [carLicense, setCarLicense] = useState('');
  const [loading, setLoading] = useState(false);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: t('auth.error'), description: t('auth.passwordMin'), variant: 'destructive' });
      return;
    }
    if (role === 'driver' && (!nationalId || !drivingLicense || !carLicense)) {
      toast({ title: t('auth.error'), description: lang === 'ar' ? 'يرجى ملء جميع بيانات السائق' : 'Please fill all driver fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, fullName);

      // If driver, submit a driver application after signup
      if (role === 'driver') {
        // We'll wait a moment for the auth session to be set
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('driver_applications').insert({
            user_id: session.user.id,
            license_number: drivingLicense,
            vehicle_model: lang === 'ar' ? 'في انتظار المراجعة' : 'Pending review',
            vehicle_plate: carLicense,
            vehicle_year: new Date().getFullYear(),
            notes: `${lang === 'ar' ? 'الرقم القومي' : 'National ID'}: ${nationalId}`,
          });
        }
      }

      toast({ title: t('auth.success'), description: lang === 'ar' ? 'تم إنشاء حسابك بنجاح' : 'Account created successfully' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Role selection screen
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="text-3xl font-bold text-primary font-arabic">
              {lang === 'ar' ? 'مسار' : 'Massar'}
            </Link>
            <h1 className="text-2xl font-bold text-foreground mt-6">
              {lang === 'ar' ? 'إنشاء حساب' : 'Create Account'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {lang === 'ar' ? 'اختر نوع حسابك' : 'Choose your account type'}
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setRole('rider')}
              className="w-full bg-card border-2 border-border rounded-2xl p-6 hover:border-primary transition-all text-start flex items-center gap-4 group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 shrink-0">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">
                  {lang === 'ar' ? 'راكب' : 'Rider'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === 'ar' ? 'احجز رحلات واستمتع بخدمة الشاتل' : 'Book rides and enjoy shuttle service'}
                </p>
              </div>
            </button>

            <button
              onClick={() => setRole('driver')}
              className="w-full bg-card border-2 border-border rounded-2xl p-6 hover:border-secondary transition-all text-start flex items-center gap-4 group"
            >
              <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 shrink-0">
                <Car className="w-7 h-7 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">
                  {lang === 'ar' ? 'سائق' : 'Driver'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === 'ar' ? 'انضم كسائق واكسب مع مسار' : 'Join as a driver and earn with Massar'}
                </p>
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">{t('auth.loginLink')}</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-primary font-arabic">
            {lang === 'ar' ? 'مسار' : 'Massar'}
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-6">
            {role === 'driver'
              ? (lang === 'ar' ? 'تسجيل كسائق' : 'Sign Up as Driver')
              : t('auth.signupTitle')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('auth.signupSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-card p-8 space-y-4">
          <button
            type="button"
            onClick={() => setRole(null)}
            className="text-sm text-primary hover:underline flex items-center gap-1 mb-2"
          >
            {lang === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {lang === 'ar' ? 'تغيير نوع الحساب' : 'Change account type'}
          </button>

          <div className="space-y-2">
            <Label htmlFor="name">{t('auth.fullName')}</Label>
            <div className="relative">
              <User className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="name" placeholder={t('auth.fullNamePlaceholder')} className="ps-10"
                value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="name@example.com" className="ps-10"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="password" type="password" placeholder="••••••••" className="ps-10"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          {role === 'driver' && (
            <>
              <div className="border-t border-border pt-4 mt-4">
                <p className="text-sm font-semibold text-foreground mb-3">
                  {lang === 'ar' ? 'بيانات السائق' : 'Driver Information'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalId">{lang === 'ar' ? 'الرقم القومي' : 'National ID'}</Label>
                <Input id="nationalId" placeholder={lang === 'ar' ? 'أدخل الرقم القومي' : 'Enter your national ID'}
                  value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drivingLicense">{lang === 'ar' ? 'رخصة القيادة' : 'Driving License Number'}</Label>
                <Input id="drivingLicense" placeholder={lang === 'ar' ? 'أدخل رقم رخصة القيادة' : 'Enter driving license number'}
                  value={drivingLicense} onChange={(e) => setDrivingLicense(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carLicense">{lang === 'ar' ? 'رخصة السيارة' : 'Car License Number'}</Label>
                <Input id="carLicense" placeholder={lang === 'ar' ? 'أدخل رقم رخصة السيارة' : 'Enter car license number'}
                  value={carLicense} onChange={(e) => setCarLicense(e.target.value)} required />
              </div>
            </>
          )}

          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            {loading ? t('auth.loading') : t('auth.signup')}
            <Arrow className="w-4 h-4" />
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">{t('auth.loginLink')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
