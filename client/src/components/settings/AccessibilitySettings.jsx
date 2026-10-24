import { DEFAULT_ACCESSIBILITY, usePrefs } from '../../prefs.jsx';
import Switch from './Switch.jsx';

const MOTION = {
  system: 'Match my device',
  on: 'Reduce motion',
  off: 'Allow motion',
};

// Text size, motion, contrast and screen reader options. Saved on this device.
export default function AccessibilitySettings() {
  const { accessibility: a, appearance, setAccessibility, setAppearance, turnOnAccessibilityMode } = usePrefs();
  const percent = Math.round(a.textScale * 100);

  return (
    <div className="settings-page">
      <h3>Accessibility</h3>
      <p className="hint settings-intro">Saved on this device.</p>

      <div className="accessibility-mode">
        <div>
          <strong>Accessibility mode</strong>
          <span className="hint">
            Turns on everything below at once: bigger text, the high-contrast theme, less motion, status symbols, clear
            focus outlines and easier-to-read text.
          </span>
        </div>
        <div className="accessibility-mode-buttons">
          <button type="button" className="button primary" onClick={turnOnAccessibilityMode}>
            Turn on
          </button>
          <button type="button" className="button quiet" onClick={() => setAccessibility(DEFAULT_ACCESSIBILITY)}>
            Reset
          </button>
        </div>
      </div>

      <fieldset className="settings-group">
        <legend>Text size</legend>
        <div className="text-size">
          <span aria-hidden="true" className="text-size-small">
            A
          </span>
          <input
            type="range"
            min="0.9"
            max="1.5"
            step="0.05"
            value={a.textScale}
            aria-label="Text size"
            aria-valuetext={`${percent} percent`}
            onChange={(e) => setAccessibility({ textScale: Number(e.target.value) })}
          />
          <span aria-hidden="true" className="text-size-big">
            A
          </span>
          <output className="text-size-value">{percent}%</output>
        </div>
        <p className="text-size-sample">This is how messages will look.</p>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Contrast</legend>
        <Switch
          title="High-contrast theme"
          description="Black background, white text and bright yellow details, with strong borders."
          checked={appearance.theme === 'high-contrast'}
          onChange={(on) => setAppearance({ theme: on ? 'high-contrast' : 'system' })}
        />
        <Switch
          title="Show status with symbols"
          description="Away gets a moon, do not disturb a line and offline a ring, so you don't have to tell colours apart."
          checked={a.statusSymbols}
          onChange={(statusSymbols) => setAccessibility({ statusSymbols })}
        />
        <Switch
          title="Stronger focus outlines"
          description="A thick, clear outline around whatever the keyboard is on."
          checked={a.strongFocus}
          onChange={(strongFocus) => setAccessibility({ strongFocus })}
        />
      </fieldset>

      <fieldset className="settings-group">
        <legend>Reading</legend>
        <Switch
          title="Easier-to-read text"
          description="A wider font with more space between letters, words and lines."
          checked={a.readableText}
          onChange={(readableText) => setAccessibility({ readableText })}
        />
        <Switch
          title="Always show message times"
          description="Show the time on every message, not only when you point at it."
          checked={a.alwaysShowTimes}
          onChange={(alwaysShowTimes) => setAccessibility({ alwaysShowTimes })}
        />
      </fieldset>

      <fieldset className="settings-group">
        <legend>Motion</legend>
        <div className="choice-row">
          {Object.entries(MOTION).map(([value, label]) => (
            <label key={value} className={`choice compact ${a.reduceMotion === value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="motion"
                checked={a.reduceMotion === value}
                onChange={() => setAccessibility({ reduceMotion: value })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Screen readers</legend>
        <Switch
          title="Read out new messages"
          description="Screen readers announce new messages in the chat you have open."
          checked={a.announceMessages}
          onChange={(announceMessages) => setAccessibility({ announceMessages })}
        />
        <p className="hint">
          Everything in Gjeng has labels for screen readers, and every button can be reached with the keyboard (Tab and
          Enter). The side panels can be resized with the arrow keys too.
        </p>
      </fieldset>
    </div>
  );
}
