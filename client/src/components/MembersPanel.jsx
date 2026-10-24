import { plural } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import { CopyIcon, XIcon } from './Icons.jsx';

export default function MembersPanel({ group, me, onlineIds, onClose, onCopyCode, onLeave }) {
  // Online people first, then alphabetical.
  const members = [...group.members].sort(
    (a, b) => onlineIds.has(b.id) - onlineIds.has(a.id) || a.name.localeCompare(b.name),
  );

  return (
    <aside className="members-panel" aria-label="Members">
      <header className="members-header">
        <h2>{plural(members.length, 'member')}</h2>
        <button className="icon-button" aria-label="Close members" onClick={onClose}>
          <XIcon />
        </button>
      </header>

      <ul className="member-list">
        {members.map((member) => {
          const online = onlineIds.has(member.id);
          return (
            <li key={member.id} className="member">
              <Avatar user={member} size={36} online={online} />
              <span className="member-name">
                {member.name}
                {member.id === me.id && <span className="you"> (you)</span>}
              </span>
              <span className={`member-status ${online ? 'online' : ''}`}>{online ? 'Online' : 'Offline'}</span>
            </li>
          );
        })}
      </ul>

      <div className="invite-box">
        <p className="invite-box-label">Invite code</p>
        <button className="code-big" onClick={() => onCopyCode(group.code)}>
          {group.code}
          <CopyIcon />
        </button>
        <p className="hint">Friends tap "Join with code" and type this in.</p>
      </div>

      <button className="button danger" onClick={onLeave}>
        Leave group
      </button>
    </aside>
  );
}
