import { useLayoutEffect, useRef, useState } from 'react';
import { ATTACHMENT_MAX_BYTES, formatBytes, LIMITS, readAsDataUrl, shrinkImage } from '../lib.js';
import EmojiPicker from './EmojiPicker.jsx';
import { FileIcon, PaperclipIcon, SendIcon, SmileIcon, XIcon } from './Icons.jsx';

// Tell the others we're typing at most this often.
const TYPING_EVERY_MS = 2000;
const MAX_HEIGHT = 160;

// Turns a picked or pasted file into an attachment. Photos are shrunk; GIFs and other files are sent as they are.
async function toAttachment(file) {
  if (file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml') {
    const { data, width, height } = await shrinkImage(file, { maxSize: 1600 });
    return { kind: 'image', name: file.name || 'picture.jpg', data, width, height, size: Math.round((data.length * 3) / 4) };
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error(`Files can be at most ${formatBytes(ATTACHMENT_MAX_BYTES)}. That one is ${formatBytes(file.size)}.`);
  }
  const data = await readAsDataUrl(file);
  return { kind: file.type === 'image/gif' ? 'image' : 'file', name: file.name || 'file', data, size: file.size };
}

export default function Composer({ groupName, onSend, onTyping, onError }) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fieldRef = useRef(null);
  const fileRef = useRef(null);
  const lastTyping = useRef(0);

  // Grow the box with the text. The scrollbar only appears once it's at full height.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT)}px`;
    field.style.overflowY = field.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [text]);

  function change(event) {
    setText(event.target.value);
    const now = Date.now();
    if (event.target.value.trim() && now - lastTyping.current > TYPING_EVERY_MS) {
      lastTyping.current = now;
      onTyping();
    }
  }

  async function attach(file) {
    try {
      setAttachment(await toAttachment(file));
      fieldRef.current?.focus();
    } catch (err) {
      onError(err.message);
    }
  }

  function pickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) attach(file);
  }

  // Pasting a screenshot attaches it.
  function paste(event) {
    const file = [...(event.clipboardData?.files ?? [])][0];
    if (file) {
      event.preventDefault();
      attach(file);
    }
  }

  // Puts the emoji where the cursor is, not just at the end.
  function addEmoji(emoji) {
    const field = fieldRef.current;
    const start = field.selectionStart ?? text.length;
    const end = field.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function send() {
    const value = text.trim();
    if (!value && !attachment) return;
    // Clear straight away so it feels instant, and put everything back if sending fails.
    const sending = attachment;
    setText('');
    setAttachment(null);
    lastTyping.current = 0;
    try {
      await onSend(value, sending ? { kind: sending.kind, name: sending.name, data: sending.data, width: sending.width, height: sending.height } : undefined);
    } catch (err) {
      setText(value);
      setAttachment(sending);
      onError(err.message);
    }
    fieldRef.current?.focus();
  }

  function keyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="composer-area">
      {attachment && (
        <div className="attachment-preview">
          {attachment.kind === 'image' ? (
            <img src={attachment.data} alt="" />
          ) : (
            <span className="attachment-preview-icon">
              <FileIcon />
            </span>
          )}
          <span className="attachment-preview-text">
            <span className="attachment-preview-name">{attachment.name}</span>
            <span className="hint">{formatBytes(attachment.size)}</span>
          </span>
          <button type="button" className="icon-button" aria-label="Remove attachment" onClick={() => setAttachment(null)}>
            <XIcon size={18} />
          </button>
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="composer-box">
          <button
            type="button"
            className="composer-tool"
            aria-label="Attach a picture or file"
            title="Attach a picture or file"
            onClick={() => fileRef.current.click()}
          >
            <PaperclipIcon />
          </button>
          <input ref={fileRef} type="file" hidden onChange={pickFile} aria-label="Choose a file to attach" />
          <textarea
            ref={fieldRef}
            rows={1}
            value={text}
            onChange={change}
            onKeyDown={keyDown}
            onPaste={paste}
            maxLength={LIMITS.message}
            placeholder={`Message ${groupName}`}
            aria-label={`Message ${groupName}`}
            autoFocus={window.matchMedia('(min-width: 721px)').matches}
          />
          <span className="emoji-anchor">
            <button
              type="button"
              className={`composer-tool ${emojiOpen ? 'pressed' : ''}`}
              aria-label="Add an emoji"
              title="Add an emoji"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((open) => !open)}
            >
              <SmileIcon />
            </button>
            {emojiOpen && <EmojiPicker onPick={addEmoji} onClose={() => setEmojiOpen(false)} />}
          </span>
        </div>
        <button className="send-button" aria-label="Send" disabled={!text.trim() && !attachment}>
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
