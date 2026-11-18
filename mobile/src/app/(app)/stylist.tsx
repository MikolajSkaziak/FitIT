import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { codeOf } from '@/api/problem';
import { askStylist, type StylistReply } from '@/api/stylist';
import { fetchClothes, noFilter, wardrobeKeys } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { BoardView } from '@/components/BoardView';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { GarmentImage } from '@/components/garments';
import { Hairline } from '@/components/Hairline';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/lists';
import { announce, Fade, PressScale, Pulse } from '@/components/motion';
import { messageFor } from '@/copy/errors';
import { occasionLabel } from '@/copy/labels';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { AnswerText } from '@/features/stylist/AnswerText';
import { starters, stylistCopy } from '@/features/stylist/copy';
import { useKeyboardLift } from '@/features/stylist/useKeyboardLift';
import { messageId, turnsOf, useStylistChat, type ChatMessage } from '@/features/stylist/useStylistChat';
import { radius, size, space, travel, typography, useTheme } from '@/theme';

const maxQuestion = 1000;

/**
 * The stylist, as a conversation: outfits for an occasion from the person's own clothes, what the wardrobe is missing and
 * what is worth buying. The stylist's words lie straight on the page like the rest of the app; the person's are set in a
 * quiet well at the right. An answer can carry an outfit on a board, the garments it talks about and pieces to buy.
 */
export default function StylistChat() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const messages = useStylistChat((state) => state.messages);
  const occasion = useStylistChat((state) => state.occasion);
  const add = useStylistChat((state) => state.add);
  const clear = useStylistChat((state) => state.clear);
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);
  const lift = useKeyboardLift();
  const clothes = useQuery({
    queryKey: wardrobeKeys.list(noFilter),
    queryFn: ({ signal }) => fetchClothes(noFilter, signal),
  });
  const pieces = (clothes.data ?? []).filter((item) => item.status === 'ready').length;

  const ask = useMutation({
    mutationFn: (conversation: ChatMessage[]) => askStylist({ messages: turnsOf(conversation), occasion }),
    onSuccess: (reply) => {
      add({ id: messageId(), role: 'stylist', text: reply.text, reply });
      announce(reply.text);
    },
  });

  const send = (text: string) => {
    const question = text.trim().slice(0, maxQuestion);
    if (!question || ask.isPending) {
      return;
    }

    const asked: ChatMessage = {
      id: messageId(),
      role: 'person',
      text: question,
    };
    add(asked);
    setDraft('');
    ask.mutate([...messages, asked]);
  };

  // A question and the wait for its answer scroll to the end. A new answer scrolls to its own first line instead, so it is
  // read from the top and not from the buttons under its outfit.
  const turns = messages.length;
  const waiting = ask.isPending;
  const answered = messages.at(-1)?.role === 'stylist';
  useEffect(() => {
    if (turns === 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (answered && !waiting) {
        list.current?.scrollToIndex({ index: turns - 1, viewPosition: 0, animated: true });
      } else {
        list.current?.scrollToEnd({ animated: true });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [turns, waiting, answered, lift]);

  const openOutfit = (reply: StylistReply) => {
    const outfit = reply.outfit;
    if (!outfit) {
      return;
    }

    useOutfitBuilder.setState({
      items: outfit.items.map((item) => item.clothing),
      note: null,
      layout: null,
      figureLayout: null,
    });
    // The builder takes the place of the chat; the conversation waits for the next time it is opened.
    router.replace('/builder');
    router.push('/builder/preview');
  };

  const last = messages.at(-1);
  const failed = ask.isError ? (codeOf(ask.error) === 'limit_reached' ? stylistCopy.limit : messageFor(ask.error)) : null;

  return (
    // The root stays a real native view: react-native-screens stretches a scroll view it finds right under a sheet over the
    // whole sheet, and the conversation would then run under the title and over its buttons.
    <View collapsable={false} style={[styles.sheet, { backgroundColor: theme.canvas }]} testID="stylist-sheet">
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="eyebrow">{stylistCopy.eyebrow}</AppText>
          <AppText variant="heading" accessibilityRole="header" accessibilityLabel={stylistCopy.title}>
            Ask your{' '}
            <AppText variant="headingItalic" color="action">
              {stylistCopy.accent}
            </AppText>
          </AppText>
        </View>
        {turns > 0 ? <IconButton icon="refresh" label={stylistCopy.newChat} onPress={() => (ask.reset(), clear())} testID="stylist-new" /> : null}
        <IconButton icon="close" label={stylistCopy.close} onPress={() => router.back()} testID="stylist-close" />
      </View>
      <Hairline />

      <View style={[styles.body, { paddingBottom: lift }]}>
        <FlatList
          ref={list}
          data={messages}
          // Answers differ in height; one not laid out yet is reached through the end of the list instead.
          onScrollToIndexFailed={() => list.current?.scrollToEnd({ animated: true })}
          keyExtractor={(message) => message.id}
          style={styles.list}
          contentContainerStyle={styles.turns}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListHeaderComponent={turns === 0 ? <Welcome pieces={pieces} onAsk={send} /> : undefined}
          renderItem={({ item }) =>
            item.role === 'person' ? (
              <Question text={item.text} />
            ) : (
              <Answer
                message={item}
                latest={item === last && !waiting}
                onAsk={send}
                onOpenOutfit={openOutfit}
                onOpenGarment={(id) => router.push({ pathname: '/clothes/[id]', params: { id } })}
              />
            )
          }
          ListFooterComponent={
            waiting ? (
              <Pulse active>
                <View style={styles.thinking} accessibilityRole="progressbar" accessibilityLabel={stylistCopy.thinking} testID="stylist-thinking">
                  <Eyebrow icon="sparkle" color="action">
                    {stylistCopy.speaker}
                  </Eyebrow>
                  <AppText color="textSecondary">{stylistCopy.thinking}</AppText>
                </View>
              </Pulse>
            ) : failed ? (
              <View style={styles.problem}>
                <AppText variant="secondary" color="danger" accessibilityRole="alert" testID="stylist-error">
                  {failed}
                </AppText>
                {codeOf(ask.error) === 'limit_reached' ? null : (
                  <Button label={stylistCopy.retry} kind="text" compact inline onPress={() => ask.mutate(messages)} testID="stylist-retry" />
                )}
              </View>
            ) : undefined
          }
        />

        <Hairline />
        {/* Over the keyboard the home indicator is hidden, so the field keeps only its own small margin. */}
        <View style={[styles.composer, { paddingBottom: lift > 0 ? space[3] : Math.max(insets.bottom, space[3]) }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={stylistCopy.placeholder}
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={maxQuestion}
            accessibilityLabel={stylistCopy.placeholder}
            // The body face without its line height: on iOS a multiline field with one stops growing and cuts the last line.
            style={[styles.field, { fontFamily: typography.body.fontFamily, fontSize: typography.body.fontSize, backgroundColor: theme.well, color: theme.text }]}
            testID="stylist-input"
          />
          <SendButton enabled={draft.trim().length > 0 && !waiting} onPress={() => send(draft)} />
        </View>
      </View>
    </View>
  );
}

/** What the empty conversation shows: what the stylist knows, the first things to ask, and what the answers are made from. */
function Welcome({ pieces, onAsk }: { pieces: number; onAsk: (text: string) => void }) {
  return (
    <View style={styles.welcome} testID="stylist-welcome">
      <AppText color="textSecondary">{stylistCopy.lead(pieces)}</AppText>
      <View>
        {starters.map((starter, index) => (
          <Fade key={starter.text} rise={travel.rise} delay={index * 40}>
            <Row
              icon={starter.icon}
              iconColor="action"
              label={starter.text}
              onPress={() => onAsk(starter.text)}
              last={index === starters.length - 1}
              testID={`stylist-starter-${index}`}
            />
          </Fade>
        ))}
      </View>
      <AppText variant="meta" color="textSecondary">
        {stylistCopy.disclosure}
      </AppText>
    </View>
  );
}

/** The person's own words: at the right, in the well, the only filled shape in the conversation. */
function Question({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Fade rise={travel.rise} style={styles.questionRow}>
      <View accessible style={[styles.question, { backgroundColor: theme.well }]} accessibilityLabel={`${stylistCopy.you}: ${text}`}>
        <AppText selectable style={styles.questionText}>
          {text}
        </AppText>
      </View>
    </Fade>
  );
}

interface AnswerProps {
  message: ChatMessage;
  /** The newest answer: only it offers the next questions to tap. */
  latest: boolean;
  onAsk: (text: string) => void;
  onOpenOutfit: (reply: StylistReply) => void;
  onOpenGarment: (id: string) => void;
}

/** The stylist's answer, straight on the page, and what came with it. */
function Answer({ message, latest, onAsk, onOpenOutfit, onOpenGarment }: AnswerProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reply = message.reply;
  const outfit = reply?.outfit;
  return (
    <Fade rise={travel.rise} style={styles.answer} testID="stylist-answer">
      <Eyebrow icon="sparkle" color="action">
        {stylistCopy.speaker}
      </Eyebrow>
      <AnswerText text={message.text} />

      {outfit && outfit.items.length > 0 ? (
        <View style={styles.block} testID="stylist-outfit">
          <View style={[styles.well, { backgroundColor: theme.well }]}>
            <BoardView items={outfit.items} width={Math.round((width - 2 * size.gutter) * 0.62)} testID="stylist-board" />
          </View>
          <View style={styles.outfitFoot}>
            <View style={styles.outfitWords}>
              <AppText variant="title">{occasionLabel(outfit.occasion)}</AppText>
              {outfit.note ? (
                <AppText variant="caption" color="textSecondary">
                  {outfit.note}
                </AppText>
              ) : null}
            </View>
            <Button
              label={stylistCopy.openOutfit}
              kind="secondary"
              icon="hanger"
              compact
              inline
              onPress={() => onOpenOutfit(reply)}
              testID="stylist-open-outfit"
            />
          </View>
        </View>
      ) : null}

      {reply && reply.mentioned.length > 0 && !outfit ? (
        <View style={styles.block} testID="stylist-mentioned">
          <Eyebrow>{stylistCopy.mentionedTitle}</Eyebrow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripRow}>
            {reply.mentioned.map((garment) => (
              <PressScale
                key={garment.id}
                accessibilityRole="button"
                accessibilityLabel={garment.name ?? 'Item without details'}
                haptic="nav"
                onPress={() => onOpenGarment(garment.id)}
                style={styles.thumb}
                testID={`stylist-garment-${garment.id}`}>
                <GarmentImage url={garment.imageUrl} cacheKey={garment.imageKey} height={104} inset={8} />
                <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                  {garment.name ?? 'Item without details'}
                </AppText>
              </PressScale>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {reply && reply.shopping.length > 0 ? (
        <View testID="stylist-shopping">
          <Eyebrow>{stylistCopy.shoppingTitle}</Eyebrow>
          {reply.shopping.map((pick, index) => (
            <Row key={pick.name} icon="plus" iconColor="action" label={pick.name} meta={pick.why} strong last={index === reply.shopping.length - 1} />
          ))}
        </View>
      ) : null}

      {latest && reply && reply.followUps.length > 0 ? (
        <View style={styles.followUps} testID="stylist-follow-ups">
          {reply.followUps.map((question) => (
            <PressScale
              key={question}
              accessibilityRole="button"
              accessibilityLabel={question}
              haptic="quiet"
              onPress={() => onAsk(question)}
              style={[styles.followUp, { borderColor: theme.borderControl }]}>
              <AppText variant="secondary">{question}</AppText>
            </PressScale>
          ))}
        </View>
      ) : null}
    </Fade>
  );
}

/** The round send button: green when there is something to send, the quiet fill of a disabled control when not. */
function SendButton({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={stylistCopy.send}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      haptic="primary"
      onPress={onPress}
      style={[styles.send, { backgroundColor: enabled ? theme.action : theme.disabledFill }]}
      testID="stylist-send">
      <Icon name="send" size={20} color={enabled ? 'onAction' : 'disabledText'} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingTop: space[6] },
  body: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: size.gutter,
    paddingBottom: space[3],
  },
  titles: { flex: 1, gap: space[1] },
  list: { flex: 1 },
  turns: {
    paddingHorizontal: size.gutter,
    paddingTop: space[4],
    paddingBottom: space[6],
    gap: space[8],
  },
  welcome: { gap: space[4] },
  questionRow: { alignItems: 'flex-end' },
  questionText: { lineHeight: 24 },
  question: {
    maxWidth: '85%',
    borderRadius: radius.card,
    borderCurve: 'continuous',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  answer: { gap: space[3] },
  block: { gap: space[3] },
  well: {
    borderRadius: radius.well,
    borderCurve: 'continuous',
    paddingVertical: space[4],
    alignItems: 'center',
  },
  outfitFoot: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  outfitWords: { flex: 1, gap: 2 },
  strip: { marginHorizontal: -size.gutter },
  stripRow: { paddingHorizontal: size.gutter, gap: space[3] },
  thumb: { width: 84, gap: space[1] },
  followUps: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  followUp: {
    minHeight: size.touch,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  thinking: { gap: space[2] },
  problem: { gap: space[1], alignItems: 'flex-start' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[2],
    paddingHorizontal: size.gutter,
    paddingTop: space[3],
  },
  field: {
    flex: 1,
    minHeight: size.touch,
    maxHeight: 132,
    borderRadius: size.touch / 2,
    borderCurve: 'continuous',
    paddingHorizontal: space[4],
    paddingTop: 10,
    paddingBottom: 10,
  },
  send: {
    width: size.touch,
    height: size.touch,
    borderRadius: size.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
