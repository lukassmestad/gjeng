import { useEffect, useState } from 'react';
import { CopyIcon, EyeIcon, EyeOffIcon } from './Icons.jsx';

// How long a revealed code stays visible before it hides itself again.
const SHOWN_FOR_MS = 20_000;

// An invite code that stays hidden (••••••) until you ask to see it, so people next to you
// can't read it off your screen. Copying works without showing it.
export default function SecretCode({ code, onCopy, size = 'small' }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(false), SHOWN_FOR_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <span className={`secret-code ${size}`}>
      <span className="secret-value">
        {shown ? <span data-testid="invite-code">{code}</span> : <span aria-label="Hidden invite code">••••••</span>}
      </span>
      <button
        type="button"
        className="secret-button"
        aria-label={shown ? 'Hide invite code' : 'Show invite code'}
        title={shown ? 'Hide code' : 'Show code'}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </button>
      <button type="button" className="secret-button" aria-label="Copy invite code" title="Copy code" onClick={() => onCopy(code)}>
        <CopyIcon />
      </button>
    </span>
  );
}
