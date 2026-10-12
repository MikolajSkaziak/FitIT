import { pageIndex } from '@/features/styling/pager';

describe('pageIndex', () => {
  it('rounds to the nearest page, so a swipe that stops halfway counts for the page it is closer to', () => {
    expect(pageIndex(0, 390, 3)).toBe(0);
    expect(pageIndex(180, 390, 3)).toBe(0);
    expect(pageIndex(200, 390, 3)).toBe(1);
    expect(pageIndex(780, 390, 3)).toBe(2);
  });

  it('never leaves the pages there are, even when the scroll bounces past them', () => {
    expect(pageIndex(-40, 390, 3)).toBe(0);
    expect(pageIndex(1200, 390, 3)).toBe(2);
    expect(pageIndex(100, 0, 3)).toBe(0);
    expect(pageIndex(100, 390, 0)).toBe(0);
  });
});
