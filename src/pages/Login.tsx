import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, Phone } from 'lucide-react';

const Login = () => {
  const { signIn } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loginEmail = loginMethod === 'phone'
        ? `${phone.replace(/[^0-9]/g, '')}@driver.massar.app`
        : email;
      await signIn(loginEmail, password);
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-primary font-arabic">
            {lang === 'ar' ? 'مسار' : 'Massar'}
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-6">{t('auth.loginTitle')}</h1>
          <p className="text-muted-foreground mt-2">{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-card p-8 space-y-5">
          {/* Toggle between email and phone login */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button type="button"
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${loginMethod === 'email' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {lang === 'ar' ? 'بريد إلكتروني' : 'Email'}
            </button>
            <button type="button"
              onClick={() => setLoginMethod('phone')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${loginMethod === 'phone' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {lang === 'ar' ? 'رقم الهاتف (سائق)' : 'Phone (Driver)'}
            </button>
          </div>

          {loginMethod === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="name@example.com" className="ps-10"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="phone">{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
              <div className="relative">
                <Phone className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="phone" type="tel" placeholder="01XXXXXXXXX" className="ps-10"
                  value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="ps-10 pe-10"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-3 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            {loading ? t('auth.loading') : t('auth.login')}
            <Arrow className="w-4 h-4" />
          </Button>

          <Link to="/signup" className="block text-center text-sm text-primary font-medium hover:underline">
            {t('auth.noAccount')} {t('auth.signupLink')}
          </Link>
        </form>
      </div>
    </div>
  );
};

export default Login;
