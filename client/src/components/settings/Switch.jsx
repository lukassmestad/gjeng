// An on/off switch with a title and a short explanation. It's a real checkbox underneath,
// so keyboards and screen readers handle it like any other.
export default function Switch({ title, description, checked, onChange }) {
  return (
    <label className="switch-row">
      <span className="switch-text">
        <strong>{title}</strong>
        {description && <span className="hint">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}
