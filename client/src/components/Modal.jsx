import { useEffect, useId } from 'react';
import { XIcon } from './Icons.jsx';

export default function Modal({ title, onClose, children }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <XIcon />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
