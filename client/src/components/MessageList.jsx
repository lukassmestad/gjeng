import { useLayoutEffect, useRef, useState } from 'react';
import { formatDay, formatTime, REACTIONS } from '../lib.js';
import { Avatar } from './Avatar.jsx';

// Messages from the same person within this time are shown as one block.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

// On touch screens there's no hover, so tapping a message opens the reaction bar instead.
const isTouch = () => window.matchMedia('(hover: none)').matches;

function Message({ message, continued, meId, nameOf, picking, onPick, onReact }) {
  const reactions = Object.entries(message.reactions ?? {});
  const time = <time dateTime={new Date(message.ts).toISOString()}>{formatTime(message.ts)}</time>;

  return (
    <div
      className={`message ${continued ? 'continued' : ''} ${picking ? 'picking' : ''}`}
      onClick={(e) => !e.target.closest('button') && onPick()}
    >
      <div className="message-gutter">
        {continued ? <span className="gutter-time">{time}</span> : <Avatar user={message} size={40} />}
      </div>
      <div className="message-body">
        {!continued && (
          <div className="message-meta">
            <span className="message-author">{message.name}</span>
            {time}
          </div>
        )}
        <div className="message-text">{message.text}</div>
        {reactions.length > 0 && (
          <div className="reactions">
            {reactions.map(([emoji, userIds]) => (
              <button
                key={emoji}
                className={`reaction ${userIds.includes(meId) ? 'reacted' : ''}`}
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
      <div className="reaction-picker" role="group" aria-label="Add a reaction">
        {REACTIONS.map((emoji) => (
          <button key={emoji} aria-label={`React with ${emoji}`} onClick={() => onReact(message.id, emoji)}>
            {emoji}
          </button>
        ))}
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

  // Names for the reaction tooltips, including people who have since left the group.
  const names = Object.fromEntries(group.members.map((m) => [m.id, m.name]));
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
          continued={continued}
          meId={me.id}
          nameOf={nameOf}
          picking={pickingId === message.id}
          onPick={() => isTouch() && setPickingId((id) => (id === message.id ? null : message.id))}
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
