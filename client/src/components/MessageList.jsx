import { useLayoutEffect, useRef, useState } from 'react';
import { formatDay, formatTime, REACTIONS } from '../lib.js';
import { Avatar } from './Avatar.jsx';

// Messages from the same person within this time are shown as one block.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function Message({ message, mine, continued, meId, nameOf, picking, onPick, onReact }) {
  const reactions = Object.entries(message.reactions ?? {});

  return (
    <div className={`message ${mine ? 'mine' : ''} ${continued ? 'continued' : ''} ${picking ? 'picking' : ''}`}>
      {!mine && <div className="message-avatar">{!continued && <Avatar user={message} size={34} />}</div>}
      <div className="message-body">
        {!continued && (
          <div className="message-meta">
            {!mine && <span className="message-author">{message.name}</span>}
            <time dateTime={new Date(message.ts).toISOString()}>{formatTime(message.ts)}</time>
          </div>
        )}
        <div className="bubble-row">
          <div className="bubble" onClick={onPick}>
            {message.text}
          </div>
          <div className="reaction-picker" role="group" aria-label="Add a reaction">
            {REACTIONS.map((emoji) => (
              <button key={emoji} aria-label={`React with ${emoji}`} onClick={() => onReact(message.id, emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
        {reactions.length > 0 && (
          <div className="reactions">
            {reactions.map(([emoji, userIds]) => (
              <button
                key={emoji}
                className={`reaction ${userIds.includes(meId) ? 'mine' : ''}`}
                title={userIds.map(nameOf).join(', ')}
                aria-label={`${emoji} ${userIds.length}, by ${userIds.map(nameOf).join(', ')}`}
                onClick={() => onReact(message.id, emoji)}
              >
                {emoji} <span>{userIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessageList({ group, me, onReact, footer }) {
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const [pickingId, setPickingId] = useState(null);
  const { messages } = group;
  const last = messages.at(-1);

  // Sending a message always takes you to the bottom.
  useLayoutEffect(() => {
    if (last?.userId === me.id) stickToBottom.current = true;
  }, [last?.id, last?.userId, me.id]);

  // Follow new messages and reactions, unless you've scrolled up to read older ones.
  // Runs after every render, because reactions also make the list taller.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (stickToBottom.current) list.scrollTop = list.scrollHeight;
  });

  function onScroll() {
    const list = listRef.current;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  }

  const names = Object.fromEntries(group.members.map((m) => [m.id, m.id === me.id ? 'You' : m.name]));
  for (const m of messages) if (m.type === 'user' && !names[m.userId]) names[m.userId] = m.name;
  const nameOf = (id) => names[id] ?? 'Someone';

  const items = [];
  let prev = null;
  for (const message of messages) {
    const day = formatDay(message.ts);
    const newDay = !prev || formatDay(prev.ts) !== day;
    if (newDay) {
      items.push(
        <div key={`day-${message.id}`} className="day-divider">
          <span>{day}</span>
        </div>,
      );
    }

    if (message.type === 'system') {
      items.push(
        <div key={message.id} className="system-message">
          {message.text}
        </div>,
      );
    } else {
      const continued =
        !newDay && prev?.type === 'user' && prev.userId === message.userId && message.ts - prev.ts < GROUP_WINDOW_MS;
      items.push(
        <Message
          key={message.id}
          message={message}
          mine={message.userId === me.id}
          continued={continued}
          meId={me.id}
          nameOf={nameOf}
          picking={pickingId === message.id}
          onPick={() => setPickingId((id) => (id === message.id ? null : message.id))}
          onReact={(messageId, emoji) => {
            setPickingId(null);
            onReact(messageId, emoji);
          }}
        />,
      );
    }
    prev = message;
  }

  return (
    <div className="message-list" ref={listRef} onScroll={onScroll} role="log" aria-label="Messages">
      {items}
      {footer}
    </div>
  );
}
