import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText, storage } from '../lib.js';
import { useChat } from '../useChat.js';
import AddMembersModal from './AddMembersModal.jsx';
import ChatPanel from './ChatPanel.jsx';
import FriendsPanel from './FriendsPanel.jsx';
import { CreateGroupModal, JoinGroupModal } from './GroupModals.jsx';
import { LinkIcon, PlusIcon } from './Icons.jsx';
import Logo from './Logo.jsx';
import MembersPanel from './MembersPanel.jsx';
import Sidebar from './Sidebar.jsx';

const FRIENDS = 'friends'; // activeId when the Friends page is open instead of a chat
const MEMBERS_KEY = 'gjeng.showMembers';
const isWide = () => window.matchMedia('(min-width: 721px)').matches;

// True while the window matches the media query, and updates when the window is resized.
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}
const lastActivity = (group) => group.messages.at(-1)?.ts ?? 0;

export default function ChatApp({ user, onSignOut }) {
  const { status, error, me, groups, friends, friendNotice, online, typing, actions } = useChat(user);
  const readKey = `gjeng.read.${user.id}`;

  const [activeId, setActiveId] = useState(null);
  const [modal, setModal] = useState(null); // 'create' | 'join' | 'add-members' | null
  // Wide screens show the member list as a column (open unless you hide it, and remembered).
  // Smaller screens show it over the chat, only when you ask for it.
  const roomy = useMediaQuery('(min-width: 1101px)');
  const [membersPinned, setMembersPinned] = useState(() => storage.get(MEMBERS_KEY, true));
  const [membersOverlay, setMembersOverlay] = useState(false);
  const membersOpen = roomy ? membersPinned : membersOverlay;
  const [lastRead, setLastRead] = useState(() => storage.get(readKey, {}));
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);

  const onlineIds = useMemo(() => new Set(online), [online]);
  const active = groups[activeId] ?? null;
  const activeLatest = active ? lastActivity(active) : 0;

  // Newest activity first.
  const { dms, groupList } = useMemo(() => {
    const sorted = Object.values(groups).sort((a, b) => lastActivity(b) - lastActivity(a));
    return {
      dms: sorted.filter((g) => g.type === 'dm'),
      groupList: sorted.filter((g) => g.type !== 'dm'),
    };
  }, [groups]);

  const unread = useMemo(() => {
    const counts = {};
    for (const group of Object.values(groups)) {
      const seen = lastRead[group.id] ?? 0;
      counts[group.id] =
        group.id === activeId
          ? 0
          : group.messages.filter((m) => m.type === 'user' && m.userId !== user.id && m.ts > seen).length;
    }
    return counts;
  }, [groups, lastRead, activeId, user.id]);

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);

  // On a wide screen, always show something: the most recent chat.
  useEffect(() => {
    if (active || activeId === FRIENDS || !isWide()) return;
    const latest = [...dms, ...groupList].sort((a, b) => lastActivity(b) - lastActivity(a))[0];
    if (latest) setActiveId(latest.id);
  }, [active, activeId, dms, groupList]);

  useEffect(() => {
    if (!activeId || !activeLatest) return;
    setLastRead((prev) => (prev[activeId] >= activeLatest ? prev : { ...prev, [activeId]: activeLatest }));
  }, [activeId, activeLatest]);

  useEffect(() => storage.set(readKey, lastRead), [readKey, lastRead]);

  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) Gjeng` : 'Gjeng';
  }, [totalUnread]);

  // Someone accepted your request: tell you, and if you were waiting on the Friends page
  // (or had nothing open), jump into the new direct message with them.
  useEffect(() => {
    if (!friendNotice) return;
    showNotice(friendNotice.text);
    if (friendNotice.acceptedId && (activeId === FRIENDS || !active)) {
      const dm = dms.find((g) => g.members.some((m) => m.id === friendNotice.acceptedId));
      if (dm) setActiveId(dm.id);
    }
  }, [friendNotice]);

  function showNotice(text) {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }

  function setMembersOpen(open) {
    if (roomy) {
      setMembersPinned(open);
      storage.set(MEMBERS_KEY, open);
    } else {
      setMembersOverlay(open);
    }
  }

  function selectChat(id) {
    setActiveId(id);
    setMembersOverlay(false);
  }

  // Runs a server action and shows its error as a notice instead of throwing.
  const attempt = (promise) => promise.catch((err) => showNotice(err.message));

  async function copyCode(code, label = 'Invite code') {
    showNotice((await copyText(code)) ? `${label} ${code} copied` : `${label}: ${code}`);
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
      setMembersOverlay(false);
      setActiveId(null);
    } catch (err) {
      showNotice(err.message);
    }
  }

  // If you both asked each other you're friends at once, and the new direct message opens.
  function afterFriendRequest({ status: result, name, groupId }) {
    if (result === 'accepted') {
      showNotice(`You and ${name} are now friends`);
      selectChat(groupId);
    } else {
      showNotice(`Friend request sent to ${name}`);
    }
  }

  async function addFriendByUsername(username) {
    afterFriendRequest(await actions.addFriendByUsername(username));
  }

  function addFriend(friendId) {
    attempt(actions.addFriend(friendId).then(afterFriendRequest));
  }

  // Accepting opens your new direct message right away.
  function respondToFriend(fromId, accept) {
    attempt(
      actions.respondToFriend(fromId, accept).then(({ groupId }) => {
        if (groupId) selectChat(groupId);
      }),
    );
  }

  function addToGroup(friendId) {
    return actions.addToGroup(active.id, friendId);
  }

  function removeFriend(friend) {
    if (window.confirm(`Remove ${friend.name} as a friend? You won't be able to message each other directly.`)) {
      attempt(actions.removeFriend(friend.id));
    }
  }

  function openDm(friendId) {
    attempt(
      actions.openDm(friendId).then(({ groupId }) => {
        setMembersOverlay(false);
        setActiveId(groupId);
      }),
    );
  }

  function signOut() {
    if (window.confirm('Sign out? There are no passwords, so your username stays taken and you will need invite codes to get back into your groups.')) {
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

  const isGroup = active && active.type !== 'dm';
  const mainOpen = Boolean(active) || activeId === FRIENDS;
  const typingNames = active ? Object.values(typing[active.id] ?? {}) : [];

  let main;
  if (activeId === FRIENDS) {
    main = (
      <FriendsPanel
        me={me}
        friends={friends}
        onlineIds={onlineIds}
        onBack={() => setActiveId(null)}
        onCopyName={(name) => copyCode(name, 'Username')}
        onAdd={addFriendByUsername}
        onRespond={respondToFriend}
        onCancel={(friendId) => attempt(actions.cancelFriendRequest(friendId))}
        onRemove={removeFriend}
        onMessage={openDm}
      />
    );
  } else if (active) {
    main = (
      <ChatPanel
        key={active.id}
        group={active}
        me={me}
        onlineIds={onlineIds}
        typingNames={typingNames}
        membersOpen={membersOpen}
        onBack={() => setActiveId(null)}
        onToggleMembers={() => setMembersOpen(!membersOpen)}
        onCopyCode={copyCode}
        onSend={(text) => actions.sendMessage(active.id, text)}
        onTyping={() => actions.sendTyping(active.id)}
        onReact={(messageId, emoji) => attempt(actions.toggleReaction(active.id, messageId, emoji))}
        onError={showNotice}
      />
    );
  } else {
    const hasChats = dms.length + groupList.length > 0;
    main = (
      <section className="placeholder">
        <Logo size={64} />
        <h2>{hasChats ? 'Pick a chat' : 'Welcome to Gjeng'}</h2>
        <p>
          {hasChats
            ? 'Choose a chat on the left to start talking.'
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
    );
  }

  return (
    <div className={`app ${mainOpen ? 'chat-open' : ''} ${isGroup && membersOpen ? 'members-open' : ''}`}>
      <Sidebar
        me={me}
        dms={dms}
        groups={groupList}
        activeId={activeId}
        unread={unread}
        onlineIds={onlineIds}
        requestCount={friends.incoming.length}
        onSelect={selectChat}
        onFriends={() => setActiveId(FRIENDS)}
        onNew={() => setModal('create')}
        onJoin={() => setModal('join')}
        onSignOut={signOut}
      />

      {main}

      {isGroup && membersOpen && (
        <MembersPanel
          group={active}
          me={me}
          friends={friends}
          onlineIds={onlineIds}
          onClose={() => setMembersOpen(false)}
          onCopyCode={copyCode}
          onLeave={() => leaveGroup(active)}
          onAddFriend={addFriend}
          onRespond={respondToFriend}
          onMessage={openDm}
          onAddMembers={() => setModal('add-members')}
        />
      )}

      {modal === 'add-members' && isGroup && (
        <AddMembersModal
          group={active}
          friends={friends.friends}
          onlineIds={onlineIds}
          onAdd={addToGroup}
          onClose={() => setModal(null)}
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
