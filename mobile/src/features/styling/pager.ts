/** Which page of a horizontal pager is showing, from how far it has scrolled. Never outside the pages there are. */
export const pageIndex = (offsetX: number, pageWidth: number, count: number): number =>
  pageWidth <= 0 || count <= 0 ? 0 : Math.min(count - 1, Math.max(0, Math.round(offsetX / pageWidth)));
