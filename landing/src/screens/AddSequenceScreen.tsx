import { AnimatePresence, motion } from 'motion/react';
import { AppIcon } from '../components/AppIcon';
import { cutout, photos } from '../assets';
import { SEQUENCE_PIECE, SEQUENCE_STEPS } from '../content';
import { EASE } from '../motion';
import { WardrobeScreen } from './WardrobeScreen';

/**
 * Adding a piece, in four states: the raw photo, the cut-out on the well, the label written by AI, and the piece
 * landing in the wardrobe grid.
 */
export function AddSequenceScreen({ step }: { step: number }) {
  const current = SEQUENCE_STEPS[Math.min(step, 2)] ?? SEQUENCE_STEPS[0];

  return (
    <>
      <AnimatePresence initial={false}>
        {step < 3 ? (
          <motion.div
            key="add"
            className="layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="s">
              <div className="p">
                <div className="cb">
                  <AppIcon name="close" />
                </div>
              </div>
              <div className="p g10">
                <div className="la">Adding 1 of 1</div>
                <div className="dl">Add clothes</div>
                <div className="se r" style={{ gap: 6, minHeight: 20 }}>
                  {step > 0 && <AppIcon name="sparkle" size="sm" className="gr" />}
                  {current.status}
                </div>
              </div>
              <div className="p">
                <div className="seqshot">
                  <img className="seqshot__cut" src={cutout(SEQUENCE_PIECE.id)} alt="" draggable={false} />
                  <motion.img
                    className="seqshot__raw"
                    src={photos.raw}
                    alt=""
                    draggable={false}
                    initial={false}
                    animate={{ opacity: step === 0 ? 1 : 0 }}
                    transition={{ duration: 1.2, ease: EASE }}
                  />
                  <AnimatePresence>
                    {step === 1 && (
                      <motion.div
                        key="scan"
                        className="seqshot__scan"
                        initial={{ y: '-100%', opacity: 1 }}
                        animate={{ y: '0%', opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.3, ease: EASE }}
                      />
                    )}
                  </AnimatePresence>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={current.label}
                      className="care"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      {current.label}
                    </motion.div>
                  </AnimatePresence>
                  <AnimatePresence>
                    {step === 2 && (
                      <motion.div
                        key="tag"
                        className="tag"
                        initial={{ opacity: 0, y: 14, rotate: 0 }}
                        animate={{ opacity: 1, y: 0, rotate: -3 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
                      >
                        <div className="la">{SEQUENCE_PIECE.group}</div>
                        <div className="st" />
                        {SEQUENCE_PIECE.tagLines.map((line, i) => (
                          <motion.div
                            key={line}
                            className="ca"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: EASE, delay: 0.4 + i * 0.14 }}
                          >
                            {line}
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <AnimatePresence>
                {step === 2 && (
                  <motion.div
                    key="name"
                    className="p g6"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: EASE, delay: 0.25 }}
                  >
                    <div className="dm">{SEQUENCE_PIECE.name}</div>
                    <div className="se">{SEQUENCE_PIECE.description}</div>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                className="foot"
                initial={false}
                animate={{ opacity: step === 2 ? 1 : 0.35 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <div className="btn">Add to wardrobe</div>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="wardrobe"
            className="layer"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <WardrobeScreen added={SEQUENCE_PIECE.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
