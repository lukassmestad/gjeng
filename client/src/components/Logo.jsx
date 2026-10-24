// Same drawing as public/favicon.svg: a speech bubble with three friends in it.
// The square (and the first friend) follow the theme's details colour; the bubble turns dark
// if that colour is too light for a white bubble to show. Colours come from --logo* in the theme.
export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <rect width="64" height="64" rx="18" style={{ fill: 'var(--logo, #e8590c)', stroke: 'var(--logo-edge, none)', strokeWidth: 2 }} />
      <rect x="12" y="15" width="40" height="28" rx="10" style={{ fill: 'var(--logo-bubble, #fff)' }} />
      <path d="M20 41v10l10-8z" style={{ fill: 'var(--logo-bubble, #fff)' }} />
      <circle cx="23" cy="29" r="3.5" style={{ fill: 'var(--logo-dot, #e8590c)' }} />
      <circle cx="32" cy="29" r="3.5" fill="#7048e8" />
      <circle cx="41" cy="29" r="3.5" fill="#0c8599" />
    </svg>
  );
}

// The same logo as an SVG file, for the browser tab icon.
export function logoSvg({ logo, bubble, dot, edge }) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    `<rect width="64" height="64" rx="18" fill="${logo}"${edge ? ` stroke="${edge}" stroke-width="2"` : ''}/>` +
    `<rect x="12" y="15" width="40" height="28" rx="10" fill="${bubble}"/>` +
    `<path d="M20 41v10l10-8z" fill="${bubble}"/>` +
    `<circle cx="23" cy="29" r="3.5" fill="${dot}"/>` +
    '<circle cx="32" cy="29" r="3.5" fill="#7048e8"/>' +
    '<circle cx="41" cy="29" r="3.5" fill="#0c8599"/></svg>'
  );
}
