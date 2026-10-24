import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText, storage } from '../lib.js';
import { useChat } from '../useChat.js';
import ChatPanel from './ChatPanel.jsx';
import { CreateGroupModal, JoinGroupModal } from './GroupModals.jsx';
import { LinkIcon, PlusIcon } from './Icons.jsx';
import Logo from './Logo.jsx';
import MembersPanel from './MembersPanel.jsx';
import Sidebar from './Sidebar.jsx';

const isWide = () => window.matchMedia('(min-width: 721px)').matches;
const lastActivity = (group) => group.messages.at(-1)?.ts ?? 0;

export default function ChatApp({ user, onSignOut }) {
  const { status, error, me, groups, online, typing, actions } = useChat(user);
  const readKey = `gjeng.read.${user.id}`;

  const [activeId, setActiveId] = useState(null);
  const [modal, setModal] = useState(null); // 'create' | 'join' | null
  const [membersOpen, setMembersOpen] = useState(false);
  const [lastRead, setLastRead] = useState(() => storage.get(readKey, {}));
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);

  const sortedGroups = useMemo(() => Object.values(groups).sort((a, b) => lastActivity(b) - lastActivity(a)), [groups]);
  const onlineIds = useMemo(() => new Set(online), [online]);
  const active = groups[activeId] ?? null;
  const activeLatest = active ? lastActivity(active) : 0;

  const unread = useMemo(() => {
    const counts = {};
    for (const group of sortedGroups) {
      const seen = lastRead[group.id] ?? 0;
      counts[group.id] =
        group.id === activeId
          ? 0
          : group.messages.filter((m) => m.type === 'user' && m.userId !== user.id && m.ts > seen).length;
    }
    return counts;
  }, [sortedGroups, lastRead, activeId, user.id]);

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);

  // On a wide screen, always show a chat if there is one.
  useEffect(() => {
    if (!active && sortedGroups.length && isWide()) setActiveId(sortedGroups[0].id);
  }, [active, sortedGroups]);

  useEffect(() => {
    if (!activeId || !activeLatest) return;
    setLastRead((prev) => (prev[activeId] >= activeLatest ? prev : { ...prev, [activeId]: activeLatest }));
  }, [activeId, activeLatest]);

  useEffect(() => storage.set(readKey, lastRead), [readKey, lastRead]);

  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) Gjeng` : 'Gjeng';
  }, [totalUnread]);

  function showNotice(text) {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }

  async function copyCode(code) {
    showNotice((await copyText(code)) ? `Invite code ${code} copied` : `Invite code: ${code}`);
  }

  async function createGroup(name) {
    const { groupId } = await actions.createGroup(name);
    setActiveId(groupId);
    setModal(null);
  }

  async function joinGroup(code) {
    const { groupId } = await actions.joinGroup(code);
    setActiveId(groupId);
    setModal(null);
  }

  async function leaveGroup(group) {
    if (!window.confirm(`Leave "${group.name}"? You'll need the invite code to come back.`)) return;
    try {
      await actions.leaveGroup(group.id);
      setMembersOpen(false);
      setActiveId(null);
    } catch (err) {
      showNotice(err.message);
    }
  }

  function signOut() {
    if (window.confirm('Sign out? There are no passwords, so you will need invite codes to get back into your groups.')) {
      onSignOut();
    }
  }

  if (!me) {
    return (
      <main className="splash">
        <Logo size={56} />
        {status === 'refused' ? (
          <>
            <p>Couldn't sign in: {error}</p>
            <button className="button primary" onClick={onSignOut}>
              Start over
            </button>
          </>
        ) : (
          <p>{status === 'offline' ? "Can't reach the Gjeng server. Retrying…" : 'Connecting…'}</p>
        )}
      </main>
    );
  }

  const typingNames = active ? Object.values(typing[active.id] ?? {}) : [];

  return (
    <div className={`app ${active ? 'chat-open' : ''} ${active && membersOpen ? 'members-open' : ''}`}>
      <Sidebar
        me={me}
        groups={sortedGroups}
        activeId={activeId}
        unread={unread}
        onSelect={setActiveId}
        onNew={() => setModal('create')}
        onJoin={() => setModal('join')}
        onSignOut={signOut}
      />

      {active ? (
        <ChatPanel
          key={active.id}
          group={active}
          me={me}
          onlineIds={onlineIds}
          typingNames={typingNames}
          membersOpen={membersOpen}
          onBack={() => setActiveId(null)}
          onToggleMembers={() => setMembersOpen((open) => !open)}
          onCopyCode={copyCode}
          onSend={(text) => actions.sendMessage(active.id, text)}
          onTyping={() => actions.sendTyping(active.id)}
          onReact={(messageId, emoji) =>
            actions.toggleReaction(active.id, messageId, emoji).catch((err) => showNotice(err.message))
          }
          onError={showNotice}
        />
      ) : (
        <section className="placeholder">
          <Logo size={64} />
          <h2>{sortedGroups.length ? 'Pick a group' : 'Welcome to Gjeng'}</h2>
          <p>
            {sortedGroups.length
              ? 'Choose a group on the left to start chatting.'
              : 'Create a group for your crew, or join one with an invite code from a friend.'}
          </p>
          <div className="placeholder-actions">
            <button className="button primary" onClick={() => setModal('create')}>
              <PlusIcon /> New group
            </button>
            <button className="button" onClick={() => setModal('join')}>
              <LinkIcon /> Join with code
            </button>
          </div>
        </section>
      )}

      {active && membersOpen && (
        <MembersPanel
          group={active}
          me={me}
          onlineIds={onlineIds}
          onClose={() => setMembersOpen(false)}
          onCopyCode={copyCode}
          onLeave={() => leaveGroup(active)}
        />
      )}

      {modal === 'create' && <CreateGroupModal onCreate={createGroup} onClose={() => setModal(null)} />}
      {modal === 'join' && <JoinGroupModal onJoin={joinGroup} onClose={() => setModal(null)} />}

      {status !== 'online' && (
        <div className="banner" role="status">
          Connection lost. Reconnecting…
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
