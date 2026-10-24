import { plural } from '../lib.js';
import { Avatar, GroupAvatar } from './Avatar.jsx';
import { CopyIcon, PlusIcon, XIcon } from './Icons.jsx';

// The button next to someone depends on how you know them.
function FriendAction({ member, relation, onAddFriend, onRespond, onMessage }) {
  if (relation === 'friend') {
    return (
      <button className="button small" aria-label={`Message ${member.name}`} onClick={() => onMessage(member.id)}>
        Message
      </button>
    );
  }
  if (relation === 'outgoing') return <span className="member-note">Request sent</span>;
  if (relation === 'incoming') {
    return (
      <button className="button primary small" aria-label={`Accept ${member.name}`} onClick={() => onRespond(member.id, true)}>
        Accept
      </button>
    );
  }
  return (
    <button className="button small" aria-label={`Add ${member.name} as friend`} onClick={() => onAddFriend(member.id)}>
      Add friend
    </button>
  );
}

// Member list on the right, like Discord: who's online first, then who's offline.
export default function MembersPanel({
  group,
  me,
  friends,
  onlineIds,
  onClose,
  onCopyCode,
  onLeave,
  onAddFriend,
  onRespond,
  onMessage,
  onAddMembers,
}) {
  const sorted = [...group.members].sort((a, b) => a.name.localeCompare(b.name));
  const online = sorted.filter((m) => onlineIds.has(m.id));
  const offline = sorted.filter((m) => !onlineIds.has(m.id));

  const ids = (list) => new Set(list.map((u) => u.id));
  const friendIds = ids(friends.friends);
  const incomingIds = ids(friends.incoming);
  const outgoingIds = ids(friends.outgoing);
  const relation = (id) =>
    friendIds.has(id) ? 'friend' : incomingIds.has(id) ? 'incoming' : outgoingIds.has(id) ? 'outgoing' : null;

  const row = (member) => {
    const isOnline = onlineIds.has(member.id);
    return (
      <li key={member.id} className={`member ${isOnline ? '' : 'offline'}`}>
        <Avatar user={member} size={34} online={isOnline} />
        <span className="member-name">
          {member.name}
          {member.id === me.id && <span className="you"> (you)</span>}
        </span>
        {member.id !== me.id && (
          <FriendAction
            member={member}
            relation={relation(member.id)}
            onAddFriend={onAddFriend}
            onRespond={onRespond}
            onMessage={onMessage}
          />
        )}
      </li>
    );
  };

  return (
    <aside className="members-panel" aria-label="Members">
      <header className="members-header">
        <h2>Members</h2>
        <button className="icon-button" aria-label="Close members" onClick={onClose}>
          <XIcon />
        </button>
      </header>

      <div className="members-hero">
        <GroupAvatar group={group} size={80} />
        <p className="members-hero-name">{group.name}</p>
        <p className="hint">{plural(group.members.length, 'member')}</p>
        <button className="button primary small" onClick={onAddMembers}>
          <PlusIcon /> Add friends
        </button>
      </div>

      {online.length > 0 && (
        <section aria-label="Online members">
          <h3 className="section-title">Online — {online.length}</h3>
          <ul className="member-list">{online.map(row)}</ul>
        </section>
      )}
      {offline.length > 0 && (
        <section aria-label="Offline members">
          <h3 className="section-title">Offline — {offline.length}</h3>
          <ul className="member-list">{offline.map(row)}</ul>
        </section>
      )}

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
