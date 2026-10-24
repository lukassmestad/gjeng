import { useRef, useState } from 'react';
import { COLORS, DISPLAY_NAME_MAX, shownName, shrinkImage } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import { LogOutIcon } from './Icons.jsx';
import Modal from './Modal.jsx';

// Change your picture, display name and colour. The username stays, since friends add you by it.
export default function ProfileModal({ me, onSave, onSignOut, onClose }) {
  const [displayName, setDisplayName] = useState(me.displayName ?? '');
  const [color, setColor] = useState(me.color);
  const [avatar, setAvatar] = useState(me.avatar ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const preview = { ...me, displayName: displayName.trim() || undefined, color, avatar: avatar ?? undefined };
  const tooLong = Array.from(displayName.trim()).length > DISPLAY_NAME_MAX;

  async function pickPicture(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { data } = await shrinkImage(file, { maxSize: 256, square: true });
      setAvatar(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Only send the picture when it changed, so saving a name doesn't upload it again.
      const changes = { displayName: displayName.trim(), color };
      if (avatar !== (me.avatar ?? null)) changes.avatar = avatar;
      await onSave(changes);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Your profile" onClose={onClose}>
      <form className="modal-form" onSubmit={save}>
        <div className="profile-top">
          <Avatar user={preview} size={88} />
          <div className="profile-top-text">
            <p className="profile-name">{shownName(preview)}</p>
            <p className="hint">@{me.name}</p>
            <div className="profile-picture-buttons">
              <button type="button" className="button small" onClick={() => fileRef.current.click()}>
                Upload picture
              </button>
              {avatar && (
                <button type="button" className="button small quiet" onClick={() => setAvatar(null)}>
                  Remove picture
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPicture} aria-label="Choose a profile picture" />
          </div>
        </div>

        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={me.name}
          maxLength={DISPLAY_NAME_MAX * 2}
          autoComplete="off"
        />
        <p className={`hint ${tooLong ? 'form-error-text' : ''}`}>
          {tooLong
            ? `Display names can be at most ${DISPLAY_NAME_MAX} characters.`
            : `What people see in chats. Spaces and emoji are fine, and it doesn't have to be unique. Your username @${me.name} stays the same.`}
        </p>

        <fieldset className="color-picker">
          <legend>Colour</legend>
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

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions spread">
          <button type="button" className="button quiet" onClick={onSignOut}>
            <LogOutIcon size={16} /> Sign out
          </button>
          <span className="modal-actions">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" disabled={busy || tooLong}>
              Save
            </button>
          </span>
        </div>
      </form>
    </Modal>
  );
}
