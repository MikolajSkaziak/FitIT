import { motion } from 'motion/react';
import { AppIcon } from '../components/AppIcon';
import { cutout } from '../assets';
import { PIECES, WARDROBE_GRID, type PieceId } from '../content';
import { EASE } from '../motion';
import { TabBar, WardrobeTile } from './shared';

/** The Wardrobe tab: a two-column grid of cut-outs on wells. `added` drops in as the newest piece. */
export function WardrobeScreen({ added }: { added?: PieceId }) {
  const count = WARDROBE_GRID.length + (added ? 1 : 0);

  return (
    <div className="s">
      <div className="p">
        <div className="r sb end">
          <div className="col g8">
            <div className="la">{count} pieces</div>
            <div className="dl">Wardrobe</div>
          </div>
          <div className="cb">
            <AppIcon name="filters" />
          </div>
        </div>
      </div>
      <div className="p">
        <div className="r search">
          <AppIcon name="search" />
          Search your wardrobe
        </div>
      </div>
      <div className="tabs">
        <div className="tab on">All</div>
        <div className="tab">Tops</div>
        <div className="tab">Knitwear</div>
        <div className="tab">Jackets</div>
        <div className="tab">Pants</div>
        <div className="tab">Shoes</div>
      </div>
      <div className="grid">
        {added && (
          <motion.div
            className="tile"
            initial={{ opacity: 0, y: -36, scale: 1.08 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
          >
            <div className="well" style={{ height: 212 }}>
              <div className="care">
                <AppIcon name="check" size="xs" className="gr" />
                New
              </div>
              <img src={cutout(added)} alt="" draggable={false} />
            </div>
            <div className="ti">{PIECES[added].name}</div>
            <div className="ca mu">{PIECES[added].group}</div>
          </motion.div>
        )}
        {WARDROBE_GRID.slice(0, added ? 5 : 6).map((id) => (
          <WardrobeTile key={id} id={id} />
        ))}
      </div>
      <TabBar active="wardrobe" />
    </div>
  );
}
