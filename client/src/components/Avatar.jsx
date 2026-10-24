import { groupColor, initials } from '../lib.js';

export function Avatar({ user, size = 36, online }) {
  return (
    <span className="avatar" style={{ '--size': `${size}px`, background: user.color }} aria-hidden="true">
      {initials(user.name)}
      {online !== undefined && <span className={`presence-dot ${online ? 'online' : ''}`} />}
    </span>
  );
}

export function GroupAvatar({ group, size = 40 }) {
  return (
    <span className="group-avatar" style={{ '--size': `${size}px`, background: groupColor(group.id) }} aria-hidden="true">
      {initials(group.name, 1)}
    </span>
  );
}
