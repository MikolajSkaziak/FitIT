import { motion } from 'motion/react';
import { cutout } from '../assets';
import { PIECES, type PieceId, type PieceRole } from '../content';
import { EASE } from '../motion';

type Slot = { left: number; top: number; width: number; z: number };

/** Where each kind of piece sits, in percent of the box. One layout with an outer layer, one without. */
const LAYERED: Record<PieceRole, Slot> = {
  layer: { left: 5, top: 8, width: 47, z: 1 },
  top: { left: 44, top: 12, width: 38, z: 2 },
  bottom: { left: 63, top: 42, width: 23, z: 3 },
  shoes: { left: 17, top: 73, width: 33, z: 4 },
};

const PLAIN: Record<PieceRole, Slot> = {
  layer: { left: 9, top: 10, width: 52, z: 1 },
  top: { left: 9, top: 10, width: 52, z: 1 },
  bottom: { left: 60, top: 28, width: 27, z: 2 },
  shoes: { left: 16, top: 63, width: 37, z: 3 },
};

/** Cut-outs laid side by side, the way the app shows an outfit as a collage. */
export function Collage({ pieces, inset = 0 }: { pieces: PieceId[]; inset?: number }) {
  const layered = pieces.some((id) => PIECES[id].role === 'layer') && pieces.length > 3;
  const slots = layered ? LAYERED : PLAIN;

  return (
    <div className="collage" style={{ top: inset }}>
      {pieces.map((id, i) => {
        const piece = PIECES[id];
        const slot = slots[piece.role];
        return (
          <motion.div
            key={id}
            className="collage__piece"
            style={{ left: `${slot.left}%`, top: `${slot.top}%`, width: `${slot.width * (piece.wide ? 1.25 : 1)}%`, zIndex: slot.z }}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.08 * i }}
          >
            <img src={cutout(id)} alt="" draggable={false} />
          </motion.div>
        );
      })}
    </div>
  );
}
