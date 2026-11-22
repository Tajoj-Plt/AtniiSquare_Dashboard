import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Apple, ArrowLeft, ArrowRight, Languages as LanguagesIcon, Menu, Moon,
  Play as PlayIcon, Smartphone, Sun, X,
} from 'lucide-react';
import { useTheme } from '@/app/theme';
import { applyLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CONTENT_TONES, TONES, cycleTone } from '@/lib/tones';
import { Button } from '@/components/ui/button';
import { useReveal, useCountUp } from './use-reveal';
import { useLandingContent, type LandingSection } from './landing-content';
import { BackToTop, FaqRow, Icon, LiveLibrary, ScrollProgress } from './landing-parts';
import { LibraryScreen, PhoneMock, ReaderScreen, VideoFrame, timeToSeconds } from './landing-media';

/**
 * The public marketing page, rendered from the document the dashboard publishes.
 *
 * Section order, visibility and every line of copy come from the API, so operators reshape
 * the page without a deploy; the bundled translations remain the fallback for anything not
 * customised and for when the API is unreachable. Each section key maps to a renderer here,
 * and an unrecognised key falls through to a generic card layout — that is what makes a
 * custom section added from the dashboard render instead of disappearing.
 */
export function LandingPage() {
  const { t, i18n } = useTranslation();
  const { resolved, setTheme } = useTheme();
  const content = useLandingContent();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Anchor links are built from whatever sections are actually published, minus the two
  // that are page furniture rather than destinations.
  const navSections = content.sections.filter((s) => !['hero', 'cta'].includes(s.key));
  // At the top of the page the bar is transparent over the hero photograph, which is dark
  // in both themes — theme-coloured text would vanish against it in light mode. Once the
  // page scrolls (or the menu opens) the bar gets its own surface and normal colours.
  const overHero = !scrolled && !menuOpen && content.sections[0]?.key === 'hero';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ScrollProgress />

      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          scrolled || menuOpen ? 'border-b bg-background/80 backdrop-blur-xl' : 'border-b border-transparent',
          overHero && 'text-white',
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
              س
            </span>
            <span className="text-[15px] font-semibold tracking-tight">{t('app.name')}</span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 xl:flex">
            {navSections.map((s) => (
              <a
                key={s.key}
                href={`#${s.key}`}
                className={cn(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors',
                  overHero
                    ? 'text-white/75 hover:bg-white/10 hover:text-white'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {sectionNavLabel(s, content, t)}
              </a>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1 xl:ms-0">
            <Button variant="ghost" size="icon-sm" className={cn(overHero && 'text-white hover:bg-white/10 hover:text-white')}
              onClick={() => applyLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
              aria-label={t('settings.language')}>
              <LanguagesIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" className={cn(overHero && 'text-white hover:bg-white/10 hover:text-white')}
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              aria-label={t('settings.theme')}>
              {resolved === 'dark' ? <Moon /> : <Sun />}
            </Button>
            <Button asChild size="sm"
              className={cn('hidden sm:inline-flex', overHero && 'bg-white text-neutral-900 hover:bg-white/90')}>
              <Link to={content.setting('signInHref', '/login')}>{t('landing.nav.signIn')}</Link>
            </Button>
            <Button variant="ghost" size="icon-sm" className={cn('xl:hidden', overHero && 'text-white hover:bg-white/10 hover:text-white')}
              onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}
              aria-label={t('landing.nav.features')}>
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t bg-background px-5 py-3 xl:hidden">
            {navSections.map((s) => (
              <a key={s.key} href={`#${s.key}`} onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
                {sectionNavLabel(s, content, t)}
              </a>
            ))}
            <Button asChild className="mt-2 w-full sm:hidden">
              <Link to={content.setting('signInHref', '/login')}>{t('landing.nav.signIn')}</Link>
            </Button>
          </nav>
        ) : null}
      </header>

      {content.sections.map((section) => (
        <React.Fragment key={section.key}>
          <SectionRenderer section={section} content={content} />
          {section.key === 'types' && content.setting('showLiveLibrary', true) ? <LiveLibrary /> : null}
        </React.Fragment>
      ))}

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              س
            </span>
            <div>
              <p className="text-sm font-semibold">{t('app.name')}</p>
              <p className="text-xs text-muted-foreground">
                {content.setting('brand', t('landing.footer.tagline'))}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {navSections.slice(0, 5).map((s) => (
              <a key={s.key} href={`#${s.key}`} className="hover:text-foreground">
                {sectionNavLabel(s, content, t)}
              </a>
            ))}
            <Link to={content.setting('signInHref', '/login')} className="font-medium text-foreground hover:text-accent">
              {t('landing.nav.signIn')}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t('app.name')} — {content.setting('footerRights', t('landing.footer.rights'))}
          </p>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}

type Content = ReturnType<typeof useLandingContent>;

/** Nav label per section: the stored nav map, then the section's own title. */
function sectionNavLabel(section: LandingSection, content: Content, t: (k: string) => string) {
  const NAV_KEY: Record<string, string> = {
    problem: 'about', solution: 'features', types: 'library', video: 'video',
    how: 'how', mobile: 'mobile', audience: 'audience', trust: 'trust', faq: 'faq',
  };
  const navKey = NAV_KEY[section.key];
  if (navKey) {
    const label = t(`landing.nav.${navKey}`);
    if (label !== `landing.nav.${navKey}`) return label;
  }
  return content.text(section, 'title') || section.key;
}

function SectionRenderer({ section, content }: { section: LandingSection; content: Content }) {
  switch (section.key) {
    case 'hero': return <Hero section={section} content={content} />;
    case 'types': return <TypeTabs section={section} content={content} />;
    case 'how': return <Stepper section={section} content={content} />;
    case 'video': return <VideoShowcase section={section} content={content} />;
    case 'mobile': return <MobileApp section={section} content={content} />;
    case 'faq': return <Faq section={section} content={content} />;
    case 'cta': return <FinalCta section={section} content={content} />;
    default: return <CardGrid section={section} content={content} />;
  }
}

/* ------------------------------------------------------------------ layout */

function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-20 px-5 py-20 sm:py-24', className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Heading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const reveal = useReveal<HTMLDivElement>();
  return (
    <div ref={reveal.ref} style={reveal.style} className={cn('mx-auto mb-12 max-w-2xl text-center', reveal.className)}>
      {eyebrow ? <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p> : null}
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function RevealCard({
  children, delay = 0, className,
}: { children: React.ReactNode; delay?: number; className?: string }) {
  const reveal = useReveal<HTMLDivElement>(delay);
  return (
    <div
      ref={reveal.ref}
      style={reveal.style}
      className={cn(
        'rounded-3xl border bg-card p-7 shadow-soft transition-transform duration-300 hover:-translate-y-0.5',
        reveal.className,
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- sections */

function Hero({ section, content }: { section: LandingSection; content: Content }) {
  const { t } = useTranslation();
  const reveal = useReveal<HTMLDivElement>();
  const glowRef = React.useRef<HTMLDivElement>(null);

  // The bloom follows the pointer across the hero. Written straight to a CSS custom property
  // so it never triggers a React render, and skipped entirely on touch and reduced-motion.
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;
    const node = glowRef.current;
    if (!node) return;
    const onMove = (e: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
      node.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    };
    node.addEventListener('pointermove', onMove);
    return () => node.removeEventListener('pointermove', onMove);
  }, []);

  const stats = section.items ?? [];

  return (
    <section
      id="hero"
      ref={glowRef}
      className="relative isolate flex min-h-[100svh] scroll-mt-20 flex-col justify-center overflow-hidden bg-neutral-950 px-5 pb-16 pt-28 text-white sm:pt-32"
      style={{ ['--mx' as any]: '50%', ['--my' as any]: '45%' }}
    >
      {/* The photograph: the dashboard itself, on a tablet in someone's hands — dark and
          empty on the left, the product on the right. Anchored towards its right edge so
          the tablet survives the crop on narrow screens; phones get the lighter file. */}
      <picture>
        <source media="(max-width: 767px)" srcSet="/hero-tablet-1200.jpg" />
        <img
          src="/hero-tablet.jpg"
          alt={t('landing.hero.imageAlt')}
          loading="eager"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center] xl:object-right"
        />
      </picture>
      {/* The copy is centred over the photo at every width, so it always sits in front
          of the tablet. The frame is dimmed evenly, and a little more behind the copy
          itself, so the text stays readable while the tablet still shows around it. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/50" />
      <div aria-hidden className="absolute inset-0 -z-10"
        style={{ backgroundImage: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgb(0 0 0 / 0.45), transparent 75%)' }} />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black/60 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-black/60 to-transparent" />
      {/* A soft bloom that follows the pointer. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
        style={{ backgroundImage: 'radial-gradient(34rem 22rem at var(--mx) var(--my), hsl(217 91% 60% / 0.16), transparent 70%)' }} />

      <div className="mx-auto w-full max-w-7xl">
        <div ref={reveal.ref} style={reveal.style}
          className={cn('mx-auto max-w-2xl text-center', reveal.className)}>
          {content.text(section, 'eyebrow') ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
              </span>
              {content.text(section, 'eyebrow')}
            </span>
          ) : null}

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
            {content.text(section, 'title')}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty leading-relaxed text-white/75 sm:text-lg">
            {content.text(section, 'subtitle')}
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="w-full bg-white text-neutral-900 hover:bg-white/90 sm:w-auto">
              <a href="#solution">
                {content.text(section, 'ctaPrimary') || t('landing.hero.ctaPrimary')}
                <ArrowRight className="rtl:hidden" />
                <ArrowLeft className="hidden rtl:block" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg"
              className="w-full border-white/25 bg-white/5 text-white backdrop-blur-md hover:bg-white/15 hover:text-white sm:w-auto">
              <Link to={content.setting('signInHref', '/login')}>
                {content.text(section, 'ctaSecondary') || t('landing.hero.ctaSecondary')}
              </Link>
            </Button>
          </div>

          {content.setting('showStats', true) && stats.length ? (
            <div className="mx-auto mt-12 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((stat, i) => (
                <Stat key={i} glass value={Number(stat.value ?? 0)}
                  label={content.itemText(stat, 'label', `landing.hero.stat${i + 1}`)} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label, glass }: { value: number; label: string; glass?: boolean }) {
  const { ref, className, style, display } = useCountUp(value);
  return (
    <div ref={ref} style={style}
      className={cn(
        'rounded-3xl px-4 py-6 text-center',
        // Over the photo the tiles are glass, so the picture reads through them.
        glass ? 'border border-white/15 bg-white/10 backdrop-blur-md' : 'border bg-card shadow-soft',
        className,
      )}>
      <p className="numeric text-3xl font-bold tracking-tight">{display}</p>
      <p className={cn('mt-1.5 text-xs', glass ? 'text-white/65' : 'text-muted-foreground')}>{label}</p>
    </div>
  );
}

/** The default renderer: a heading plus a responsive grid of icon cards. */
function CardGrid({ section, content }: { section: LandingSection; content: Content }) {
  const items = section.items ?? [];
  const cols = items.length <= 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3';
  const alt = ['problem', 'audience'].includes(section.key);

  return (
    <Section id={section.key} className={alt ? 'bg-secondary/50' : undefined}>
      <Heading
        title={content.text(section, 'title')}
        subtitle={content.text(section, 'subtitle')}
      />
      <div className={cn('grid gap-5', cols)}>
        {items.map((item, i) => (
          <RevealCard key={i} delay={(i % 3) * 90} className="group">
            <span className={cn(
              'grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-105',
              section.key === 'audience' ? 'bg-primary text-primary-foreground' : TONES[cycleTone(i)].chip,
            )}>
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">
              {content.itemText(item, 'title', `landing.${section.key}.item${i}`)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {content.itemText(item, 'body', `landing.${section.key}.item${i}body`)}
            </p>
          </RevealCard>
        ))}
      </div>
    </Section>
  );
}

/** Type order matches the library, so a type keeps one hue across the whole product. */
const TYPE_ORDER = ['book', 'article', 'research', 'scientific_paper', 'translated_paper', 'graduation_project'];

function TypeTabs({ section, content }: { section: LandingSection; content: Content }) {
  const items = section.items ?? [];
  const toneAt = (i: number) => CONTENT_TONES[TYPE_ORDER[i]] ?? cycleTone(i);
  const [active, setActive] = React.useState(0);
  const reveal = useReveal<HTMLDivElement>();
  const current = items[active];

  return (
    <Section id={section.key} className="bg-secondary/50">
      <Heading title={content.text(section, 'title')} subtitle={content.text(section, 'subtitle')} />
      <div ref={reveal.ref} style={reveal.style} className={cn('mx-auto max-w-3xl', reveal.className)}>
        <div role="tablist" aria-label={content.text(section, 'title')} className="flex flex-wrap justify-center gap-2">
          {items.map((item, i) => (
            <button key={i} role="tab" aria-selected={active === i} onClick={() => setActive(i)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
                active === i
                  ? `${TONES[toneAt(i)].chip} ${TONES[toneAt(i)].ring} shadow-soft`
                  : 'bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground',
              )}>
              <Icon name={item.icon} className="h-4 w-4" />
              {content.itemText(item, 'title', `landing.types.item${i}`)}
            </button>
          ))}
        </div>

        {current ? (
          <div key={active} className="mt-8 animate-fade-in rounded-3xl border bg-card p-9 text-center shadow-soft">
            <span className={cn('mx-auto grid h-14 w-14 place-items-center rounded-2xl', TONES[toneAt(active)].chip)}>
              <Icon name={current.icon} className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-xl font-semibold">
              {content.itemText(current, 'title', `landing.types.item${active}`)}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
              {content.itemText(current, 'body', `landing.types.item${active}body`)}
            </p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function Stepper({ section, content }: { section: LandingSection; content: Content }) {
  const { t } = useTranslation();
  const steps = section.items ?? [];
  const [active, setActive] = React.useState(0);
  const current = steps[active];

  return (
    <Section id={section.key}>
      <Heading title={content.text(section, 'title')} subtitle={content.text(section, 'subtitle')} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <ol className="relative space-y-1">
          <span aria-hidden className="absolute inset-y-2 start-[19px] w-px bg-border" />
          {steps.map((step, i) => (
            <li key={i} className="relative">
              <button onClick={() => setActive(i)}
                className={cn('flex w-full items-center gap-3 rounded-xl p-2.5 text-start transition-colors',
                  active === i ? 'bg-secondary' : 'hover:bg-secondary/60')}>
                <span className={cn(
                  'numeric relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold transition-colors',
                  active === i
                    ? `${TONES[cycleTone(i)].solid} border-transparent`
                    : 'border-border bg-card text-muted-foreground',
                )}>
                  {i + 1}
                </span>
                <span className={cn('text-sm font-medium', active !== i && 'text-muted-foreground')}>
                  {content.itemText(step, 'title', `landing.how.item${i}`)}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="rounded-3xl border bg-card p-9 shadow-soft">
          {current ? (
            <div key={active} className="animate-fade-in">
              <span className={cn('grid h-14 w-14 place-items-center rounded-2xl', TONES[cycleTone(active)].chip)}>
                <Icon name={current.icon} className="h-7 w-7" />
              </span>
              <p className="numeric mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {String(active + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                {content.itemText(current, 'title', `landing.how.item${active}`)}
              </h3>
              <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted-foreground">
                {content.itemText(current, 'body', `landing.how.item${active}body`)}
              </p>
            </div>
          ) : null}
          <div className="mt-8 flex gap-2">
            <Button variant="outline" size="sm" disabled={active === 0} onClick={() => setActive((a) => a - 1)}>
              {t('actions.previous')}
            </Button>
            <Button size="sm" disabled={active >= steps.length - 1} onClick={() => setActive((a) => a + 1)}>
              {t('actions.next')}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/**
 * The product film.
 *
 * The chapters beside the player are not decoration: each carries a timestamp, and picking
 * one starts the video there. That turns a two-minute video into four things a visitor can
 * choose between — most of them will only want one.
 */
function VideoShowcase({ section, content }: { section: LandingSection; content: Content }) {
  const { t } = useTranslation();
  const chapters = section.items ?? [];
  const [active, setActive] = React.useState(0);
  const [seek, setSeek] = React.useState({ seconds: 0, token: 0 });
  const reveal = useReveal<HTMLDivElement>();

  const play = (i: number) => {
    setActive(i);
    setSeek((s) => ({ seconds: timeToSeconds(chapters[i]?.time as string), token: s.token + 1 }));
  };

  return (
    <Section id={section.key} className="bg-secondary/50">
      <Heading
        eyebrow={content.text(section, 'eyebrow')}
        title={content.text(section, 'title')}
        subtitle={content.text(section, 'subtitle')}
      />
      <div
        ref={reveal.ref}
        style={reveal.style}
        className={cn('grid items-start gap-8 lg:grid-cols-[1.55fr_1fr]', reveal.className)}
      >
        <VideoFrame
          url={content.asset(section, 'videoUrl')}
          poster={content.asset(section, 'posterUrl')}
          duration={content.text(section, 'duration')}
          caption={content.text(section, 'caption')}
          label={content.text(section, 'title') || t('landing.nav.video')}
          seek={seek}
        />

        {chapters.length ? (
          <ol className="space-y-2">
            {chapters.map((chapter, i) => (
              <li key={i}>
                <button
                  onClick={() => play(i)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition-all duration-200',
                    active === i
                      ? 'border-transparent bg-card shadow-soft'
                      : 'border-transparent bg-transparent hover:bg-card/70',
                  )}
                >
                  <span className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform duration-300',
                    active === i ? TONES[cycleTone(i)].solid : TONES[cycleTone(i)].chip,
                  )}>
                    <Icon name={chapter.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold">
                        {content.itemText(chapter, 'title', `landing.video.item${i}`)}
                      </span>
                      {chapter.time ? (
                        <span className="numeric ms-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                          {String(chapter.time)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {content.itemText(chapter, 'body', `landing.video.item${i}body`)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </Section>
  );
}

/**
 * The mobile app.
 *
 * The device screens are built from the same tokens as the product, so they follow the
 * visitor's theme instead of being a light-mode screenshot pasted onto a dark page. An
 * operator who has a real screenshot can point `screenUrl` at it and it takes over.
 */
function MobileApp({ section, content }: { section: LandingSection; content: Content }) {
  const { t } = useTranslation();
  const features = section.items ?? [];
  const reveal = useReveal<HTMLDivElement>();
  const screenUrl = content.asset(section, 'screenUrl');
  const appStore = content.setting('appStoreHref', '');
  const playStore = content.setting('playStoreHref', '');

  return (
    <Section id={section.key} className="overflow-hidden">
      <div ref={reveal.ref} style={reveal.style}
        className={cn('grid items-center gap-12 lg:grid-cols-2 lg:gap-16', reveal.className)}>
        <div>
          {content.text(section, 'eyebrow') ? (
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {content.text(section, 'eyebrow')}
            </p>
          ) : null}
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {content.text(section, 'title')}
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            {content.text(section, 'subtitle')}
          </p>

          <ul className="mt-8 space-y-5">
            {features.map((feature, i) => (
              <li key={i} className="flex gap-4">
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', TONES[cycleTone(i)].chip)}>
                  <Icon name={feature.icon} className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block font-medium">
                    {content.itemText(feature, 'title', `landing.mobile.item${i}`)}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {content.itemText(feature, 'body', `landing.mobile.item${i}body`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {/* Store links are page settings, and an unset one is left out rather than
                shipped as a button that goes nowhere. */}
            {appStore ? (
              <Button asChild size="lg"><a href={appStore} target="_blank" rel="noreferrer">
                <Apple /> {t('landing.mobile.appStore')}
              </a></Button>
            ) : null}
            {playStore ? (
              <Button asChild size="lg" variant="outline"><a href={playStore} target="_blank" rel="noreferrer">
                <PlayIcon /> {t('landing.mobile.playStore')}
              </a></Button>
            ) : null}
            {!appStore && !playStore ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed px-4 py-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                {content.text(section, 'storeNote') || t('landing.mobile.soon')}
              </span>
            ) : null}
          </div>

          {content.text(section, 'note') ? (
            <p className="mt-4 text-xs text-muted-foreground">{content.text(section, 'note')}</p>
          ) : null}
        </div>

        {/* Two devices: the one behind shows where the one in front leads. They overlap
            rather than sitting side by side, so the pair reads as one object. */}
        <div className="relative mx-auto flex w-fit items-center justify-center py-6">
          <div aria-hidden className="pointer-events-none absolute -inset-16 -z-10 blur-3xl"
            style={{ background: 'radial-gradient(50% 50% at 50% 50%, hsl(var(--accent) / 0.28), transparent 70%)' }} />
          {/* The float lives on the wrapper: an animated transform would otherwise replace
              the tilt rather than compose with it. */}
          <div className="anim-float-slow z-0 hidden ltr:-me-20 rtl:-ms-20 sm:block">
            <PhoneMock width="w-[11.5rem]" className="translate-y-10 -rotate-[7deg] opacity-95 rtl:rotate-[7deg]">
              <ReaderScreen
                title={content.text(section, 'readerTitle') || t('landing.mobile.readerTitle')}
                progressLabel={t('landing.mobile.offline')}
              />
            </PhoneMock>
          </div>
          <div className="anim-float relative z-10">
          <PhoneMock>
            {screenUrl ? (
              <img src={screenUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <LibraryScreen title={content.text(section, 'screenTitle') || t('landing.nav.library')} />
            )}
          </PhoneMock>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Faq({ section, content }: { section: LandingSection; content: Content }) {
  const [open, setOpen] = React.useState<number | null>(0);
  const items = section.items ?? [];
  return (
    <Section id={section.key} className="bg-secondary/50">
      <Heading title={content.text(section, 'title')} subtitle={content.text(section, 'subtitle')} />
      <div className="mx-auto max-w-3xl divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
        {items.map((item, i) => (
          <FaqRow
            key={i}
            expanded={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
            question={content.itemText(item, 'title', `landing.faq.q${i + 1}`)}
            answer={content.itemText(item, 'body', `landing.faq.a${i + 1}`)}
          />
        ))}
      </div>
    </Section>
  );
}

function FinalCta({ section, content }: { section: LandingSection; content: Content }) {
  const { t } = useTranslation();
  const reveal = useReveal<HTMLDivElement>();
  return (
    <Section id={section.key}>
      <div ref={reveal.ref} style={reveal.style}
        className={cn('relative overflow-hidden rounded-[2rem] bg-primary px-6 py-20 text-center text-primary-foreground', reveal.className)}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
          style={{ backgroundImage: 'radial-gradient(40rem 20rem at 50% 0%, hsl(217 91% 60% / 0.35), transparent 70%)' }} />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {content.text(section, 'title')}
          </h2>
          <p className="mt-4 text-pretty leading-relaxed opacity-75">{content.text(section, 'subtitle')}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
              <Link to={content.setting('signInHref', '/login')}>
                {content.text(section, 'primary') || t('landing.cta.primary')}
              </Link>
            </Button>
            <a href={content.setting('docsHref', '/api/v1/docs')} target="_blank" rel="noreferrer"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-current/25 px-8 text-[15px] font-medium transition-colors hover:bg-white/10 sm:w-auto">
              {content.text(section, 'secondary') || t('landing.cta.secondary')}
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
