import { AppIcon } from '../components/AppIcon';
import { Collage } from '../components/Collage';
import { cutout, figure } from '../assets';
import { PIECES, type Look, type PieceId } from '../content';

/** The floating tab capsule and the round add button at the bottom of the main screens. */
export function TabBar({ active }: { active: 'today' | 'wardrobe' }) {
  return (
    <div className="bar">
      <div className="tb">
        <div className={active === 'today' ? 'tbi on' : 'tbi'}>
          <AppIcon name="sun" />
          Today
        </div>
        <div className={active === 'wardrobe' ? 'tbi on' : 'tbi'}>
          <AppIcon name="hanger" />
          Wardrobe
        </div>
        <div className="tbi">
          <AppIcon name="bookmark" />
          Outfits
        </div>
        <div className="tbi">
          <AppIcon name="user" />
          Profile
        </div>
      </div>
      <div className="add">
        <AppIcon name="plus" size="lg" />
      </div>
    </div>
  );
}

/** What a look is drawn as: a dressed figure or a collage of cut-outs. */
export function LookArt({ art }: { art: Look['art'] }) {
  if (art.kind === 'figure') return <img src={figure(art.figure)} alt="" draggable={false} />;
  return <Collage pieces={art.pieces} inset={26} />;
}

export function WardrobeTile({ id, height = 212 }: { id: PieceId; height?: number }) {
  return (
    <div className="tile">
      <div className="well" style={{ height }}>
        <img src={cutout(id)} alt="" draggable={false} />
      </div>
      <div className="ti">{PIECES[id].name}</div>
      <div className="ca mu">{PIECES[id].group}</div>
    </div>
  );
}
