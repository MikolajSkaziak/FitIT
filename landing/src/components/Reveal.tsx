import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { EASE } from '../motion';

type Props = { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' };

/** Scroll entry: a fade, a short rise and a slight blur that clears. Runs once. */
export function Reveal({ children, delay = 0, className, as = 'div' }: Props) {
  const Tag = as === 'li' ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.95, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}
