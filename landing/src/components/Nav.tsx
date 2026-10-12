import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CTA_HREF, NAV_LINKS } from '../content';
import { EASE } from '../motion';
import { Cta } from './Cta';
import { Wordmark } from './Wordmark';

/**
 * The floating pill at the top. Below 1024px the links move into a full-screen menu behind a morphing hamburger.
 * On sub-pages (`home={false}`) every link points back to the matching section of the home page.
 */
export function Nav({ home = true }: { home?: boolean }) {
  const [open, setOpen] = useState(false);
  const base = home ? '' : '/';

  useEffect(() => {
    document.body.classList.toggle('is-locked', open);
    document.getElementById('main')?.toggleAttribute('inert', open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const close = () => setOpen(false);

  return (
    <header className="nav">
      <div className="nav__pill">
        <a href={home ? '#top' : '/'} className="nav__brand" aria-label="fitit. home" onClick={close}>
          <Wordmark size={26} />
        </a>
        <nav className="nav__links" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={base + l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav__cta">
          <Cta small href={base + CTA_HREF} onClick={close} />
        </div>
        <button
          type="button"
          className="burger"
          aria-expanded={open}
          aria-controls="menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu"
            className="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <nav aria-label="Menu">
              <ul>
                {NAV_LINKS.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.08 + i * 0.06 }}
                  >
                    <a href={base + l.href} onClick={close}>
                      <span className="label">{String(i + 1).padStart(2, '0')}</span>
                      {l.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <motion.div
              className="menu__foot"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
            >
              <Cta href={base + CTA_HREF} onClick={close} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
