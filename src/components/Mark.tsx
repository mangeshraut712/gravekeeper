/** Decorative tombstone glyph. Always hidden from assistive tech. */
export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 27V13a9 9 0 0 1 18 0v14M3 27h26M12 13h8M16 9v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M11 22h10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
