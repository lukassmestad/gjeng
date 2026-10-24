import { groupColor, initials } from '../lib.js';

export function Avatar({ user, size = 36, online }) {
  return (
    <span className="avatar" style={{ '--size': `${size}px`, background: user.color }} aria-hidden="true">
      {initials(user.name)}
      {online !== undefined && <span className={`presence-dot ${online ? 'online' : ''}`} />}
    </span>
  );
}

// Like an app folder on a phone: the group's members as small pictures inside a rounded square.
// 2×2 for up to 4 people, 3×3 for more, and "+N" in the last spot if they don't all fit.
export function GroupAvatar({ group, size = 40 }) {
  const { members } = group;
  const columns = members.length <= 4 ? 2 : 3;
  const spots = columns * columns;
  const shown = members.length > spots ? members.slice(0, spots - 1) : members;
  const extra = members.length - shown.length;

  const padding = Math.round(size * 0.12);
  const gap = Math.max(2, Math.round(size * 0.06));
  const cell = (size - padding * 2 - gap * (columns - 1)) / columns;
  const showText = cell >= 14; // Letters are unreadable in the tiniest folders, so those are just colour dots.

  return (
    <span
      className="group-avatar"
      style={{
        '--size': `${size}px`,
        '--tint': groupColor(group.id),
        padding,
        gap,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {shown.map((member) => (
        <span key={member.id} className="mini-avatar" style={{ background: member.color, fontSize: cell * 0.5 }}>
          {showText && initials(member.name, 1)}
        </span>
      ))}
      {extra > 0 && (
        <span className="mini-avatar more" style={{ fontSize: cell * 0.4 }}>
          {showText && `+${extra}`}
        </span>
      )}
    </span>
  );
}
