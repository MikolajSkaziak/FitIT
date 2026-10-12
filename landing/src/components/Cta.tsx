import { ArrowUpRight } from '@phosphor-icons/react';
import { CTA_HREF, CTA_LABEL } from '../content';

type Props = { small?: boolean; light?: boolean; href?: string; label?: string; onClick?: () => void };

/** The primary action: a capsule with a round arrow button nested at its end. */
export function Cta({ small = false, light = false, href = CTA_HREF, label = CTA_LABEL, onClick }: Props) {
  return (
    <a
      className={['cta', small ? 'cta--small' : '', light ? 'cta--light' : ''].filter(Boolean).join(' ')}
      href={href}
      onClick={onClick}
    >
      <span>{label}</span>
      <span className="cta__dot" aria-hidden="true">
        <ArrowUpRight size={small ? 16 : 20} weight="light" />
      </span>
    </a>
  );
}
