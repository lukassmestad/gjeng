import { useEffect, useState } from 'react';
import { formatElapsed, shownName } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import {
  HangUpIcon,
  HeadphonesIcon,
  HeadphonesOffIcon,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  SpeakerIcon,
} from './Icons.jsx';

// The current time, updated every second while `active`.
function useNow(active) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function CallBubble({ user, isMe, speaking, muted, deafened }) {
  const name = shownName(user);
  const states = [isMe && 'you', speaking && 'talking', muted && 'muted', deafened && 'deafened'].filter(Boolean);
  return (
    <li
      className={`call-bubble ${speaking ? 'speaking' : ''} ${muted || deafened ? 'muted' : ''}`}
      aria-label={states.length ? `${name} (${states.join(', ')})` : name}
    >
      <span className="call-avatar">
        <Avatar user={user} size={84} />
        {speaking && (
          <span className="call-badge talking" title="Talking">
            <SpeakerIcon size={14} />
          </span>
        )}
        {(muted || deafened) && (
          <span className="call-badge off" title={deafened ? 'Deafened' : 'Muted'}>
            {deafened ? <HeadphonesOffIcon size={14} /> : <MicOffIcon size={14} />}
          </span>
        )}
      </span>
      <span className="call-name">{name}</span>
    </li>
  );
}

// The call area at the top of a chat, like Discord: everyone in the call as a bubble, and the buttons.
export default function CallStage({ call, groupId, voice, me, socketId, people, onJoin, onLeave, onToggleMute, onToggleDeafen }) {
  const inCall = voice.groupId === groupId;
  const participants = [...(call?.participants ?? [])];
  // While joining, show yourself straight away, before the server has confirmed it.
  if (inCall && !participants.some((p) => p.socketId === socketId)) {
    participants.unshift({ socketId, userId: me.id, muted: voice.muted, deafened: voice.deafened });
  }
  const now = useNow(Boolean(call?.startedAt));
  const speaking = new Set(voice.groupId === groupId ? voice.speaking : []);
  const alone = inCall && participants.length === 1;

  return (
    <section className="call-stage" aria-label="Call">
      <p className="call-status">
        <span className="call-live-dot" aria-hidden="true" />
        {inCall ? (alone ? 'Waiting for others to join…' : 'Voice connected') : `${participants.length} in the call`}
        {call?.startedAt && <span className="call-timer">{formatElapsed(now - call.startedAt)}</span>}
      </p>

      <ul className="call-participants">
        {participants.map((p) => {
          const isMe = p.socketId === socketId;
          return (
            <CallBubble
              key={p.socketId}
              user={people[p.userId] ?? (isMe ? me : { id: p.userId, name: 'Someone', color: '#868e96' })}
              isMe={isMe}
              speaking={speaking.has(p.socketId)}
              muted={isMe ? voice.muted : p.muted}
              deafened={isMe ? voice.deafened : p.deafened}
            />
          );
        })}
      </ul>

      <div className="call-controls">
        {inCall ? (
          <>
            <button
              className={`call-button ${voice.muted ? 'off' : ''}`}
              aria-label={voice.muted ? 'Unmute' : 'Mute'}
              title={voice.muted ? 'Unmute' : 'Mute'}
              aria-pressed={voice.muted}
              onClick={onToggleMute}
            >
              {voice.muted ? <MicOffIcon /> : <MicIcon />}
            </button>
            <button
              className={`call-button ${voice.deafened ? 'off' : ''}`}
              aria-label={voice.deafened ? 'Undeafen' : 'Deafen'}
              title={voice.deafened ? 'Undeafen' : 'Deafen (hear nothing)'}
              aria-pressed={voice.deafened}
              onClick={onToggleDeafen}
            >
              {voice.deafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
            </button>
            <button className="call-button hang-up" aria-label="Leave call" title="Leave call" onClick={onLeave}>
              <HangUpIcon />
            </button>
          </>
        ) : (
          <button className="call-join" onClick={onJoin}>
            <PhoneIcon size={18} /> Join call
          </button>
        )}
      </div>
      {inCall && voice.micError && <p className="call-warning">{voice.micError}</p>}
    </section>
  );
}
