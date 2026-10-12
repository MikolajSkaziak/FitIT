import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { OutfitItem } from '@/api/outfits';
import {
  arrangedBoard,
  aspectOf,
  boardLayout,
  boardSize,
  frontOf,
  inReadingOrder,
  keptInside,
  maxScale,
  nudgeStep,
  pulled,
  resized,
  scaleStep,
  storedForm,
  type BoardItem,
  type BoardSize,
  type Placement,
  type Spot,
} from '@/features/styling/board';
import { figureBoard, halved, type Figure } from '@/features/styling/figure';
import * as haptics from '@/lib/haptics';
import { motion, radius, size, space, useTheme } from '@/theme';

import { IconButton } from './controls';
import { Fade, heldScale, staggerOf, useHeld, useIntro, useSettle } from './motion';
import { useScrollLock } from './scrollLock';

export const boardCopy = {
  arrange: 'Arrange',
  done: 'Done',
  reset: 'Reset',
  /** What a screen reader offers on a garment while the board is being arranged. */
  actions: [
    { name: 'activate', label: 'Bring to front' },
    { name: 'moveLeft', label: 'Move left' },
    { name: 'moveRight', label: 'Move right' },
    { name: 'moveUp', label: 'Move up' },
    { name: 'moveDown', label: 'Move down' },
    { name: 'increment', label: 'Make bigger' },
    { name: 'decrement', label: 'Make smaller' },
  ],
} as const;

/** A garment's picture is laid out this much larger than the automatic layout draws it and scaled down, so it stays sharp when a person enlarges it. */
const sharpness = 1.5;

/** The finger travels this far before a touch counts as a drag and not as choosing the garment. */
const dragStart = 4;

interface BoardViewProps {
  items: readonly OutfitItem[];
  /** Width of the board, which is 3:4. */
  width: number;
  /** The person's own arrangement of this outfit, if they made one. */
  layout?: readonly Placement[] | null;
  /**
   * Given, the board can be arranged by hand: it then takes the whole width of what it stands in, with its round
   * buttons in the lower corners beside it. Called with the new arrangement, or null to go back to the automatic one;
   * when keeping it takes time, the promise it answers with says when `layout` can be believed again.
   */
  onArrange?: (layout: Placement[] | null) => void | Promise<unknown>;
  /**
   * Given, the garments are laid on a figure instead of a flat lay (`figureBoard`): each where it is worn, the outer
   * layer beside it. `url` is the picture of the person's silhouette; without one the garments keep their places with
   * no body behind them. `layout` is then the arrangement of this view.
   */
  figure?: { url: string | null; shape: Figure } | null;
  testID?: string;
}

/** The board while it is being arranged: nothing of it is kept until "Done". */
interface Session {
  draft: Placement[];
  selected: string | null;
  /** Something was moved, resized or reset, so "Done" has something to keep. */
  changed: boolean;
  /** The draft is the automatic layout untouched: keeping it means keeping no arrangement at all. */
  automatic: boolean;
  /** The garments are on their way back to the automatic layout, and glide there. */
  settling: boolean;
}

/**
 * An outfit laid out on a board: the garments' cut-outs on the well, like a stylist's flat lay, none over another
 * (`boardLayout`), or wherever the person put them (`layout`). Read as one picture by screen readers, with the names
 * of the garments. With `onArrange` the garments can be dragged, pinched larger or smaller and brought to the front,
 * and a screen reader gets the same as actions on each garment.
 */
export function BoardView({ items, width, layout, onArrange, figure, testID }: BoardViewProps) {
  const theme = useTheme();
  const intro = useIntro(true);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [session, setSession] = useState<Session | null>(null);
  // What "Done" just kept, shown until the outfit itself carries it or has refused it: the garments do not jump back for a moment.
  const [held, setHeld] = useState<{ kept: Placement[] | null } | null>(null);

  const board = useMemo(() => boardSize(width), [width]);
  const ordered = useMemo(() => inReadingOrder(items), [items]);
  const pieces = useMemo<BoardItem[]>(
    () => ordered.map(({ slot, clothing }) => ({ id: clothing.id, slot, type: clothing.subcategory, aspect: aspects[clothing.id] ?? null })),
    [ordered, aspects],
  );
  const shape = figure?.shape;
  const worn = useMemo(() => (shape ? figureBoard(pieces, shape) : null), [pieces, shape]);
  const flat = useMemo(() => boardLayout(pieces, board), [pieces, board]);
  const automatic = worn?.placements ?? flat;
  const stored = held ? held.kept : layout;
  const shown = session?.draft ?? arrangedBoard(automatic, stored);
  const names = ordered.map((item) => item.clothing.name ?? 'item without details').join(', ');
  // On a figure, a layer worn over another shows as its right half.
  const halves = worn ? halved(pieces, shown) : null;

  // Where a finger has a garment right now, by its id. A garment not in here lies where `shown` says.
  const live = useSharedValue<Record<string, Spot>>({});
  const pinchFrom = useSharedValue<Spot>({ x: 0.5, y: 0.5, scale: maxScale });
  const pinching = useSharedValue(0);
  useScrollLock(session !== null);

  const placeOf = (id: string) => shown.find((placement) => placement.clothingId === id);
  const shapeOf = (id: string) => aspectOf(pieces.find((piece) => piece.id === id) ?? { id, slot: 'accessory' });

  const select = (id: string) =>
    setSession((current) => {
      if (!current) {
        return current;
      }

      const front = frontOf(current.draft.filter((placement) => placement.clothingId !== id));
      const raised = current.draft.some((placement) => placement.clothingId === id && placement.z < front);
      return {
        ...current,
        selected: id,
        settling: false,
        changed: current.changed || (raised && !current.automatic),
        draft: raised ? current.draft.map((placement) => (placement.clothingId === id ? { ...placement, z: front } : placement)) : current.draft,
      };
    });

  const change = (id: string, spot: Spot) =>
    setSession((current) =>
      current
        ? { ...current, changed: true, automatic: false, settling: false, draft: current.draft.map((placement) => (placement.clothingId === id ? { ...placement, ...spot } : placement)) }
        : current,
    );

  /** A step taken without a gesture: by a screen reader's action on the garment. */
  const act = (id: string, action: string) => {
    const place = session?.draft.find((placement) => placement.clothingId === id);
    if (!place) {
      return;
    }

    const aspect = shapeOf(id);
    const spot: Spot = { x: place.x, y: place.y, scale: place.scale };
    const next =
      action === 'moveLeft'
        ? keptInside({ ...spot, x: spot.x - nudgeStep }, aspect)
        : action === 'moveRight'
          ? keptInside({ ...spot, x: spot.x + nudgeStep }, aspect)
          : action === 'moveUp'
            ? keptInside({ ...spot, y: spot.y - nudgeStep }, aspect)
            : action === 'moveDown'
              ? keptInside({ ...spot, y: spot.y + nudgeStep }, aspect)
              : action === 'increment'
                ? resized(spot, (spot.scale + scaleStep) / spot.scale, aspect)
                : action === 'decrement'
                  ? resized(spot, (spot.scale - scaleStep) / spot.scale, aspect)
                  : null;
    live.value = {};
    select(id);
    if (next) {
      change(id, next);
    }
  };

  const begin = () => {
    haptics.arrange(true);
    live.value = {};
    setSession({ draft: shown.map((placement) => ({ ...placement })), selected: null, changed: false, automatic: !stored || stored.length === 0, settling: false });
  };

  const reset = () => {
    haptics.arrange(false);
    live.value = {};
    setSession({ draft: automatic.map((placement) => ({ ...placement })), selected: null, changed: true, automatic: true, settling: true });
  };

  const done = () => {
    if (!session) {
      return;
    }

    haptics.arrange(true);

    // Going back to the automatic layout of an outfit that never had another is nothing to keep.
    if (session.changed && !(session.automatic && (!stored || stored.length === 0))) {
      const kept = session.automatic ? null : storedForm(session.draft);
      const held = { kept };
      setHeld(held);
      const forget = () => setHeld((current) => (current === held ? null : current));
      void Promise.resolve(onArrange?.(kept)).then(forget, forget);
    }

    live.value = {};
    setSession(null);
  };

  const selected = session?.selected ?? null;
  const selectedPlace = selected ? placeOf(selected) : undefined;
  const selectedAspect = selected ? shapeOf(selected) : 1;
  // Two fingers anywhere on the board resize the chosen garment: a small one need not hold both of them.
  const pinch = Gesture.Pinch()
    .withTestId(`${testID ?? 'board'}-pinch`)
    .enabled(session !== null && selectedPlace !== undefined)
    .onStart(() => {
      if (selected && selectedPlace) {
        pinchFrom.value = live.value[selected] ?? { x: selectedPlace.x, y: selectedPlace.y, scale: selectedPlace.scale };
        pinching.value = 1;
      }
    })
    .onUpdate((event) => {
      if (selected) {
        live.value = { ...live.value, [selected]: resized(pinchFrom.value, event.scale, selectedAspect) };
      }
    })
    .onEnd(() => {
      const spot = selected ? live.value[selected] : undefined;
      if (selected && spot) {
        scheduleOnRN(change, selected, spot);
      }
    })
    .onFinalize(() => {
      pinching.value = 0;
    });

  const canvas = (
    <View
      accessible={session === null}
      accessibilityRole={session === null ? 'image' : undefined}
      accessibilityLabel={`Outfit on ${figure ? 'a figure' : 'a board'}: ${names}`}
      style={[styles.board, board, { backgroundColor: theme.well }]}
      testID={testID}>
      {figure?.url ? (
        <Image
          source={{ uri: figure.url }}
          contentFit="contain"
          transition={motion.exit}
          // The figure stands aside when a coat hangs beside it.
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: (worn?.shift ?? 0) * board.width }] }]}
          accessible={false}
          testID={`${testID ?? 'board'}-body`}
        />
      ) : null}
      {ordered.map(({ clothing }, index) => {
        const place = placeOf(clothing.id);
        const base = automatic.find((placement) => placement.clothingId === clothing.id);
        if (!place || !base) {
          return null;
        }

        return (
          <Piece
            key={clothing.id}
            id={clothing.id}
            name={clothing.name ?? 'Item without details'}
            url={clothing.imageUrl}
            cacheKey={clothing.imageKey}
            place={place}
            aspect={shapeOf(clothing.id)}
            baseScale={Math.min(maxScale, base.scale * sharpness)}
            board={board}
            enter={staggerOf(index, intro)}
            arranging={session !== null}
            selected={selected === clothing.id}
            half={halves?.has(clothing.id) ?? false}
            settling={session?.settling ?? false}
            live={live}
            pinch={pinch}
            pinching={pinching}
            onSelect={select}
            onChange={change}
            onAct={act}
            onShape={(aspect) => setAspects((current) => (current[clothing.id] === aspect ? current : { ...current, [clothing.id]: aspect }))}
            testID={`${testID ?? 'board'}-${clothing.id}`}
          />
        );
      })}
    </View>
  );

  if (!onArrange) {
    return canvas;
  }

  return (
    <View style={styles.stage}>
      <GestureDetector gesture={pinch}>{canvas}</GestureDetector>
      {session ? (
        <>
          <IconButton icon="undo" label={boardCopy.reset} onPress={reset} haptic="none" style={[styles.corner, styles.left]} testID={`${testID ?? 'board'}-reset`} />
          <IconButton icon="check" label={boardCopy.done} color="action" onPress={done} haptic="none" style={[styles.corner, styles.right]} testID={`${testID ?? 'board'}-done`} />
        </>
      ) : (
        <IconButton icon="move" label={boardCopy.arrange} onPress={begin} haptic="none" style={[styles.corner, styles.right]} testID={`${testID ?? 'board'}-arrange`} />
      )}
    </View>
  );
}

interface PieceProps {
  id: string;
  name: string;
  url: string | null;
  cacheKey: string | null;
  place: Placement;
  aspect: number;
  /** The width the picture is laid out at, as a fraction of the board's; it is scaled from there to the width it is shown at. */
  baseScale: number;
  board: BoardSize;
  enter: { enter: boolean; delay: number };
  arranging: boolean;
  selected: boolean;
  /** Only the right half of the picture shows: it is worn over another garment, which shows beside it. */
  half: boolean;
  settling: boolean;
  live: SharedValue<Record<string, Spot>>;
  pinch: GestureType;
  pinching: SharedValue<number>;
  onSelect: (id: string) => void;
  onChange: (id: string, spot: Spot) => void;
  onAct: (id: string, action: string) => void;
  onShape: (aspect: number) => void;
  testID: string;
}

/**
 * One garment on the board. It is moved and sized by transform alone, from where a finger has it (`live`) or else from
 * its place, so following a finger never waits for a render. While the board is arranged it has a touch target of its
 * own, never smaller than 44 points, which is also what a screen reader lands on.
 */
function Piece({ id, name, url, cacheKey, place, aspect, baseScale, board, enter, arranging, selected, half, settling, live, pinch, pinching, onSelect, onChange, onAct, onShape, testID }: PieceProps) {
  const theme = useTheme();
  const boardWidth = board.width;
  const boardHeight = board.height;
  const held = useHeld();
  // Plain functions of their own, handed to the JS thread from the gesture like `onSelect` is.
  const pickedUp = haptics.lift;
  const crossedEdge = haptics.edge;
  const letGo = haptics.drop;
  // Whether the finger has the garment past the board's edge: the cue is given when it first does, not all the while.
  const beyond = useSharedValue(false);
  const x = useSettle(place.x, settling);
  const y = useSettle(place.y, settling);
  const scale = useSettle(place.scale, settling);
  const dragFrom = useSharedValue<Spot>({ x: place.x, y: place.y, scale: place.scale });

  const move = useAnimatedStyle(() => {
    const spot = live.value[id];
    return {
      transform: [
        { translateX: ((spot ? spot.x : x.value) - 0.5) * boardWidth + held.pullX.value },
        { translateY: ((spot ? spot.y : y.value) - 0.5) * boardHeight + held.pullY.value },
      ],
    };
  });
  const grow = useAnimatedStyle(() => {
    const spot = live.value[id];
    return { transform: [{ scale: ((spot ? spot.scale : scale.value) / baseScale) * heldScale(held.lifted.value) }] };
  });
  // The outline is drawn at the size the garment had when it was last let go, so it steps aside while two fingers change that.
  const ring = useAnimatedStyle(() => ({ opacity: 1 - pinching.value }));

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(dragStart)
    .simultaneousWithExternalGesture(pinch)
    .withTestId(`${testID}-drag`)
    .onBegin(() => {
      dragFrom.value = live.value[id] ?? { x: x.value, y: y.value, scale: scale.value };
      beyond.value = false;
      held.hold();
      scheduleOnRN(pickedUp);
      scheduleOnRN(onSelect, id);
    })
    .onUpdate((event) => {
      const from = dragFrom.value;
      // What is kept is always inside the board; what is drawn may lean a little past the edge while the finger is down.
      const reach = pulled({ x: from.x + event.translationX / boardWidth, y: from.y + event.translationY / boardHeight, scale: from.scale }, aspect, board, held.reduced);
      live.set({ ...live.get(), [id]: reach.kept });
      held.pull(reach.over.x, reach.over.y);
      if (reach.outside !== beyond.value) {
        beyond.value = reach.outside;
        if (reach.outside) {
          scheduleOnRN(crossedEdge);
        }
      }
    })
    .onEnd(() => {
      const spot = live.value[id];
      if (spot) {
        scheduleOnRN(onChange, id, spot);
      }
    })
    .onFinalize(() => {
      held.release();
      scheduleOnRN(letGo);
    });

  const baseWidth = baseScale * boardWidth;
  const baseHeight = baseWidth / aspect;
  const shownWidth = place.scale * boardWidth;
  const shownHeight = shownWidth / aspect;
  // A halved garment is held by the half that shows; the other half belongs to what lies under it.
  const touchWidth = Math.max(size.touch, half ? shownWidth / 2 : shownWidth);
  const touchHeight = Math.max(size.touch, shownHeight);
  const touchLeft = half ? boardWidth / 2 : (boardWidth - touchWidth) / 2;
  const picture = url ? (
    <Image
      source={{ uri: url, cacheKey: cacheKey ?? undefined }}
      contentFit="contain"
      transition={motion.exit}
      style={half ? [styles.whole, { width: baseWidth }] : StyleSheet.absoluteFill}
      accessible={false}
      testID={`${testID}-picture`}
      onLoad={(event) => {
        const { width: pictureWidth, height: pictureHeight } = event.source;
        if (pictureWidth > 0 && pictureHeight > 0) {
          onShape(pictureWidth / pictureHeight);
        }
      }}
    />
  ) : null;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.anchor, board, { zIndex: place.z }, move]} testID={testID}>
      <Animated.View
        pointerEvents="none"
        style={[styles.picture, { left: (boardWidth - baseWidth) / 2, top: (boardHeight - baseHeight) / 2, width: baseWidth, height: baseHeight }, grow]}
        testID={`${testID}-frame`}>
        <Fade {...enter} style={StyleSheet.absoluteFill}>
          {half ? (
            <View style={styles.half} testID={`${testID}-half`}>
              {picture}
            </View>
          ) : (
            picture
          )}
        </Fade>
      </Animated.View>
      {arranging ? (
        <GestureDetector gesture={pan}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={name}
            accessibilityState={{ selected }}
            accessibilityActions={boardCopy.actions}
            onAccessibilityAction={(event: AccessibilityActionEvent) => onAct(id, event.nativeEvent.actionName)}
            style={[styles.touch, { left: touchLeft, top: (boardHeight - touchHeight) / 2, width: touchWidth, height: touchHeight }]}
            testID={`${testID}-handle`}>
            {selected ? (
              <Animated.View
                // Around the whole garment, also when only its right half shows and is held.
                style={[styles.ring, { width: shownWidth, height: shownHeight, borderColor: theme.action }, half ? { position: 'absolute', left: -shownWidth / 2 } : null, ring]}
                testID={`${testID}-selected`}
              />
            ) : null}
          </View>
        </GestureDetector>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // As wide as what the board stands in, so its buttons have the corners beside it.
  stage: { alignSelf: 'stretch', alignItems: 'center' },
  board: { borderRadius: radius.card, overflow: 'hidden' },
  // As large as the board and moved about whole, so the garment in its middle is placed by its centre.
  anchor: { position: 'absolute', left: 0, top: 0 },
  picture: { position: 'absolute' },
  // The right half of the garment's frame; the picture inside keeps its full width, so its left half is cut off.
  half: { position: 'absolute', left: '50%', right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  whole: { position: 'absolute', right: 0, top: 0, bottom: 0 },
  touch: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 1, borderRadius: radius.card },
  corner: { position: 'absolute', bottom: 0 },
  left: { left: space[3] },
  right: { right: space[3] },
});
