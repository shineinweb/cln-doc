export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#B8431F" />
      <path d="M8.5 23.5 17 8.5" stroke="#F7F4EE" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M23.5 23.5 15 8.5" stroke="#1A2821" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
