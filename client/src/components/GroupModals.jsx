import { useState } from 'react';
import { INVITE_CODE_LENGTH, LIMITS } from '../lib.js';
import Modal from './Modal.jsx';

// Runs an async action and keeps track of "busy" and the error message to show.
function useSubmit(action) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(value) {
    setBusy(true);
    setError(null);
    try {
      await action(value);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return { busy, error, run };
}

export function CreateGroupModal({ onCreate, onClose }) {
  const [name, setName] = useState('');
  const { busy, error, run } = useSubmit(onCreate);

  return (
    <Modal title="New group" onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(name);
        }}
      >
        <label htmlFor="group-name">Group name</label>
        <input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.groupName}
          placeholder="e.g. Gym crew"
          autoComplete="off"
          autoFocus
        />
        <p className="hint">You'll get an invite code to share with your friends.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={!name.trim() || busy}>
            Create group
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function JoinGroupModal({ onJoin, onClose }) {
  const [code, setCode] = useState('');
  const { busy, error, run } = useSubmit(onJoin);

  return (
    <Modal title="Join a group" onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(code);
        }}
      >
        <label htmlFor="invite-code">Invite code</label>
        <input
          id="invite-code"
          className="code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={INVITE_CODE_LENGTH}
          placeholder="K7P2QX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
        />
        <p className="hint">Ask someone in the group for the {INVITE_CODE_LENGTH}-character code.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={code.length !== INVITE_CODE_LENGTH || busy}>
            Join group
          </button>
        </div>
      </form>
    </Modal>
  );
}
