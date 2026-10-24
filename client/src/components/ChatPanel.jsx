import { dmPartner, formatTypers, plural, presenceLabel, presenceOf, shownName } from '../lib.js';
import { Avatar, GroupAvatar } from './Avatar.jsx';
import CallStage from './CallStage.jsx';
import Composer from './Composer.jsx';
import { BackIcon, PhoneIcon, UsersIcon } from './Icons.jsx';
import MessageList from './MessageList.jsx';
import SecretCode from './SecretCode.jsx';

export default function ChatPanel({
  group,
  me,
  people,
  onlineIds,
  typingNames,
  membersOpen,
  call,
  voice,
  socketId,
  onBack,
  onToggleMembers,
  onCopyCode,
  onSend,
  onTyping,
  onReact,
  onError,
  onJoinCall,
  onLeaveCall,
  onToggleMute,
  onToggleDeafen,
}) {
  const partnerInfo = group.type === 'dm' ? dmPartner(group, me.id) : null;
  const partner = partnerInfo ? (people[partnerInfo.id] ?? partnerInfo) : null;
  const title = partner ? shownName(partner) : group.name;
  const onlineCount = group.members.filter((m) => onlineIds.has(m.id)).length;
  const inThisCall = voice.groupId === group.id;
  const callActive = Boolean(call?.participants.length);

  let footer = null;
  if (partner && group.messages.length === 0) {
    footer = (
      <div className="invite-card">
        <Avatar user={partner} size={56} />
        <p className="invite-card-title">{shownName(partner)}</p>
        <p>This is the start of your direct messages with {shownName(partner)}.</p>
      </div>
    );
  } else if (!partner && group.members.length === 1) {
    footer = (
      <div className="invite-card">
        <p className="invite-card-title">It's just you here so far</p>
        <p>Add friends from the member list, or share the invite code. It stays hidden until you show it.</p>
        <SecretCode code={group.code} onCopy={onCopyCode} size="big" />
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
              ? presenceLabel(presenceOf(partner, onlineIds.has(partner.id)))
              : `${plural(group.members.length, 'member')} · ${onlineCount} online`}
          </p>
        </div>
        {!partner && <SecretCode code={group.code} onCopy={onCopyCode} />}
        <button
          className={`icon-button ${inThisCall ? 'pressed live' : ''}`}
          aria-label={inThisCall ? 'In call' : callActive ? 'Join call' : 'Start call'}
          title={inThisCall ? "You're in this call" : callActive ? 'Join call' : 'Start a voice call'}
          disabled={inThisCall}
          onClick={onJoinCall}
        >
          <PhoneIcon />
        </button>
        {!partner && (
          <button
            className={`icon-button ${membersOpen ? 'pressed' : ''}`}
            aria-label="Members"
            aria-pressed={membersOpen}
            onClick={onToggleMembers}
          >
            <UsersIcon />
          </button>
        )}
      </header>

      {(callActive || inThisCall) && (
        <CallStage
          call={call}
          groupId={group.id}
          voice={voice}
          me={me}
          socketId={socketId}
          people={people}
          onJoin={onJoinCall}
          onLeave={onLeaveCall}
          onToggleMute={onToggleMute}
          onToggleDeafen={onToggleDeafen}
        />
      )}

      <MessageList group={group} me={me} people={people} onReact={onReact} footer={footer} />

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
