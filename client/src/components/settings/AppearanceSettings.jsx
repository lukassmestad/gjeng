import { buildTheme } from '../../color.js';
import { resolveTheme, THEMES, usePrefs } from '../../prefs.jsx';
import ColorWheel from '../ColorWheel.jsx';

// A small picture of a theme: its background, a card, an accent button and some text.
function ThemePreview({ name }) {
  const theme = name === 'system' ? null : buildTheme(THEMES[name]).vars;
  if (!theme) {
    return (
      <span className="theme-preview system" aria-hidden="true">
        <span className="half light" />
        <span className="half dark" />
      </span>
    );
  }
  return (
    <span className="theme-preview" style={{ background: theme['--bg'], color: theme['--text'] }} aria-hidden="true">
      <span className="theme-preview-card" style={{ background: theme['--surface'], borderColor: theme['--border'] }}>
        Aa
      </span>
      <span className="theme-preview-dot" style={{ background: theme['--accent'] }} />
    </span>
  );
}

function ColorChoice({ label, description, value, fallback, onChange, note }) {
  return (
    <div className="color-choice">
      <ColorWheel label={label} value={value ?? fallback} onChange={onChange} />
      <div className="color-choice-text">
        <strong>{label}</strong>
        <span className="hint">{description}</span>
        <span className="color-choice-value">
          <span className="swatch-dot" style={{ background: value ?? fallback }} />
          {value ? value.toUpperCase() : 'From the theme'}
        </span>
        {note && <span className="adjusted-note">{note}</span>}
        {value && (
          <button type="button" className="button small quiet" onClick={() => onChange(null)}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// Themes and your own colours. Saved on this device.
export default function AppearanceSettings() {
  const { appearance, setAppearance } = usePrefs();
  const resolved = resolveTheme(appearance);
  const built = buildTheme(resolved);

  return (
    <div className="settings-page">
      <h3>Appearance</h3>
      <p className="hint settings-intro">Saved on this device.</p>

      <fieldset className="settings-group">
        <legend>Theme</legend>
        <div className="theme-grid" role="radiogroup" aria-label="Theme">
          {Object.entries(THEMES).map(([name, theme]) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={appearance.theme === name}
              className={`theme-option ${appearance.theme === name ? 'selected' : ''}`}
              onClick={() => setAppearance({ theme: name })}
            >
              <ThemePreview name={name} />
              <span>{theme.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Your own colours</legend>
        <p className="hint">
          Pick a colour on the wheel: around the edge changes the colour, towards the middle makes it softer. The theme
          keeps it light or dark, so everything stays readable.
        </p>
        <div className="color-choices">
          <ColorChoice
            label="Background"
            description="The general background colour."
            value={appearance.base}
            fallback={resolved.base}
            onChange={(base) => setAppearance({ base })}
          />
          <ColorChoice
            label="Details"
            description="Buttons, badges and highlights (orange by default)."
            value={appearance.accent}
            fallback={resolved.accent}
            onChange={(accent) => setAppearance({ accent })}
          />
          <ColorChoice
            label="Text"
            description="If it's too close to the background, it's adjusted until it's easy to read."
            value={appearance.text}
            fallback={built.vars['--text']}
            onChange={(text) => setAppearance({ text })}
            note={built.textAdjusted ? `Adjusted to ${built.vars['--text'].toUpperCase()} so it stays readable.` : null}
          />
        </div>
        {(appearance.base || appearance.accent || appearance.text) && (
          <button type="button" className="button small" onClick={() => setAppearance({ base: null, accent: null, text: null })}>
            Reset all colours
          </button>
        )}
      </fieldset>
    </div>
  );
}
