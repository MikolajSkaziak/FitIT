import { leftToday, noticeFor, fittingRoom, pictureCaption, stageOf, waitingCaption } from '@/features/visualization/copy';

describe('what the person reads about a picture', () => {
  it('counts what is left of today, with the noun agreeing with the number', () => {
    expect(leftToday({ used: 0, limit: 5 })).toBe('5 of 5 try-on pictures left today.');
    expect(leftToday({ used: 1, limit: 5 })).toBe('4 of 5 try-on pictures left today.');
    expect(leftToday({ used: 4, limit: 5 })).toBe('1 of 5 try-on pictures left today.');
    expect(leftToday({ used: 5, limit: 5 })).toBe('You’ve used today’s try-on pictures. More tomorrow.');
    // More used than the limit allows is still simply used up.
    expect(leftToday({ used: 7, limit: 5 })).toBe('You’ve used today’s try-on pictures. More tomorrow.');
  });

  it('has nothing to say while the picture is on its way, or once it is here', () => {
    expect(noticeFor('none', null)).toBeNull();
    expect(noticeFor('working', null)).toBeNull();
    expect(noticeFor('ready', null)).toBeNull();
  });

  it('words the filter refusal as an outcome, with no retry that would end the same way', () => {
    const notice = noticeFor('blocked', 'content_blocked');

    expect(notice?.title).toBe('We couldn’t make a picture of this outfit');
    expect(notice?.text).toContain('doesn’t count toward today’s limit');
    expect(notice?.text).not.toMatch(/collage/i);
    expect(notice?.action).toBeNull();
  });

  it('offers another try when the generator failed, and names the limit it gave back', () => {
    expect(noticeFor('failed', 'provider_failed')).toMatchObject({ title: 'The picture didn’t work out', action: 'Try again' });
    expect(noticeFor('failed', 'invalid_image')?.action).toBe('Try again');
    // A code the app has never seen still gets the words for a picture that did not come out.
    expect(noticeFor('failed', null)?.action).toBe('Try again');
    expect(noticeFor('failed', 'timeout')?.text).toContain('three minutes');
  });

  it('says the day is used up, and does not offer a retry that would be refused', () => {
    expect(noticeFor('refused', 'limit_reached')).toMatchObject({ title: 'You’ve used today’s try-on pictures', action: null });
  });

  it('offers the consent sheet as the way forward when the consent is missing, whichever side found out', () => {
    expect(noticeFor('refused', 'consent_required')).toMatchObject({ action: 'Review and allow', consent: true });
    expect(noticeFor('refused', 'consent_required')?.text).toContain('in Profile');
    expect(noticeFor('failed', 'consent_withdrawn')).toEqual(noticeFor('refused', 'consent_required'));
  });

  it('says pictures are paused for the day when the budget is gone, from either side', () => {
    expect(noticeFor('refused', 'visualizations_paused')).toMatchObject({ title: 'Try-on pictures are paused for today', action: null });
    expect(noticeFor('failed', 'budget_exhausted')?.action).toBeNull();
  });

  it('falls back to the shared words when the order was refused for a reason of its own', () => {
    expect(noticeFor('refused', 'network')).toMatchObject({
      title: 'We couldn’t start your picture',
      text: 'Can’t connect right now. Check your internet connection and try again.',
      action: 'Try again',
    });
  });

  const codes = ['content_blocked', 'timeout', 'provider_failed', 'budget_exhausted', 'consent_withdrawn', 'limit_reached', 'not_found', 'network'];

  it('never blames the person and never uses a dash that is not a hyphen', () => {
    const lines = [pictureCaption, waitingCaption, fittingRoom.eyebrow, ...fittingRoom.stages, fittingRoom.ready, leftToday({ used: 1, limit: 5 }), ...codes.flatMap((code) => [noticeFor('failed', code)?.title, noticeFor('failed', code)?.text])];

    for (const line of lines) {
      expect(line).toBeTruthy();
      expect(line).not.toMatch(/[—–]/);
      expect(line).not.toMatch(/\b(your fault|you failed|wrong)\b/i);
    }
  });

  it('says a different thing as the wait goes on, from the first line to the last', () => {
    expect(stageOf(0)).toBe(fittingRoom.stages[0]);
    expect(stageOf(0.5)).toBe(fittingRoom.stages[1]);
    expect(stageOf(0.9)).toBe(fittingRoom.stages[2]);
    expect(stageOf(1)).toBe(fittingRoom.stages[2]);
  });
});
