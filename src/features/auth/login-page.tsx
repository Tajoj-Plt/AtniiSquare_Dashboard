import * as React from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, ArrowLeft, Eye, EyeOff, Languages, Lock, Moon, Sun,
} from 'lucide-react';
import { ApiError, savedLogin } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useTheme } from '@/app/theme';
import { applyLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Label } from '@/components/ui/primitives';

/**
 * The sign-in screen.
 *
 * The artwork is the page rather than a panel beside it: one full-bleed image with the
 * form floating on it as glass. Everything interactive here earns its place by removing a
 * failed attempt — the password can be revealed, Caps Lock is called out before it costs a
 * lockout, and the address is already filled from last time.
 */
export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { user, signIn, loading } = useAuth();
  const { resolved, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const stageRef = React.useRef<HTMLDivElement>(null);

  const [email, setEmail] = React.useState(() => savedLogin.email);
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(() => savedLogin.remember);
  const [reveal, setReveal] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // The glow follows the pointer across the artwork. Written straight to a custom property
  // so it never triggers a React render, and skipped on touch and under reduced motion.
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;
    const node = stageRef.current;
    if (!node) return;
    const onMove = (e: PointerEvent) => {
      node.style.setProperty('--mx', `${(e.clientX / window.innerWidth) * 100}%`);
      node.style.setProperty('--my', `${(e.clientY / window.innerHeight) * 100}%`);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  if (!loading && user) {
    const from = (location.state as any)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password, remember);
      savedLogin.save(email.trim(), remember);
      navigate((location.state as any)?.from?.pathname ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.invalid'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={stageRef}
      className="relative min-h-screen overflow-hidden"
      style={{ ['--mx' as any]: '50%', ['--my' as any]: '35%' }}
    >
      {/* The photograph: dark and empty on the left, the dashboard on a tablet on the right.
          It is anchored towards its right edge so the tablet — the part that says what this
          product is — stays in frame when a narrow screen crops the sides away. Phones get
          a smaller file; the full-size one is only worth its weight on a wide screen. */}
      <picture>
        <source media="(max-width: 767px)" srcSet="/hero-tablet-1200.jpg" />
        <img
          src="/hero-tablet.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[70%_center] xl:object-right"
        />
      </picture>
      {/* The form is centred at every width, so it sits in front of the tablet. The frame
          is dimmed evenly, and a little more behind the form, so the fields stay readable
          while the tablet still shows around it. */}
      <div aria-hidden className="absolute inset-0 bg-black/50" />
      <div aria-hidden className="absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(ellipse 50% 60% at 50% 50%, rgb(0 0 0 / 0.45), transparent 75%)' }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundImage:
            'radial-gradient(38rem 26rem at var(--mx) var(--my), hsl(217 91% 60% / 0.22), transparent 70%)',
        }}
      />

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center gap-2 p-5 sm:p-7">
          <Link to="/welcome" className="flex items-center gap-2.5 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-lg font-bold ring-1 ring-white/20 backdrop-blur-sm">
              س
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold leading-tight">{t('app.name')}</span>
              <span className="block text-xs text-white/60">{t('app.tagline')}</span>
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-1">
            <button
              onClick={() => applyLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
              aria-label={t('settings.language')}
              className="grid h-9 w-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Languages className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              aria-label={t('settings.theme')}
              className="grid h-9 w-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {resolved === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-10">
          <div className="w-full max-w-md animate-fade-in">
            <div className="mb-6 text-center text-white">
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-[2rem]">
                {t('auth.signInTitle')}
              </h1>
              <p className="mt-2 text-sm text-white/70">{t('auth.signInSubtitle')}</p>
            </div>

            {/* Glass rather than a solid card: the artwork stays visible through it, which
                is the whole point of putting it behind the form. */}
            <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-6 shadow-raised backdrop-blur-2xl sm:p-7">
              <form onSubmit={submit} className="space-y-4" noValidate>
                {error ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-2xl border border-rose-300/30 bg-rose-500/15 p-3 text-sm text-rose-100"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <Field label={<span className="text-white/85">{t('auth.email')}</span>} required htmlFor="login-email">
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@sudamind.sd"
                    autoFocus={!email}
                    className="border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                  />
                </Field>

                <Field label={<span className="text-white/85">{t('auth.password')}</span>} required htmlFor="login-password">
                  <div className="relative">
                    <Input
                      id="login-password"
                      name="password"
                      type={reveal ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      // Caps Lock is the single most common reason a correct password is
                      // rejected; saying so costs nothing and saves a lockout.
                      onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                      autoFocus={Boolean(email)}
                      // Physical padding, not logical: the field's own direction is forced
                      // LTR, so the toggle sits on the right in Arabic too — where the
                      // password's last character actually is.
                      className="border-white/15 bg-white/10 pr-11 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((r) => !r)}
                      aria-label={t(reveal ? 'auth.hidePassword' : 'auth.showPassword')}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-white/60 transition-colors hover:text-white"
                    >
                      {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                <p
                  className={cn(
                    'flex items-center gap-1.5 text-xs text-amber-200 transition-all duration-200',
                    capsLock ? 'h-4 opacity-100' : 'h-0 overflow-hidden opacity-0',
                  )}
                >
                  <Lock className="h-3 w-3" /> {t('auth.capsLock')}
                </p>

                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="login-remember"
                    checked={remember}
                    onCheckedChange={(v) => {
                      const on = v === true;
                      setRemember(on);
                      if (!on) savedLogin.forget();
                    }}
                    className="border-white/30 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-neutral-900"
                  />
                  <Label htmlFor="login-remember" className="cursor-pointer text-sm font-normal text-white/85">
                    {t('auth.rememberMe')}
                  </Label>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  loading={submitting}
                  className="w-full bg-white text-neutral-900 hover:bg-white/90"
                >
                  {t('actions.signIn')}
                </Button>
                <p className="text-center text-xs text-white/55">{t('auth.rememberHint')}</p>
              </form>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/55">
              <Link to="/welcome" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                {t('landing.nav.about')}
              </Link>
              <span aria-hidden>·</span>
              <span>{t('auth.demoHint')}</span>
            </div>
          </div>
        </main>

        <footer className="p-5 text-center text-xs text-white/40 sm:p-7">
          © {new Date().getFullYear()} {t('app.name')}
        </footer>
      </div>
    </div>
  );
}
