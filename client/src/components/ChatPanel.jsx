import { dmPartner, formatTypers, plural } from '../lib.js';
import { Avatar, GroupAvatar } from './Avatar.jsx';
import Composer from './Composer.jsx';
import { BackIcon, CopyIcon, UsersIcon } from './Icons.jsx';
import MessageList from './MessageList.jsx';

export default function ChatPanel({
  group,
  me,
  onlineIds,
  typingNames,
  membersOpen,
  onBack,
  onToggleMembers,
  onCopyCode,
  onSend,
  onTyping,
  onReact,
  onError,
}) {
  const partner = group.type === 'dm' ? dmPartner(group, me.id) : null;
  const title = partner ? partner.name : group.name;
  const onlineCount = group.members.filter((m) => onlineIds.has(m.id)).length;

  let footer = null;
  if (partner && group.messages.length === 0) {
    footer = (
      <div className="invite-card">
        <Avatar user={partner} size={56} />
        <p className="invite-card-title">{partner.name}</p>
        <p>This is the start of your direct messages with {partner.name}.</p>
      </div>
    );
  } else if (!partner && group.members.length === 1) {
    footer = (
      <div className="invite-card">
        <p className="invite-card-title">It's just you here so far</p>
        <p>Share this invite code with your friends. They join with "Join with code".</p>
        <button className="code-big" onClick={() => onCopyCode(group.code)}>
          {group.code}
          <CopyIcon />
        </button>
      </div>
    );
  }

  return (
    <section className="chat" aria-label={title}>
      <header className="chat-header">
        <button className="icon-button back-button" aria-label="Back to chats" onClick={onBack}>
          <BackIcon />
        </button>
        {partner ? (
          <Avatar user={partner} size={40} online={onlineIds.has(partner.id)} />
        ) : (
          <GroupAvatar group={group} size={40} />
        )}
        <div className="chat-title">
          <h1>{title}</h1>
          <p>
            {partner
              ? onlineIds.has(partner.id)
                ? 'Online'
                : 'Offline'
              : `${plural(group.members.length, 'member')} · ${onlineCount} online`}
          </p>
        </div>
        {!partner && (
          <>
            <button className="code-chip" title="Copy invite code" onClick={() => onCopyCode(group.code)}>
              <CopyIcon />
              <span data-testid="invite-code">{group.code}</span>
            </button>
            <button
              className={`icon-button ${membersOpen ? 'pressed' : ''}`}
              aria-label="Members"
              aria-pressed={membersOpen}
              onClick={onToggleMembers}
            >
              <UsersIcon />
            </button>
          </>
        )}
      </header>

      <MessageList group={group} me={me} onReact={onReact} footer={footer} />

      <div className="typing" aria-live="polite">
        {typingNames.length > 0 && (
          <>
            <span className="typing-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {formatTypers(typingNames)}
          </>
        )}
      </div>

      <Composer groupName={title} onSend={onSend} onTyping={onTyping} onError={onError} />
    </section>
  );
}
