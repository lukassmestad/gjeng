import { useRef, useState } from 'react';
import { AVATAR_PRESETS, avatarSrc, BIO_MAX, COLORS, DISPLAY_NAME_MAX, PRESET_PREFIX, shrinkImage } from '../../lib.js';
import { ProfileCardView } from '../ProfileCard.jsx';

const BANNER_COLORS = ['#e8590c', '#d6336c', '#ae3ec9', '#7048e8', '#1c7ed6', '#0c8599', '#2f9e44', '#f08c00', '#495057', '#1b1d22'];

// Your picture (uploaded or built-in), display name, about me, name colour and banner, with a live preview.
export default function ProfileSettings({ me, onSave }) {
  const [displayName, setDisplayName] = useState(me.displayName ?? '');
  const [bio, setBio] = useState(me.bio ?? '');
  const [color, setColor] = useState(me.color);
  const [avatar, setAvatar] = useState(me.avatar ?? null);
  const [bannerColor, setBannerColor] = useState(me.bannerColor ?? null);
  const [bannerImage, setBannerImage] = useState(undefined); // undefined = unchanged (it isn't sent with your profile)
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { error } or { saved: true }
  const pictureRef = useRef(null);
  const bannerRef = useRef(null);

  const preview = {
    ...me,
    displayName: displayName.trim() || undefined,
    color,
    avatar: avatar ?? undefined,
    bannerColor: bannerColor ?? undefined,
  };
  const nameTooLong = Array.from(displayName.trim()).length > DISPLAY_NAME_MAX;
  const bioTooLong = Array.from(bio.trim()).length > BIO_MAX;

  async function upload(event, options, setter) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setter((await shrinkImage(file, options)).data);
      setStatus(null);
    } catch (err) {
      setStatus({ error: err.message });
    }
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      // Pictures are only sent when they changed, so saving a name doesn't upload them again.
      const changes = { displayName: displayName.trim(), color, bio: bio.trim(), bannerColor };
      if (avatar !== (me.avatar ?? null)) changes.avatar = avatar;
      if (bannerImage !== undefined) changes.bannerImage = bannerImage;
      await onSave(changes);
      setStatus({ saved: true });
    } catch (err) {
      setStatus({ error: err.message });
    }
    setBusy(false);
  }

  return (
    <form className="settings-page profile-settings" onSubmit={save}>
      <h3>My profile</h3>
      <div className="profile-settings-grid">
        <div className="settings-fields">
          <fieldset className="settings-group">
            <legend>Profile picture</legend>
            <div className="profile-picture-buttons">
              <button type="button" className="button small" onClick={() => pictureRef.current.click()}>
                Upload picture
              </button>
              {avatar && (
                <button type="button" className="button small quiet" onClick={() => setAvatar(null)}>
                  Remove picture
                </button>
              )}
            </div>
            <input
              ref={pictureRef}
              type="file"
              accept="image/*"
              hidden
              aria-label="Choose a profile picture"
              onChange={(e) => upload(e, { maxSize: 256, square: true }, setAvatar)}
            />
            <p className="hint">Or pick one of these:</p>
            <div className="preset-grid" role="radiogroup" aria-label="Built-in pictures">
              {AVATAR_PRESETS.map((preset) => {
                const value = `${PRESET_PREFIX}${preset.id}`;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={avatar === value}
                    aria-label={`Built-in picture: ${preset.id}`}
                    className={`preset ${avatar === value ? 'selected' : ''}`}
                    onClick={() => setAvatar(value)}
                  >
                    <img src={avatarSrc(value)} alt="" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={me.name}
            maxLength={DISPLAY_NAME_MAX * 2}
            autoComplete="off"
          />
          <p className={`hint ${nameTooLong ? 'form-error-text' : ''}`}>
            {nameTooLong
              ? `Display names can be at most ${DISPLAY_NAME_MAX} characters.`
              : `What people see. Spaces and emoji are fine. Your username @${me.name} stays the same.`}
          </p>

          <label htmlFor="bio">About me</label>
          <textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX * 2} />
          <p className={`hint ${bioTooLong ? 'form-error-text' : ''}`}>
            {Array.from(bio.trim()).length}/{BIO_MAX}
          </p>

          <fieldset className="color-picker">
            <legend>Name colour</legend>
            <div className="swatches">
              {COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${c === color ? 'selected' : ''}`}
                  style={{ background: c }}
                  aria-label={`Colour ${i + 1}`}
                  aria-pressed={c === color}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="color-picker">
            <legend>Banner</legend>
            <div className="swatches">
              {BANNER_COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${c === bannerColor && !bannerImage ? 'selected' : ''}`}
                  style={{ background: c }}
                  aria-label={`Banner colour ${i + 1}`}
                  aria-pressed={c === bannerColor}
                  onClick={() => {
                    setBannerColor(c);
                    setBannerImage(null);
                  }}
                />
              ))}
              <label className="swatch custom-swatch" title="Any colour">
                <input
                  type="color"
                  aria-label="Custom banner colour"
                  value={bannerColor ?? '#e8590c'}
                  onChange={(e) => {
                    setBannerColor(e.target.value);
                    setBannerImage(null);
                  }}
                />
              </label>
            </div>
            <div className="profile-picture-buttons">
              <button type="button" className="button small" onClick={() => bannerRef.current.click()}>
                Upload banner picture
              </button>
              {(bannerImage || bannerColor) && (
                <button
                  type="button"
                  className="button small quiet"
                  onClick={() => {
                    setBannerImage(null);
                    setBannerColor(null);
                  }}
                >
                  Reset banner
                </button>
              )}
            </div>
            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              hidden
              aria-label="Choose a banner picture"
              onChange={(e) => upload(e, { maxSize: 960, aspect: 3 }, setBannerImage)}
            />
          </fieldset>
        </div>

        <div className="profile-preview" aria-label="Preview">
          <p className="settings-label">Preview</p>
          <ProfileCardView user={preview} bio={bio.trim()} bannerImage={bannerImage ?? undefined} online />
          {bannerImage === undefined && !bannerColor && (
            <p className="hint">If you've uploaded a banner picture before, it shows on your real card.</p>
          )}
        </div>
      </div>

      <div className="settings-footer">
        {status?.error && (
          <p className="form-error" role="alert">
            {status.error}
          </p>
        )}
        {status?.saved && (
          <p className="saved-note" role="status">
            Saved ✓
          </p>
        )}
        <button className="button primary" disabled={busy || nameTooLong || bioTooLong}>
          Save changes
        </button>
      </div>
    </form>
  );
}
