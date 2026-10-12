import { Wordmark } from '../components/Wordmark';
import { CONTACT_EMAIL, LEGAL_LINKS, NAV_LINKS } from '../content';

/** On sub-pages (`home={false}`) the section links point back to the home page. */
export function Footer({ home = true }: { home?: boolean }) {
  const base = home ? '' : '/';
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__top">
          <a href={home ? '#top' : '/'} aria-label={home ? 'fitit. back to top' : 'fitit. home'} className="footer__brand">
            <Wordmark size={72} />
          </a>
          <nav aria-label="Sections" className="footer__nav">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={base + l.href}>
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <hr className="rule" />
        <div className="footer__base">
          <p>© {new Date().getFullYear()} fitit.</p>
          <nav aria-label="Legal">
            <a href={LEGAL_LINKS.terms}>Terms</a>
            <a href={LEGAL_LINKS.privacy}>Privacy</a>
            <a href={CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : '#'}>Contact</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
