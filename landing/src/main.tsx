import { StrictMode, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '@fontsource/bodoni-moda/500.css';
import '@fontsource/bodoni-moda/500-italic.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import './styles/base.css';
import './styles/app.css';
import './styles/sections.css';
import './styles/legal.css';
import { App } from './App';
import { LegalPage } from './components/LegalPage';
import type { LegalDoc } from './legal/types';

/**
 * Sub-pages. Each has its own HTML file (see vite.config.ts), so this switch only picks what to render.
 * The home page renders synchronously, so `/#section` links still land on their section; the legal texts load as a small chunk.
 */
const LEGAL_DOCS: Record<string, () => Promise<LegalDoc>> = {
  '/privacy': () => import('./legal/privacy').then((m) => m.privacy),
  '/terms': () => import('./legal/terms').then((m) => m.terms),
};

/** Links from the sub-pages arrive as `/#section`; the page is rendered by script, so scroll to the hash once it is committed. */
function scrollToHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
}

const root = document.getElementById('root');
if (root) {
  const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
  const loadDoc = LEGAL_DOCS[path];
  const render = (page: ReactNode) =>
    flushSync(() => createRoot(root).render(<StrictMode>{page}</StrictMode>));
  if (loadDoc) {
    void loadDoc().then((doc) => {
      render(<LegalPage doc={doc} />);
      scrollToHash();
    });
  } else {
    render(<App />);
    scrollToHash();
  }
}
