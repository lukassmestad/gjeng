import { useMemo, useState } from 'react';
import { dmPartner, formatDay, formatTime, shownName } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import { XIcon } from './Icons.jsx';

const KINDS = { all: 'Everything', text: 'Text', images: 'Pictures and GIFs', files: 'Files', links: 'Links' };
const LINK = /https?:\/\/\S+/i;
const MAX_RESULTS = 200;

function matchesKind(message, kind) {
  switch (kind) {
    case 'text':
      return Boolean(message.text);
    case 'images':
      return message.attachment?.kind === 'image';
    case 'files':
      return message.attachment?.kind === 'file';
    case 'links':
      return LINK.test(message.text);
    default:
      return true;
  }
}

// Marks the searched words in the text, and shortens long messages around the first match.
function Snippet({ text, words }) {
  let shown = text;
  const lower = text.toLowerCase();
  const first = words.length ? Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0)) : 0;
  if (text.length > 140 && first > 60) shown = `…${text.slice(first - 40)}`;
  if (shown.length > 160) shown = `${shown.slice(0, 160)}…`;
  if (!words.length) return shown;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = shown.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  return parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export default function SearchPanel({ groups, active, me, people, resizer, onJump, onClose }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState(active ? 'chat' : 'all');
  const [author, setAuthor] = useState('');
  const [kind, setKind] = useState('all');

  const chatName = (group) => (group.type === 'dm' ? shownName(people[dmPartner(group, me.id).id] ?? dmPartner(group, me.id)) : group.name);
  const chats = useMemo(() => (scope === 'chat' && active ? [active] : Object.values(groups)), [scope, active, groups]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  // Everyone who has written in the chats being searched, for the "From" filter.
  const authors = useMemo(() => {
    const found = new Map();
    for (const group of chats) {
      for (const m of group.messages) if (m.type === 'user' && !found.has(m.userId)) found.set(m.userId, people[m.userId] ?? m);
    }
    return [...found.entries()].sort((a, b) => shownName(a[1]).localeCompare(shownName(b[1])));
  }, [chats, people]);

  const results = useMemo(() => {
    if (!words.length && !author && kind === 'all') return null;
    const found = [];
    for (const group of chats) {
      for (const message of group.messages) {
        if (message.type !== 'user') continue;
        if (author && message.userId !== author) continue;
        if (!matchesKind(message, kind)) continue;
        const haystack = `${message.text} ${message.attachment?.name ?? ''}`.toLowerCase();
        if (words.every((w) => haystack.includes(w))) found.push({ group, message });
      }
    }
    return found.sort((a, b) => b.message.ts - a.message.ts);
  }, [chats, words.join(' '), author, kind]);

  return (
    <aside className="members-panel search-panel" aria-label="Search messages">
      {resizer}
      <div className="members-scroll">
        <header className="members-header">
          <h2>Search</h2>
          <button className="icon-button" aria-label="Close search" onClick={onClose}>
            <XIcon />
          </button>
        </header>

        <input
          type="search"
          className="search-input"
          aria-label="Search for words"
          placeholder="Search for words…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="search-filters">
          {active && (
            <div className="segmented" role="radiogroup" aria-label="Where to search">
              <button type="button" role="radio" aria-checked={scope === 'chat'} onClick={() => setScope('chat')}>
                This chat
              </button>
              <button type="button" role="radio" aria-checked={scope === 'all'} onClick={() => setScope('all')}>
                All chats
              </button>
            </div>
          )}
          <label>
            From
            <select value={author} onChange={(e) => setAuthor(e.target.value)}>
              <option value="">Anyone</option>
              {authors.map(([id, user]) => (
                <option key={id} value={id}>
                  {shownName(user)}
                  {id === me.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {results === null ? (
          <p className="hint">Type a word, or pick a person or a type of message.</p>
        ) : (
          <>
            <p className="search-count" role="status">
              {results.length === 0
                ? 'No messages found.'
                : `${results.length > MAX_RESULTS ? `${MAX_RESULTS}+` : results.length} message${results.length === 1 ? '' : 's'} found`}
            </p>
            <ul className="search-results">
              {results.slice(0, MAX_RESULTS).map(({ group, message }) => {
                const user = people[message.userId] ?? message;
                return (
                  <li key={message.id}>
                    <button className="search-result" onClick={() => onJump(group.id, message.id)}>
                      <Avatar user={user} size={32} />
                      <span className="search-result-text">
                        <span className="search-result-meta">
                          <strong>{shownName(user)}</strong>
                          {scope === 'all' && <span className="search-chat">in {chatName(group)}</span>}
                          <time>
                            {formatDay(message.ts)} {formatTime(message.ts)}
                          </time>
                        </span>
                        <span className="search-snippet">
                          {message.text ? <Snippet text={message.text} words={words} /> : null}
                          {message.attachment && (
                            <span className="search-attachment">
                              {message.attachment.kind === 'image' ? '📷' : '📎'} {message.attachment.name}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
