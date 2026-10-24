// A drag handle on the edge of a panel. Drag it (or focus it and use the arrow keys) to change
// the panel's width. Double-click puts it back to the default.
// `edge` is which side of the panel it's on: 'right' for the sidebar, 'left' for the member list.
export default function Resizer({ edge, value, min, max, defaultValue, label, onChange }) {
  const clamp = (width) => Math.round(Math.min(max, Math.max(min, width)));

  function startDrag(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = value;
    const move = (e) => {
      const delta = e.clientX - startX;
      onChange(clamp(startWidth + (edge === 'right' ? delta : -delta)));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.classList.remove('resizing');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    document.body.classList.add('resizing');
  }

  function keyDown(event) {
    const step = event.shiftKey ? 50 : 10;
    const wider = edge === 'right' ? 'ArrowRight' : 'ArrowLeft';
    const narrower = edge === 'right' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === wider) onChange(clamp(value + step));
    else if (event.key === narrower) onChange(clamp(value - step));
    else return;
    event.preventDefault();
  }

  return (
    <div
      className={`resizer ${edge}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      onPointerDown={startDrag}
      onKeyDown={keyDown}
      onDoubleClick={() => onChange(defaultValue)}
    />
  );
}
