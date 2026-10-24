import { useRef } from 'react';
import { hexToHsl, hslToHex } from '../color.js';

// A colour wheel: the angle picks the hue, the distance from the middle picks how strong the colour is.
// Brightness isn't picked here; the theme sets it, so contrast is always kept.
export default function ColorWheel({ value, label, size = 140, onChange }) {
  const ref = useRef(null);
  const [h, s] = value ? hexToHsl(value) : [0, 0];
  const pick = (hue, sat) => onChange(hslToHex([((hue % 360) + 360) % 360, Math.min(1, Math.max(0, sat)), 0.5]));

  function fromPointer(event) {
    const box = ref.current.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    const hue = (Math.atan2(dx, -dy) * 180) / Math.PI;
    pick(hue, Math.hypot(dx, dy) / (box.width / 2));
  }

  function pointerDown(event) {
    event.preventDefault();
    ref.current.setPointerCapture(event.pointerId);
    fromPointer(event);
  }

  function keyDown(event) {
    const step = event.shiftKey ? 15 : 5;
    const changes = {
      ArrowLeft: [h - step, s],
      ArrowRight: [h + step, s],
      ArrowUp: [h, s + 0.05],
      ArrowDown: [h, s - 0.05],
    }[event.key];
    if (!changes) return;
    event.preventDefault();
    pick(...changes);
  }

  // The marker sits at the chosen hue (angle) and strength (distance).
  const angle = (h * Math.PI) / 180;
  const radius = (s * size) / 2;
  const marker = { left: size / 2 + Math.sin(angle) * radius, top: size / 2 - Math.cos(angle) * radius };

  return (
    <div
      ref={ref}
      className="color-wheel"
      style={{ width: size, height: size }}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={value ? `Hue ${Math.round(h)} degrees, strength ${Math.round(s * 100)} percent` : 'Not set'}
      onPointerDown={pointerDown}
      onPointerMove={(e) => e.buttons === 1 && fromPointer(e)}
      onKeyDown={keyDown}
    >
      {value && <span className="color-wheel-marker" style={{ ...marker, background: value }} />}
    </div>
  );
}
