import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatBytes, formatDay, formatTime, REACTIONS, shownName } from '../lib.js';
import { usePrefs } from '../prefs.jsx';
import { Avatar } from './Avatar.jsx';
import { DownloadIcon, FileIcon, PhoneIcon } from './Icons.jsx';
import ProfileLink from './ProfileLink.jsx';

// Messages from the same person within this time are shown as one block.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

// On touch screens there's no hover, so tapping a message opens the reaction bar instead.
const isTouch = () => window.matchMedia('(hover: none)').matches;

function Attachment({ attachment, onOpenImage, onLoad }) {
  if (attachment.kind === 'image') {
    const { width, height } = attachment;
    return (
      <button type="button" className="attachment-image" onClick={() => onOpenImage(attachment)} aria-label={`Open picture ${attachment.name}`}>
        <img
          src={attachment.url}
          alt={attachment.name}
          loading="lazy"
          onLoad={onLoad}
          style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
        />
      </button>
    );
  }
  return (
    <a className="attachment-file" href={attachment.url} download={attachment.name}>
      <FileIcon />
      <span className="attachment-file-text">
        <span className="attachment-file-name">{attachment.name}</span>
        <span className="hint">{formatBytes(attachment.size)}</span>
      </span>
      <DownloadIcon />
    </a>
  );
}

function Message({ message, author, mine, continued, flash, meId, nameOf, picking, onPick, onReact, onOpenImage, onMediaLoad }) {
  const reactions = Object.entries(message.reactions ?? {});
  const time = <time dateTime={new Date(message.ts).toISOString()}>{formatTime(message.ts)}</time>;

  return (
    <div
      className={`message ${mine ? 'own' : ''} ${continued ? 'continued' : ''} ${picking ? 'picking' : ''} ${flash ? 'flash' : ''}`}
      data-message-id={message.id}
      onClick={(e) => !e.target.closest('button, a') && onPick()}
    >
      <div className="message-gutter">
        {continued ? (
          <span className="gutter-time">{time}</span>
        ) : (
          <ProfileLink userId={author.id} label={shownName(author)}>
            <Avatar user={author} size={40} />
          </ProfileLink>
        )}
      </div>
      <div className="message-body">
        {!continued && (
          <div className="message-meta">
            <ProfileLink userId={author.id} className="message-author">
              {shownName(author)}
            </ProfileLink>
            {time}
          </div>
        )}
        {message.text && <div className="message-text">{message.text}</div>}
        {message.attachment && <Attachment attachment={message.attachment} onOpenImage={onOpenImage} onLoad={onMediaLoad} />}
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

// A picture shown big over everything. Click anywhere or press Escape to close.
function Lightbox({ image, onClose }) {
  useEffect(() => {
    const escape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-label={image.name} onClick={onClose}>
      <img src={image.url} alt={image.name} />
      <a className="button small" href={image.url} download={image.name} onClick={(e) => e.stopPropagation()}>
        <DownloadIcon /> Download
      </a>
    </div>
  );
}

export default function MessageList({ group, me, people, highlight, onReact, footer }) {
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const [pickingId, setPickingId] = useState(null);
  const [openImage, setOpenImage] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const { accessibility } = usePrefs();
  const { messages } = group;
  const last = messages.at(-1);

  // Sending a message always takes you to the bottom.
  useLayoutEffect(() => {
    if (last?.userId === me.id) stickToBottom.current = true;
  }, [last?.id, last?.userId, me.id]);

  // Follow new messages and reactions, unless you've scrolled up to read older ones.
  // Runs after every render, because reactions also make the list taller.
  useLayoutEffect(() => {
    followBottom();
  });

  // Jumping to a search result: scroll the message into view and light it up for a moment.
  useEffect(() => {
    if (!highlight) return;
    const element = listRef.current.querySelector(`[data-message-id="${highlight.messageId}"]`);
    if (!element) return;
    stickToBottom.current = false;
    element.scrollIntoView({ block: 'center' });
    setFlashId(highlight.messageId);
    const timer = setTimeout(() => setFlashId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlight]);

  function followBottom() {
    const list = listRef.current;
    if (stickToBottom.current) list.scrollTop = list.scrollHeight;
  }

  function onScroll() {
    const list = listRef.current;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  }

  // Current names and pictures, falling back to what was saved with the message for people who left.
  const authorOf = (m) => people[m.userId] ?? { id: m.userId, name: m.name, color: m.color };
  const nameOf = (id) => shownName(people[id] ?? messages.find((m) => m.userId === id));

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
        <div key={message.id} className={`system-message ${message.kind ?? ''}`}>
          {message.kind === 'call' && <PhoneIcon size={14} />}
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
          author={authorOf(message)}
          mine={message.userId === me.id}
          continued={continued}
          flash={flashId === message.id}
          meId={me.id}
          nameOf={nameOf}
          picking={pickingId === message.id}
          onPick={() => isTouch() && setPickingId((id) => (id === message.id ? null : message.id))}
          onReact={(messageId, emoji) => {
            setPickingId(null);
            onReact(messageId, emoji);
          }}
          onOpenImage={setOpenImage}
          onMediaLoad={followBottom}
        />,
      );
    }
    prev = message;
  }

  return (
    <>
      <div
        className="message-list"
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-label="Messages"
        aria-live={accessibility.announceMessages ? 'polite' : 'off'}
      >
        {items}
        {footer}
      </div>
      {openImage && <Lightbox image={openImage} onClose={() => setOpenImage(null)} />}
    </>
  );
}
