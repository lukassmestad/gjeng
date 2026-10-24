import { formatTypers, plural } from '../lib.js';
import { GroupAvatar } from './Avatar.jsx';
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
  const onlineCount = group.members.filter((m) => onlineIds.has(m.id)).length;
  const alone = group.members.length === 1;

  return (
    <section className="chat" aria-label={group.name}>
      <header className="chat-header">
        <button className="icon-button back-button" aria-label="Back to groups" onClick={onBack}>
          <BackIcon />
        </button>
        <GroupAvatar group={group} size={40} />
        <div className="chat-title">
          <h1>{group.name}</h1>
          <p>
            {plural(group.members.length, 'member')} · {onlineCount} online
          </p>
        </div>
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
      </header>

      <MessageList
        group={group}
        me={me}
        onReact={onReact}
        footer={
          alone && (
            <div className="invite-card">
              <p className="invite-card-title">It's just you here so far</p>
              <p>Share this invite code with your friends. They join with "Join with code".</p>
              <button className="code-big" onClick={() => onCopyCode(group.code)}>
                {group.code}
                <CopyIcon />
              </button>
            </div>
          )
        }
      />

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

      <Composer groupName={group.name} onSend={onSend} onTyping={onTyping} onError={onError} />
    </section>
  );
}
