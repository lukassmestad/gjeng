import { useState } from 'react';
import { Avatar } from './Avatar.jsx';
import Modal from './Modal.jsx';

// Lists your friends who aren't in the group yet, each with an Add button.
export default function AddMembersModal({ group, friends, onlineIds, onAdd, onClose }) {
  const [added, setAdded] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const inGroup = new Set(group.members.map((m) => m.id));
  const candidates = friends
    .filter((f) => !inGroup.has(f.id) || added.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function add(friend) {
    setBusyId(friend.id);
    setError(null);
    try {
      await onAdd(friend.id);
      setAdded((prev) => new Set(prev).add(friend.id));
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  return (
    <Modal title={`Add friends to ${group.name}`} onClose={onClose}>
      {candidates.length === 0 ? (
        <p className="hint">
          {friends.length === 0
            ? 'You have no friends to add yet. Add some on the Friends page, or share the invite code.'
            : 'All your friends are already in this group.'}
        </p>
      ) : (
        <ul className="person-list add-list">
          {candidates.map((friend) => (
            <li key={friend.id} className="person">
              <Avatar user={friend} size={36} online={onlineIds.has(friend.id)} />
              <span className="person-text">
                <span className="person-name">{friend.name}</span>
              </span>
              {added.has(friend.id) ? (
                <span className="member-note">Added ✓</span>
              ) : (
                <button
                  className="button primary small"
                  aria-label={`Add ${friend.name} to the group`}
                  disabled={busyId === friend.id}
                  onClick={() => add(friend)}
                >
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
