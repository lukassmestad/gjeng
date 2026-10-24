// Same drawing as public/favicon.svg: a speech bubble with three friends in it.
export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <rect width="64" height="64" rx="18" fill="#e8590c" />
      <rect x="12" y="15" width="40" height="28" rx="10" fill="#fff" />
      <path d="M20 41v10l10-8z" fill="#fff" />
      <circle cx="23" cy="29" r="3.5" fill="#e8590c" />
      <circle cx="32" cy="29" r="3.5" fill="#7048e8" />
      <circle cx="41" cy="29" r="3.5" fill="#0c8599" />
    </svg>
  );
}
