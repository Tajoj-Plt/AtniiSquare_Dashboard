import * as React from 'react';

const inViewport = (node: Element, margin = 80) =>
  node.getBoundingClientRect().top < window.innerHeight - margin;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs `onVisible` once the node is on screen.
 *
 * IntersectionObserver is the primary mechanism, but it is *not* trusted on its own: a
 * passive scroll/resize check runs alongside it, and anything already in view at mount
 * fires immediately. Content that is invisible until JavaScript decides otherwise is a
 * bad trade on a public page — a delayed or missed observer callback would leave whole
 * sections blank, which is exactly what happens with programmatic scrolling and anchor
 * jumps. Whichever signal arrives first wins, and everything unsubscribes after.
 */
function useOnVisible(
  ref: React.MutableRefObject<HTMLElement | null>,
  onVisible: () => void,
  enabled: boolean,
) {
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || fired.current) return;
    const node = ref.current;
    if (!node) return;

    let lastCheck = 0;
    const cleanups: (() => void)[] = [];

    const trigger = () => {
      if (fired.current) return;
      fired.current = true;
      cleanups.forEach((fn) => fn());
      onVisible();
    };

    if (inViewport(node, 0)) {
      trigger();
      return;
    }

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        ([entry]) => entry.isIntersecting && trigger(),
        { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
      );
      observer.observe(node);
      cleanups.push(() => observer.disconnect());
    }

    // Backstop, throttled on a timestamp rather than requestAnimationFrame: rAF does not
    // run in a background tab, so tying visibility to it would leave a page opened in an
    // unfocused tab blank until something else woke it. visibilitychange covers the case
    // where that tab is brought forward without any scrolling.
    const check = () => {
      const now = Date.now();
      if (now - lastCheck < 100) return;
      lastCheck = now;
      if (ref.current && inViewport(ref.current)) trigger();
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    document.addEventListener('visibilitychange', check);
    cleanups.push(() => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      document.removeEventListener('visibilitychange', check);
    });

    return () => cleanups.forEach((fn) => fn());
  }, [enabled, onVisible, ref]);
}

/** Fades and lifts an element into place the first time it reaches the viewport. */
export function useReveal<T extends HTMLElement = HTMLDivElement>(delay = 0) {
  const ref = React.useRef<T | null>(null);
  const [shown, setShown] = React.useState(prefersReducedMotion);

  const reveal = React.useCallback(() => {
    if (delay) window.setTimeout(() => setShown(true), delay);
    else setShown(true);
  }, [delay]);

  useOnVisible(ref as React.MutableRefObject<HTMLElement | null>, reveal, !shown);

  return {
    ref,
    className: shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
    style: {
      transition: 'opacity 600ms cubic-bezier(.16,1,.3,1), transform 600ms cubic-bezier(.16,1,.3,1)',
    } as React.CSSProperties,
  };
}

/** Counts up to `value` once visible; jumps straight to it when motion is reduced. */
export function useCountUp(value: number, duration = 1400) {
  const { ref, className, style } = useReveal<HTMLDivElement>();
  const [display, setDisplay] = React.useState(() => (prefersReducedMotion() ? value : 0));
  const done = React.useRef(prefersReducedMotion());

  const start = React.useCallback(() => {
    if (done.current) return;
    done.current = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1);
      // easeOutExpo: quick off the mark, settling gently on the final figure.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(eased * value));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // rAF is suspended in background tabs, which would strand the figure at zero. Settle on
    // the real number regardless once the animation would have finished.
    window.setTimeout(() => setDisplay(value), duration + 250);
  }, [value, duration]);

  useOnVisible(ref as React.MutableRefObject<HTMLElement | null>, start, !done.current);

  return { ref, className, style, display };
}
