/** The two-tone wordmark: "fit" in ink, "it." in bottle green. */
export function Wordmark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={['wordmark', className].filter(Boolean).join(' ')} style={{ fontSize: size }}>
      fit<span>it.</span>
    </span>
  );
}

/** The hanger mark of the app icon, as a line drawing. */
export function Hanger({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 9V8a2 2 0 10-2-2M12 9l9 7.5a1 1 0 01-.6 1.8H3.6a1 1 0 01-.6-1.8z" />
    </svg>
  );
}
