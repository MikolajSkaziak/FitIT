# Redesign reference for screen work

Source of truth: `docs/design/redesign/*.dc.html` + `fitit.css`. Use tokens and the components below; no hex values, no boxes, no pills, no emoji. All motion goes through `./motion`.

## Tokens (`@/theme`)
- Colours (`useTheme()`, or the `color` prop): `canvas` porcelain, `surface` white, `text` ink, `textSecondary`, `border` (the hairline), `borderControl` (field line, secondary button), `action` green, `onAction`, `sage` (well-coloured fill: active tab, avatar, search box), `onSage`, `well` (photo backdrop, light in both schemes), `wellChip`/`onWellChip` (care label), `danger`, `onDanger`, `scrim`, `skeleton`, `disabledFill`, `disabledText`, `shadow`.
- Camera chrome (over a live scene, the same in both schemes): `scene` black behind the preview, `onScene` white icons and words, `onSceneDim` a disabled one, `sceneLine` the framing hairline, `sceneScrim` the dark fill behind controls and captions (white text on it holds 4.5:1 over any scene). A round button on the scene is `<IconButton bare color="onScene" style={{ backgroundColor: theme.sceneScrim }} />`.
- `radius`: `well`/`thumb`/`card` 6, `control`/`pill`/`sheet` 28, `tag` 2. `size`: `control` 54, `controlCompact` 44, `touch` 44, `option` 56, `gutter` 20, `bar` 2, `grabber` 5. `space`: 4 8 12 16 24 32 48 64 (keys 1 2 3 4 6 8 12 16).
- `shadow`: spread it into a style and add `shadowColor: theme.shadow`. Only for things that float.

## Text (`<AppText variant color align tabular>`)
- Serif (Bodoni Moda, 26pt and up only): `display` 36/40, `heading` 26/30, `figure` 56/56, `logo`, `logoSmall`.
- Italic accent word: there is no `italic` prop. Nest the italic twin inside the upright one:
  `<AppText variant="display">Good morning,{'\n'}<AppText variant="displayItalic" color="action">Miko</AppText></AppText>` (`headingItalic` likewise).
- Figtree: `body` 17/24, `title` 17/22 semibold (= `label`, `subheading`), `secondary` 15/20, `secondaryStrong`, `caption` 13/18 medium, `meta` 13/18 regular, `metaStrong`, `micro` 11/14 medium, `eyebrow` 11/14 semibold uppercase +1.1 (secondary colour by default).

## Components
- `Screen` `{footer, scroll, aboveTabBar, contentStyle}`: frame of every screen, gutter 20. On a tab screen pass `aboveTabBar`: it pads the bottom past the floating bar.
- `TabBar` / `tabBarSpace.ts`: the bar floats over content (absolute). A tab screen with its own list pads with `useTabBarSpace() + space[4]`; `tabBarHeight` (96) is the same room without a tall system inset.
- `Button` `{label, kind: primary|secondary|text|danger|dangerText, icon, compact, inline, busy, disabled}`: capsule 54. `text` is the `.lnk` look inside a footer.
- `LinkText` `{label, color, center}` (controls): green words, 44 target, for a link outside a footer.
- `IconButton` = `CircleButton` `{icon, label, onPress, color, bare, busy, style}` (controls): round white 44 with hairline. `bare` only inside another control. Over a hero photo: `style={{ position: 'absolute', top, left: 20 }}`.
- `IconToggleButton` `{icon, label, active}`: the same disc, filled and ringed while what it opens is in use (filters).
- `Field` `{label, helper, error, invalid, leadingIcon, trailing, ...TextInput}`: underlined field. No label + `leadingIcon` = search capsule. `PasswordField`, `BirthDateField`, `Labeled` (eyebrow over any control), `FormError` in `forms`.
- `TextTabs` `{label, options, value, onChange, layout: scroll|wrap|row, tabs, testID}` and single `TextTab` `{label, selected, onPress, role, icon}`: local switching and filter values. `value` as an array = several may be chosen. `Pill` (toggles) and `Segmented` (controls) are now thin wrappers over these.
- `Row` `{label, icon, iconColor, leading, value, meta, right, onPress, strong, selected, role, accent, last}` (lists): hairline list row. `onPress` adds a chevron; `selected` gives the ink line and green check; `role="radio"` for options; `leading` takes a 56 thumbnail. Do not pass `last` unless the row closes against another line.
- `Group` `{title}`: eyebrow + its rows. `Card`: now a plain wrapper, avoid in new code. `Skeleton` `{width, height, radius}`.
- `OptionTile` `{label, selected, onPress, role, icon, swatch}` (controls): an animated hairline option row; `ChoiceGrid` (toggles) lays them in 2 or 3 columns; `GenderChoice`, `StyleChoice` in `choices`.
- `ThermalPicker` `{value, onChange, gender, shapeGender, compact}` (`features/profile`): how the person feels the temperature. A 3:4 mannequin picture (same mannequin, pose and backdrop in all three, only the layers differ: coat + knit + scarf / knit over a shirt / T-shirt; a women's set `f-*` and a men's set `m-*` in `assets/images/thermal`, `thermalPictures` in `brand`) that cross-fades to the chosen answer with a care label ("Dressed for 3° colder", "As the forecast says", "Dressed for 3° warmer"), under it a three-stop scale (snowflake, thermometer, sun; radios of 44+) with a green line that slides along the hairline (`Slide`), and one sentence of what the answer changes. The 3° is the server's `Weather:ThermalShift`: it moves the temperature the day is dressed for, not the forecast. `compact` is a 64 wide picture beside the sentence, no care label (the onboarding place step). The set follows the gender (men's for a man, women's for a woman; non-binary and "prefer not to say" follow the chosen body shape's gender, else the women's). Used by `account/thermal` and `register/place`.
- `ToggleRow` `{label, icon, meta, value, onChange, last}` (toggles): hairline row with the system switch.
- `Hairline` `{strong}`: the 1pt rule. `Eyebrow` `{children, icon, iconSize, color, header}`: eyebrow text with an icon.
- `CareLabel` `{label, icon, corner: topLeft|bottomLeft, style}`: white tag over a photo; pass it as a child of `GarmentImage`.
- `BoardView` `{items, width, layout, onArrange}`: an outfit's garments laid out flat on the well, 3:4, none over another (`features/styling/board`). With `onArrange` it takes the full width and shows the round Arrange / Done / Reset buttons in its lower corners; while arranging, `scrollLock` (`useScrollable`) holds the scroll views around it still. Without `onArrange` it only shows (the Outfits tiles: `OutfitTile`, `SavedOutfitTile`, always 3:4 so rows stay even). It replaced the old collage grid everywhere; `OutfitVisualization` has just two views, Board and Try-on (tabs only once a try-on picture exists; an outfit with one opens on it, everything else on the Board). Its optional `trailing` node sits at the right end of the row under the picture, centred with the tabs; the row is drawn for it even when there are no tabs (outfit detail puts the bookmark there). The Try-on view while a picture is made is a fitting room (`features/visualization/FittingRoom`): a closed curtain (`tryOnPictures` in `brand`) with the status and a progress line on a `sceneScrim` band, and when the picture has loaded the bar runs to 100% and the curtain draws aside once per freshly made picture; an outfit that already has its picture shows it at once. A failed order keeps the curtain shut with the notice on the band.
- `GarmentImage` `{url, cacheKey, height, inset, corner, label, children}`: a garment on its well. `GarmentTile` `{item, width, onPress}`: well 212 + title + caption. `GarmentTileSkeleton`.
- `StyleTile`, `SilhouettePicker`: photo radius 6, 2pt green outline + round check when chosen, name underneath.
- `SizeButtons` (cells on a hairline, green line under the chosen one), `SizeLabel` (the hanging tag), `SwatchPicker` / `Swatch` (36 dots, 3pt green ring).
- `BackHeader` `{title, meta, titleIcon, metaIcon, eyebrow, onBack, right}`: round back button row (eyebrow centred), serif `heading` under it.
- `TitleBlock` `{title, eyebrow, lead, accent, underlined}`: eyebrow, `display` title, lead. `compact` sets the title in `heading` for a screen led by its picture or grid. `accent` and `underlined`: see Kinetic details. `StepHeader` `{step, onBack}`: back button, 2pt progress that is never empty, and the promise of that step from `features/flow` ("Two more steps to your first look") as the eyebrow; put the `TitleBlock` (without its own eyebrow) right under it with a gap of 10.
- `ProgressBar` `{progress, label}` (controls): 2pt hairline with green fill.
- Camera (`features/camera`): never call a system camera. `const openCamera = useCamera()` then `await openCamera({ mode: 'clothes', limit, daily })` or `{ mode: 'selfie' }` opens the full-screen route `/camera` and resolves with `LocalPhoto[]` (empty when closed), the shape `pickFromGallery` returns. The route asks for the permission itself and has its own pages for refused and no camera. Motion: `Curtain` `{phase: closed|opening|open, width, left, right, breathe}` (two halves that slide apart over `motion.reveal`, the one long duration; a cross-fade under reduced motion) and `useEstimatedProgress(wait, typicalMs)` (a bar for work of unknown length: eases to `progressCeiling` 0.9 and never back, runs to 1 when `done`, holds when `stopped`), both in `./motion`. `Flash` `{count}` (a layer that blinks when the count changes, still under reduced motion) and `announce(message)` for screen readers, both in `./motion`. Icons `flash`, `flashOff`, `flashAuto`.
- `EmptyState` `{icon, title, text, action, footnote, compact}` (its icon sways once; see Kinetic details); `Brandmark` `{small}`, `GarmentMosaic` (brand).
- `Icon` `{name, size: 12|16|20|22|24|30, color}`: Phosphor regular. Names include `coffee briefcase wine barbell friends handshake ruler height snowflake thermometer filters palette camera calendar sparkle rain drop pin search clock edit lock logout trash hanger bookmark user sun check plus close back forward down`. Add new ones in `Icon.tsx` the same way (import from `phosphor-react-native/src/icons/<Name>`).

## Calendar (`features/calendar`)
Planning an outfit for a day and looking back at what was worn. Woven into Today and Outfits; there is no calendar tab.
- `WeekStrip` `{today, selected, onSelect, calendar}`: today and the next six days under the greeting of Today, a radiogroup of cells of 44+ (eyebrow "Today" or "Thu", the number in `title`, a `DayMark`). The chosen day sits on a `sage` capsule (`ToggleFade`, like the chosen tab of the bar). Choosing gives `select()`, and none for the day already chosen. The page resets to today when the tab loses focus or the app leaves the foreground.
- `MonthGrid` `{month, today, selected, onSelect, calendar, firstWeekday, refused, held}` and `MonthGridSkeleton`: a month as rows of weeks under a row of weekday initials; weeks start on `firstWeekdayOf()`. A cell is a button that says its whole date and state ("Thursday, October 15, 1 planned outfit, selected"); today has a hairline ring in `action`, the chosen day a `sage` disc. `refused(date)` gives the reason a day cannot be chosen, said after its date. `MonthHead` `{month, today, onTurn, variant}`: the serif month name, round previous/next buttons and a "Today" link on another month. A new month cross-fades in (`Fade` keyed by the month); nothing slides and there is no swipe between months, so it cannot fight the tab slide or the back gesture.
- `DayMark` `{entries}`: what a day holds, under its number: a 6pt `action` dot for planned, a 12pt check for worn (two shapes, never colour alone), "+1" for more. Marks, not board thumbnails: a cell is 47pt wide on a 375pt phone, where a board is a smudge.
- `EntryRow` `{entry, size: card|row, onOpen, onConfirm, onRemove}` (through `DayEntries`): an outfit on a day with its `BoardView`, a `CareLabel` "Planned" / "Worn", a chevron into the outfit and the quiet text actions "I wore this" and "Remove from this day". `card` (Today) has a 132 board with the label on its corner; `row` (the calendar's list) a 72 board with the label beside it.
- `CalendarView` `{openOn}`: the Calendar view of the Outfits tab (the text tabs are **Saved · Calendar**; there is no "Worn" tab). Months are asked for one range at a time (`calendarKeys.range`) and kept. The route takes `view=calendar&day=2026-10-15`.
- Sheets: `/plan` ("Wear it when?": fourteen days seven to a line, then "Pick another date" with a `MonthGrid`) and `/pick-outfit` (saved outfits for a day). Never push them by hand: `usePickDay()` and `usePickOutfit()` (`session`) open them and answer with the choice, null when closed. The caller saves.
- `usePlanning()` `{plan, choose, undo, error, planning}` and `PlanNotice` `{outfitId, today, onUndo}`: saving a plan is optimistic with rollback and the usual `FormError`; the confirmation is one quiet line in place ("Planned for Thursday." + "Undo") that goes after `noticeLingerMs`, never an alert.
- `useCalendarActions()` `{add, confirm, remove, error}`: every change shows at once and goes back when the server refuses. `useCanPlan()` is the one place to gate planning later; it answers true.
- Haptics: a day chosen `select()`; planning a primary press, then `success()` when the server has it; "I wore this" a quiet press, then `success()`; removing a plan a light press only (`haptic="secondary"`), with no confirmation and no `destroy()`: the outfit stays.
- Dates: `lib/dates` (`addDays`, `daysBetween`, `monthGrid`, `firstWeekdayOf`, `weekdayShort`, `formatSpokenDay`, ...) work on plain calendar dates, never through local `Date` arithmetic. "Today" is the day at the person's place: `todayOf(calendar)` from a calendar answer, or `usePlaceToday()` until one is there.
- `WeatherCard` takes `day` for a forecast ahead: the large figure is the day's high under an eyebrow "High", there is no "now", and the hours are named by their clock.

## fitit.css -> React Native
| CSS | Use |
| --- | --- |
| `.la` | `<AppText variant="eyebrow">` or `Eyebrow` (with icon) |
| `.dl` / `.dm` / `.dx` | variants `display` / `heading` / `figure`; `.it` = `displayItalic` / `headingItalic` |
| `.ti` / `.se` / `.ca` | variants `title` / `secondary` (+ `color="textSecondary"`) / `caption`; `.mu` = `color="textSecondary"`, `.gr` = `action`, `.dn` = `danger` |
| `.row` (`.on`) | `Row` (`selected`), or `OptionTile` for an animated choice |
| `.fld` | `Field` |
| `.tabs` / `.tab` | `TextTabs layout="scroll"` (`"row"` when it must not bleed) |
| `.tok` | `TextTabs layout="wrap"`; plain facts in a `.tok` are `secondary` text in a wrapping row with `columnGap: 22` |
| `.care` (`.bl`) | `CareLabel corner="topLeft"` (`"bottomLeft"`) |
| `.btn` / `.btn.sec` / `.btn.dan` / `.lnk` | `Button` kind `primary` / `secondary` / `danger` / `text` (`dangerText`) |
| `.cb` | `IconButton` |
| `.well` / `.hero` | `GarmentImage`, or a `View` with `backgroundColor: theme.well` and `radius.well` (hero: no radius, full bleed) |
| `.hl` | `Hairline` |
| `.prog` | `StepHeader` in a wizard, `ProgressBar` elsewhere |
| `.sz` | `SizeButtons` |
| `.dot` / `.sw` | `Swatch`, `SwatchPicker` / a `View` with `radius.well` and a hairline border |
| `.bar .tb .tbi .add` | `TabBar` (already wired in `(tabs)/_layout.tsx`) |
| `.sheet` / `.grab` / `.scrim` | `radius.sheet`, 36 x `size.grabber` in `theme.border`, `theme.scrim` |
| `.foot` | the `footer` prop of `Screen` |

## Kinetic details
Seven places where a word or an icon briefly acts out what it says (the last row is the question titles, described under the table). The rule: **once, short, meaning-bearing, never on anything used many times a day**. Each plays once (when the thing appears, or when the person's choice changes), is over within `motion.reveal`, never loops, never delays reading or touch, and under reduced motion does nothing at all (the content is simply there). Only `transform` and `opacity` move. No new haptics: items 1 and 2 ride on the `temperature()` cue of the tap. Do not add another without dropping one.

Helpers in `./motion`, all taking `play` (replays when the key changes to something truthy; default `true` = once on mount), `skipFirst` (does not play for the key it has on mount) and `delay` (milliseconds before it starts; `DropIn` and `DrawLine` always had it): `Shiver` (five 1.5pt sideways steps of half a `motion.press`), `Nudge` `{dy, dimTo}` (out and back in two `motion.exit` steps: a lift, a dip, a heat rise), `Spin` `{degrees}` (a turn over `motion.enter` for a shape that looks the same afterwards), `Sway` (a hanger on a rail: -6, +4, -2, 0 degrees around its top centre, `motion.exit` each; `soft` is the smaller swing of a title word: upright, then -3, +2, 0 over a `motion.press` and two `motion.exit`, 400ms), `DropIn` `{delay}` (from `travel.rise` above, fading in over `motion.enter`), `DrawLine` `{delay}` (`scaleX` 0 to 1 from the left edge over `motion.sheet`), `Stretch` (`scaleX` 1 to 1.06 and home around the left edge, two `motion.exit` steps), `Letters` `{text, variant, color, delay, letterStyle}` (a word as a row of one `AppText` per letter, each fading in over `motion.exit`, `letterStep(n)` after the one before: half a `motion.press`, less for a long word so the whole word is there within `motion.reveal`). A nested `Text` cannot be transformed, so where one word of a sentence moves, set the sentence with `SplitText` `{text, variant, color, role, wrap}`: a wrapping row of word-level `AppText` (one label for the whole sentence on the row, the pieces hidden from screen readers, `wrap(word, node)` puts a wrapper on one word). Each word carries its trailing space, so a line may break up to one space early compared with a plain `Text`.

| Where | Effect | When |
| --- | --- | --- |
| `ThermalPicker` sentence and care label | "colder" shivers; "warmer" lifts 2pt while dimming to 0.6 over `motion.sheet`; average nothing | the answer changes to it, never for the answer chosen on open |
| `ThermalPicker` stop icon | snowflake `Spin` 60, sun `Spin` 45, thermometer `Nudge` -2 | that stop is chosen |
| `welcome` wordmark | the final green "." `DropIn` after `motion.sheet` (wordmark is "fit", "it", "." in a row, one label "fitit.") | once per mount |
| `EmptyState` | the large icon `Sway`s | once per mount |
| `TitleBlock underlined` (`register/look` once a look is ready, `onboarding/done`) | `DrawLine` 2pt green under the last word after `motion.enter`, absolute under the word's box | once per mount, then stays |
| `WeatherCard` | sky icon: rain `Nudge` +3, sun `Spin` 45, snow `Shiver`, clouds nothing | the first forecast of a run of the app (module flag, `resetWeatherGreeting` for tests) |
| question titles (`accent`, below) | one word of the serif title in the green italic acts out what it says | once, `motion.sheet` after the screen has arrived; the thermal "cold" again with the choice |

### The accent word of a question title
`TitleBlock`, `Frame`, `WizardStep` and `EditScreen` / `PageHead` take `accent?: { word, act, replay? }` (`TitleAccent` in `headers`); a title outside them uses `AccentTitle {text, variant, accent, underlined}` (the in-app basics sheet). `word` is one whole word of the title, case-sensitive, without the punctuation after it ("dressing" for "dressing?"); when no word matches, the title is plain. The title stays ONE header whose label is the whole sentence (`SplitText`; the pieces are hidden from screen readers). The word is set in `displayItalic` / `headingItalic` (the italic twin of the title's size) in `action`, with the line height of the upright variant so the line does not grow; everything else stays still. The act waits `motion.sheet` (it plays after the push transition), lasts at most 450ms, plays once per mount (coming back to the screen is not a replay), never loops, and is nothing at all under reduced motion. Only one accent per title, no haptics. Test ids: `title-accent` is the word, `title-accent-<act>` the thing that acts (`expectAccent(act, word)` in `@/test/screen`).

| Act | Does | Helper |
| --- | --- | --- |
| `shiver` | five 1.5pt steps sideways | `Shiver` |
| `rise` | lifts 2pt while dimming to 0.6, and home | `Nudge dy=-2 dimTo=0.6` |
| `tap` | dips 2pt and returns | `Nudge dy=+2` |
| `sway` | -3, +2, 0 degrees around the word's top centre | `Sway soft` |
| `drop` | falls in from `travel.rise` above while it fades in (the word is absent until its turn) | `DropIn` |
| `stretch` | `scaleX` 1, 1.06, 1 from the left edge | `Stretch` |
| `letters` | letters fade in one after another | `Letters` |
| `none` | the green italic word at rest | |

`underlined` (first look, "You're set") also makes its last word the green italic accent, act `none`, unless `accent` names another word. `replay: { shiver?, rise? }` plays that act again when its key turns truthy, never for the key present on mount (thermal: `shiver: value === 'runs_cold'`, `rise: value === 'runs_warm'`, average nothing).

| Screen | Title | Word | Act |
| --- | --- | --- | --- |
| `register/index` (gender) | Who are we dressing? | dressing | letters |
| `register/style` | What do you like to wear? | wear | sway |
| `register/basics` | Tap what you already own | Tap | tap |
| `register/place` | Where are you? | Where | drop |
| `register/look` (ready) | Your first look is ready | ready | none, underlined |
| `onboarding/shape`, Profile `account/silhouette` | Your body shape, Body shape | shape | stretch |
| `onboarding/fit` | Your fit | fit | sway (not stretch: it follows the shape step) |
| `onboarding/colors`, Profile `account/colors` | Find your colors, Your colors | colors | letters |
| `onboarding/done` | You’re set | set | none, underlined |
| Profile `account/thermal` | How you feel the cold | cold | shiver, replays with the choice (Cold shiver, Warm rise) |
| Profile `account/legs` | Leg length | length | rise |
| `basics` sheet (in-app) | Pieces you might own | Pieces | drop |

No accent: Create account, Log in, reset, name, birth date, delete account, quiz, selfie, and the Profile screens with a `LabelHero` (gender, place, size): their serif is the current value, not a title, so there is no title to act. Consecutive sign-up steps never repeat an act.

## Haptics
`src/lib/haptics.ts` is the only file that imports `expo-haptics` (`src/lib/__tests__/hapticsContract.test.ts` holds it by grep). It gives named cues. **One cue per touch, graded by the weight of the action**: the heavier the action, the firmer the tap. Every call is fire-and-forget (not awaited, never throws, nothing on the web). There is no settings switch: the system setting governs.

Every button gives a tap through the shared components, not at call sites. `PressScale` (and so `Button`, `IconButton`, `IconToggleButton`, `LinkText`, `Row`, tiles and cards) takes `haptic?: 'auto' | 'none' | PressKind`, default `'auto'`, resolved from the kind of control. A press on a disabled or busy control gives nothing (the press never lands). Where a control already fires a semantic cue for the same touch it passes `haptic="none"`, so there is never a press cue on top of it. Cues that follow later in time (a press now, `success()` when the server confirms, `error()` on failure) are fine. The tab bar and the layouts may use `press` only (the contract test checks it); a raw `Pressable` must call `press(...)` itself.

### Press cues: `press(kind)`
| Kind | Feel | Where (`auto`) |
| --- | --- | --- |
| `primary` | impact medium | `Button kind="primary"`, the round "+" of the tab bar |
| `secondary` | impact light | `Button kind="secondary"` |
| `icon` | impact light | `IconButton` (back, close, edit, camera chrome), `IconToggleButton` (filters) |
| `quiet` | selection | `Button kind="text"`, `LinkText`, small links ("Clear all", "Skip for now", "Style it"), the camera's text buttons, a sheet's backdrop |
| `danger` | impact rigid | `Button kind="danger"` and `"dangerText"`, `Row danger`: at the press; `destroy()` still fires only when the destruction is confirmed |
| `nav` | selection | `Row` with `onPress`, the add-sheet rows, garment and outfit tiles and cards that open a detail, a tab of the bottom bar that is not the shown one; a radio or tab that is already chosen gives nothing |

### Semantic cues
| Cue | Feel | Meaning | Where |
| --- | --- | --- | --- |
| `select()` | selection | a discrete choice changed (only when the value really changes) | `OptionTile`, `TextTab` (so `TextTabs`, `Segmented`, `Pill`), `StyleTile`, `StarterTile`, `SizeButtons`, the camera's flash toggle (all pass `haptic="none"`) |
| `temperature(level)` | soft / selection / rigid | the answer to how the person feels the cold, each distinguishable in the hand: cold a soft thud, average a tick, warm a firm tap; none when the chosen stop is pressed again | `ThermalPicker` |
| `lift()` | impact light | a piece on the board is picked up | `BoardView` pan begin |
| `edge()` | impact rigid | the dragged piece first crosses the board's boundary (once per crossing) | `BoardView` pan update |
| `drop()` | impact soft | a piece on the board is let go | `BoardView` pan finalize |
| `shutter()` | impact medium | the camera took a photo | `Viewfinder` (the shutter passes `haptic="none"`) |
| `keep(on)` | light on, selection off | bookmark saved / taken off | `useOutfitActions.keep` (the bookmark passes `haptic="none"`) |
| `success()` | notification success | something meaningful completed | outfit worn (server confirmed), account created, colour result arrived, try-on curtain opening |
| `warning()` | notification warning | a limit was hit, once when it appears (`useWarning(flag)` for a screen state) | camera limit captions (day, batch, four extra photos), suggestion limit on Today, Occasion and Proposals, a limit answer to any action |
| `error()` | notification error | an action the person just took failed, once per failure | every failed mutation (`lib/queryClient`), a camera photo that did not save, the first failed photo of an upload run |
| `destroy()` | impact heavy | a destructive action confirmed | delete garment, delete outfit (in their alerts), delete account, remove a photo (that remove mark passes `haptic="none"`: it destroys at once) |
| `arrange(on)` | impact medium / light | the board's arrange mode: `true` going in and Done, `false` Reset | `BoardView` (its three round buttons pass `haptic="none"`) |

Left without a cue on purpose: background refetch failures, a garment finishing processing (too frequent in batches), the board's screen-reader actions, the system switch of `ToggleRow` (the system gives its own).

## Consent, reports and AI labels (App Store readiness)
- **Consent sheet** (`app/(app)/consent.tsx`, form sheet that fits its content; words in `features/consent/copy.ts`): eyebrow "Before your photos leave your phone", a serif title and three hairline facts (what is sent, who receives it, what happens to it), a "Privacy Policy" `LinkText` (only when the address is published), `Allow and continue` and `Not now`. `kind: 'clothes' | 'selfie'` changes the words. Never open it by hand: `const askConsent = useAiConsent()` (`features/consent/session`), then `if (!(await askConsent('clothes'))) return;` before the action that sends a photo. It answers `true` at once when the consent stands. `{ force: true }` opens the sheet although the phone believes it stands (the server just said `consent_required`). The consent is ONE flag (`aiConsentAt`) for both kinds; Profile > About has the `ToggleRow` that withdraws it, with rollback.
- **Report a problem** (`features/visualization/ReportLink`, `app/(app)/report.tsx`): a quiet `LinkText` under the try-on caption opens a small sheet of `OptionTile` reasons and `Send report`; sent, the link is replaced by "Thanks — reported." for that picture (`useReports`). `success()` once on a sent report. An `inappropriate` report deletes the picture on the server, and the screen lets go of it (`detachVisualization`, `order.forget`).
- **AI label** (`features/wardrobe/AiNote`): one caption line with the sparkle, shown only while the server says `describedByAi` (garment screen and edit screen).
- The camera's permission page before the system alert has one button and no close or "Not now" (`CameraPage` without `onClose`); after a refusal the close and the other ways out are back.
