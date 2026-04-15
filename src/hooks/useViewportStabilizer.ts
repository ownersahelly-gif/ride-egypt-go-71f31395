import { useEffect } from 'react';

const useViewportStabilizer = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const root = document.documentElement;
    let frame = 0;
    let resetTimeout = 0;

    const apply = () => {
      const viewport = window.visualViewport;
      const topOffset = viewport ? Math.max(0, viewport.offsetTop) : 0;
      const viewportHeight = viewport ? viewport.height : window.innerHeight;
      const keyboardInset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;

      root.style.setProperty('--vv-offset-top', `${Math.round(topOffset)}px`);
      root.style.setProperty('--vv-keyboard-inset', `${Math.round(keyboardInset)}px`);
      root.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
      root.classList.toggle('keyboard-open', keyboardInset > 0);
    };

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    };

    const resetViewport = () => {
      update();
      window.clearTimeout(resetTimeout);
      resetTimeout = window.setTimeout(() => {
        window.scrollTo(0, 0);
        apply();
      }, 120);
    };

    update();

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('focusout', resetViewport, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resetTimeout);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('focusout', resetViewport, true);
      root.style.removeProperty('--vv-offset-top');
      root.style.removeProperty('--vv-keyboard-inset');
      root.style.removeProperty('--app-height');
      root.classList.remove('keyboard-open');
    };
  }, []);
};

export default useViewportStabilizer;
