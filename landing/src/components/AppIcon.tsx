/** The app's own line icons, with the exact paths of the approved artboards. Used inside the phone screens only. */
const PATHS = {
  rain: 'M7 15h10a4 4 0 00.6-7.96A6 6 0 006.2 8.4 3.5 3.5 0 007 15zM9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
  snow: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.500M9.500 19.500L12 17l2.500 2.500',
  drop: 'M12 3.5c3 3.5 5.5 6.5 5.5 10a5.5 5.5 0 01-11 0c0-3.5 2.5-6.5 5.5-10z',
  mug: 'M5 9h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5zM16 10h1.5a2.5 2.5 0 010 5H16M8 3v2M11.5 3v2',
  briefcase: 'M4 8h16v11H4zM9 8V6a1 1 0 011-1h4a1 1 0 011 1v2M4 13h16',
  glass: 'M8 3h8l-.5 6a3.5 3.5 0 01-7 0zM12 12.5V20M9 20h6',
  dumbbell: 'M3 12h18M6 8v8M18 8v8M3.5 10v4M20.5 10v4',
  hanger: 'M12 9V8a2 2 0 10-2-2M12 9l9 7.5a1 1 0 01-.6 1.8H3.6a1 1 0 01-.6-1.8z',
  bookmark: 'M6 4h12v17l-6-4.5L6 21z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  filters: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5',
  palette: 'M12 3a9 9 0 000 18c1.500 0 2-1 2-2s-.500-1.500-.500-2.500 1-2 2.500-2H18a3 3 0 003-3c0-4.700-4-8.500-9-8.500z',
  camera: 'M4 8h3l1.500-2h7L17 8h3v11H4zM12 16.500a3.500 3.500 0 100-7 3.500 3.500 0 000 7z',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3.5v4M15 3.5v4',
} as const;

export type AppIconName = keyof typeof PATHS;

export function AppIcon({ name, size, className }: { name: AppIconName; size?: 'xs' | 'sm' | 'lg'; className?: string }) {
  return (
    <svg className={['i', size, className].filter(Boolean).join(' ')} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
