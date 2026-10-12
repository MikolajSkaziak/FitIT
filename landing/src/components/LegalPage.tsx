import { Fragment, useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { ArrowLeft } from '@phosphor-icons/react';
import { photos } from '../assets';
import type { Block, LegalDoc, ListItem } from '../legal/types';
import { Footer } from '../sections/Footer';
import { Nav } from './Nav';

/* Inline markup: **bold**, `code`, [text](url) and [TO BE COMPLETED: ...] placeholders. */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[TO BE COMPLETED:[^\]]*\]|\[[^\]]+\]\([^)]+\))/g;

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((part, i) => {
        if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
        if (part.startsWith('[TO BE COMPLETED:')) {
          return (
            <mark key={i} className="legal__ph">
              {part}
            </mark>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          return (
            <a key={i} href={link[2]}>
              {link[1]}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function Items({ items }: { items: ListItem[] }) {
  return (
    <>
      {items.map((item, i) =>
        typeof item === 'string' ? (
          <li key={i}>
            <Inline text={item} />
          </li>
        ) : (
          <li key={i}>
            <Inline text={item.text} />
            <Blocks blocks={item.blocks} />
          </li>
        ),
      )}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }): ReactNode {
  return blocks.map((b, i) => {
    switch (b.type) {
      case 'p':
        return (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        );
      case 'h3':
        return (
          <h3 key={i} className="legal__h3">
            {b.text}
          </h3>
        );
      case 'ul':
        return (
          <ul key={i} className="legal__ul">
            <Items items={b.items} />
          </ul>
        );
      case 'ol':
        return (
          <ol key={i} className="legal__ol">
            <Items items={b.items} />
          </ol>
        );
      case 'kv':
        return (
          <dl key={i} className="legal__kv">
            {b.rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  <Inline text={v} />
                </dd>
              </div>
            ))}
          </dl>
        );
      case 'table':
        return (
          <table key={i} className="legal__table">
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'entries':
        return (
          <ul key={i} className="legal__entries">
            {b.rows.map(([title, ...rest], r) => (
              <li key={r}>
                <p className="legal__entry-title">
                  <Inline text={title} />
                </p>
                <dl>
                  {rest.map((cell, c) => (
                    <div key={c}>
                      <dt>{b.head[c + 1]}</dt>
                      <dd>
                        <Inline text={cell} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        );
    }
  });
}

function BackLink() {
  return (
    <a className="link legal__back" href="/">
      <ArrowLeft size={18} weight="light" aria-hidden="true" />
      Back to fitit.
    </a>
  );
}

/** One layout for every legal document: site nav and footer around a narrow reading column. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  // Each page ships its own <title> and description; this keeps them right when a host serves the home HTML for /privacy.
  useEffect(() => {
    document.title = doc.metaTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', doc.metaDescription);
  }, [doc]);

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav home={false} />
      <main id="main" className="legal">
        <div className="wrap">
          <article className="legal__col">
            <BackLink />
            <header className="legal__head">
              <p className="label label--green">Legal</p>
              <h1 className="legal__title">{doc.title}</h1>
              {doc.draft && (
                <p className="legal__draft">
                  <strong>{doc.draft}</strong>
                  This is an English translation of a draft that has not been reviewed by a lawyer. Bracketed fields
                  are still to be filled in.
                </p>
              )}
              <dl className="legal__meta">
                <div>
                  <dt>Last updated</dt>
                  <dd>
                    {doc.lastUpdated}
                    {doc.draft ? ' (draft)' : ''}
                  </dd>
                </div>
                <div>
                  <dt>In force from</dt>
                  <dd>
                    <Inline text={doc.effective} />
                  </dd>
                </div>
              </dl>
            </header>

            {doc.intro && (
              <div className="legal__body">
                <Blocks blocks={doc.intro} />
              </div>
            )}

            <nav className="legal__toc" aria-label="Contents">
              <p className="label">Contents</p>
              <ol>
                {doc.sections.map((s) => (
                  <li key={s.n}>
                    <a href={`#s${s.n}`}>
                      {s.n}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {doc.sections.map((s) => (
              <section key={s.n} className="legal__section" aria-labelledby={`s${s.n}`}>
                <h2 id={`s${s.n}`} className="legal__h2">
                  <span className="legal__num">{s.n}.</span> {s.title}
                </h2>
                <div className="legal__body">
                  <Blocks blocks={s.blocks} />
                </div>
              </section>
            ))}

            <hr className="rule" />
            <BackLink />
          </article>
        </div>
      </main>
      <Footer home={false} />
      <div className="grain" style={{ backgroundImage: `url(${photos.grain})` }} aria-hidden="true" />
    </MotionConfig>
  );
}
