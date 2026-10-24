import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText, dmPartner, shownName, storage } from '../lib.js';
import { useChat } from '../useChat.js';
import AddMembersModal from './AddMembersModal.jsx';
import { Avatar } from './Avatar.jsx';
import ChatPanel from './ChatPanel.jsx';
import FriendsPanel from './FriendsPanel.jsx';
import { CreateGroupModal, JoinGroupModal } from './GroupModals.jsx';
import { LinkIcon, PhoneIcon, PlusIcon } from './Icons.jsx';
import Logo from './Logo.jsx';
import MembersPanel from './MembersPanel.jsx';
import ProfileCardModal from './ProfileCard.jsx';
import { ProfileContext } from './ProfileLink.jsx';
import Resizer from './Resizer.jsx';
import SearchPanel from './SearchPanel.jsx';
import SettingsModal from './settings/SettingsModal.jsx';
import Sidebar from './Sidebar.jsx';
import UserPanel from './UserPanel.jsx';

const FRIENDS = 'friends'; // activeId when the Friends page is open instead of a chat
const MEMBERS_KEY = 'gjeng.showMembers';
const WIDTHS_KEY = 'gjeng.widths';
const DEFAULT_WIDTHS = { sidebar: 320, members: 270 };
const LIMITS = { sidebar: [240, 480], members: [220, 440] };
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
  const { status, error, me, socketId, groups, friends, privacy, friendNotice, online, typing, calls, voice, actions } =
    useChat(user);
  const readKey = `gjeng.read.${user.id}`;

  const [activeId, setActiveId] = useState(null);
  const [modal, setModal] = useState(null); // 'create' | 'join' | 'add-members' | 'settings' | null
  const [profileUserId, setProfileUserId] = useState(null); // whose profile card is open
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(null); // { groupId, messageId } after jumping from search
  // Wide screens show the member list as a column (open unless you hide it, and remembered).
  // Smaller screens show it over the chat, only when you ask for it.
  const roomy = useMediaQuery('(min-width: 1101px)');
  const [membersPinned, setMembersPinned] = useState(() => storage.get(MEMBERS_KEY, true));
  const [membersOverlay, setMembersOverlay] = useState(false);
  const membersOpen = roomy ? membersPinned : membersOverlay;
  const [widths, setWidths] = useState(() => ({ ...DEFAULT_WIDTHS, ...storage.get(WIDTHS_KEY, {}) }));
  const [lastRead, setLastRead] = useState(() => storage.get(readKey, {}));
  const [ignoredCalls, setIgnoredCalls] = useState(() => new Set());
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);

  // You always count as online to yourself, even when you've chosen to look offline to others.
  const onlineIds = useMemo(() => new Set(me ? [...online, me.id] : online), [online, me]);
  const active = groups[activeId] ?? null;
  const activeLatest = active ? lastActivity(active) : 0;

  // Everyone you can see, with their newest name, picture and status.
  const people = useMemo(() => {
    const map = {};
    for (const group of Object.values(groups)) for (const m of group.members) map[m.id] = m;
    for (const list of Object.values(friends)) for (const u of list) map[u.id] = u;
    if (me) map[me.id] = me;
    return map;
  }, [groups, friends, me]);

  // Newest activity first.
  const { dms, groupList } = useMemo(() => {
    const sorted = Object.values(groups).sort((a, b) => lastActivity(b) - lastActivity(a));
    return {
      dms: sorted.filter((g) => g.type === 'dm'),
      groupList: sorted.filter((g) => g.type !== 'dm'),
    };
  }, [groups]);

  // GIFs people have sent in your chats, newest first, for the "Recent" GIF tab.
  const recentGifs = useMemo(() => {
    const seen = new Map();
    const messages = Object.values(groups).flatMap((g) => g.messages);
    for (const m of messages.sort((a, b) => b.ts - a.ts)) {
      const a = m.attachment;
      if (a?.kind === 'image' && a.name.toLowerCase().endsWith('.gif') && !seen.has(a.url)) seen.set(a.url, a);
    }
    return [...seen.values()].slice(0, 60);
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

  // A friend calling you in a DM, unless you're busy (do not disturb) or already in that call.
  const ringing = me
    ? Object.values(calls).find(
        (c) =>
          groups[c.groupId]?.type === 'dm' &&
          voice.groupId !== c.groupId &&
          me.status !== 'dnd' &&
          !c.participants.some((p) => p.userId === me.id) &&
          !ignoredCalls.has(`${c.groupId}:${c.startedAt}`),
      )
    : null;

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
  useEffect(() => storage.set(WIDTHS_KEY, widths), [widths]);

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

  useEffect(() => {
    if (voice.micError) showNotice(voice.micError, 6000);
  }, [voice.micError]);

  function showNotice(text, ms = 2500) {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), ms);
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

  // From a search result: open that chat and light up the message.
  function jumpTo(groupId, messageId) {
    selectChat(groupId);
    if (!roomy) setSearchOpen(false);
    setHighlight({ groupId, messageId, at: Date.now() });
  }

  function openProfile(userId) {
    setProfileUserId(userId);
  }

  // Runs a server action and shows its error as a notice instead of throwing.
  const attempt = (promise) => promise.catch((err) => showNotice(err.message));

  // The code itself isn't shown in the notice, so it stays private.
  async function copyCode(code, label = 'Invite code') {
    showNotice(
      (await copyText(code)) ? `${label} copied` : `Couldn't copy. Use "Show" to see the ${label.toLowerCase()}.`,
    );
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
    if (window.confirm(`Remove ${shownName(friend)} as a friend? You won't be able to message each other directly.`)) {
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

  function joinCall(groupId) {
    attempt(actions.joinCall(groupId));
  }

  function signOut() {
    if (
      window.confirm(
        'Sign out? There are no passwords, so your username stays taken and you will need invite codes to get back into your groups.',
      )
    ) {
      actions.leaveCall();
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
  const showMembers = isGroup && membersOpen && !searchOpen;
  const rightOpen = mainOpen && (searchOpen || showMembers);
  const typingNames = active ? Object.values(typing[active.id] ?? {}) : [];
  const chatName = (group) => (group.type === 'dm' ? shownName(people[dmPartner(group, me.id).id]) : group.name);
  const resize = (panel) => (width) => setWidths((w) => ({ ...w, [panel]: width }));

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
        people={people}
        onlineIds={onlineIds}
        typingNames={typingNames}
        membersOpen={membersOpen}
        searchOpen={searchOpen}
        highlight={highlight?.groupId === active.id ? highlight : null}
        recentGifs={recentGifs}
        call={calls[active.id]}
        voice={voice}
        socketId={socketId}
        onBack={() => setActiveId(null)}
        onToggleMembers={() => {
          if (searchOpen) {
            setSearchOpen(false);
            setMembersOpen(true);
          } else setMembersOpen(!membersOpen);
        }}
        onToggleSearch={() => setSearchOpen((open) => !open)}
        onCopyCode={copyCode}
        onSend={(text, attachment) => actions.sendMessage(active.id, text, attachment)}
        onTyping={() => actions.sendTyping(active.id)}
        onReact={(messageId, emoji) => attempt(actions.toggleReaction(active.id, messageId, emoji))}
        onError={showNotice}
        onJoinCall={() => joinCall(active.id)}
        onLeaveCall={actions.leaveCall}
        onToggleMute={() => actions.setMuted(!voice.muted)}
        onToggleDeafen={() => actions.setDeafened(!voice.deafened)}
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

  const membersResizer = (
    <Resizer
      edge="left"
      label="Resize the member list"
      value={widths.members}
      min={LIMITS.members[0]}
      max={LIMITS.members[1]}
      defaultValue={DEFAULT_WIDTHS.members}
      onChange={resize('members')}
    />
  );

  const ringingPartner = ringing ? people[dmPartner(groups[ringing.groupId], me.id).id] : null;

  return (
    <ProfileContext.Provider value={openProfile}>
      <div
        className={`app ${mainOpen ? 'chat-open' : ''} ${rightOpen ? 'members-open' : ''}`}
        style={{ '--sidebar-width': `${widths.sidebar}px`, '--members-width': `${widths.members}px` }}
      >
        <Sidebar
          me={me}
          people={people}
          dms={dms}
          groups={groupList}
          calls={calls}
          activeId={activeId}
          unread={unread}
          onlineIds={onlineIds}
          requestCount={friends.incoming.length}
          onSelect={selectChat}
          onFriends={() => setActiveId(FRIENDS)}
          onNew={() => setModal('create')}
          onJoin={() => setModal('join')}
          resizer={
            <Resizer
              edge="right"
              label="Resize the chat list"
              value={widths.sidebar}
              min={LIMITS.sidebar[0]}
              max={LIMITS.sidebar[1]}
              defaultValue={DEFAULT_WIDTHS.sidebar}
              onChange={resize('sidebar')}
            />
          }
          footer={
            <UserPanel
              me={me}
              voice={voice}
              callName={voice.groupId && groups[voice.groupId] ? chatName(groups[voice.groupId]) : ''}
              onOpenProfile={() => setModal('settings')}
              onSetStatus={(value) => attempt(actions.updateProfile({ status: value }))}
              onToggleMute={() => actions.setMuted(!voice.muted)}
              onToggleDeafen={() => actions.setDeafened(!voice.deafened)}
              onLeaveCall={actions.leaveCall}
            />
          }
        />

        {main}

        {searchOpen && mainOpen && (
          <SearchPanel
            groups={groups}
            active={active}
            me={me}
            people={people}
            resizer={roomy && membersResizer}
            onJump={jumpTo}
            onClose={() => setSearchOpen(false)}
          />
        )}

        {showMembers && (
          <MembersPanel
            group={active}
            me={me}
            friends={friends}
            onlineIds={onlineIds}
            resizer={roomy && membersResizer}
            onClose={() => setMembersOpen(false)}
            onCopyCode={copyCode}
            onLeave={() => leaveGroup(active)}
            onAddFriend={addFriend}
            onRespond={respondToFriend}
            onMessage={openDm}
            onAddMembers={() => setModal('add-members')}
          />
        )}

        {ringing && ringingPartner && (
          <div className="incoming-call" role="alertdialog" aria-label={`${shownName(ringingPartner)} is calling`}>
            <Avatar user={ringingPartner} size={48} />
            <div className="incoming-call-text">
              <strong>{shownName(ringingPartner)}</strong>
              <span>is calling you…</span>
            </div>
            <button
              className="call-button hang-up"
              aria-label="Ignore call"
              onClick={() => setIgnoredCalls((s) => new Set(s).add(`${ringing.groupId}:${ringing.startedAt}`))}
            >
              <PhoneIcon size={18} />
            </button>
            <button
              className="call-button answer"
              aria-label="Answer call"
              onClick={() => {
                selectChat(ringing.groupId);
                joinCall(ringing.groupId);
              }}
            >
              <PhoneIcon size={18} />
            </button>
          </div>
        )}

        {modal === 'settings' && (
          <SettingsModal
            me={me}
            privacy={privacy}
            onSaveProfile={(changes) => actions.updateProfile(changes)}
            onUpdatePrivacy={(changes) => actions.updatePrivacy(changes)}
            onSignOut={signOut}
            onClose={() => setModal(null)}
          />
        )}
        {profileUserId && (
          <ProfileCardModal
            key={profileUserId}
            userId={profileUserId}
            liveUser={people[profileUserId]}
            onlineIds={onlineIds}
            getProfile={actions.getProfile}
            onMessage={(id) => {
              setProfileUserId(null);
              openDm(id);
            }}
            onAddFriend={(id) =>
              actions
                .addFriend(id)
                .then(afterFriendRequest)
                .catch((err) => showNotice(err.message))
            }
            onAccept={(id) =>
              actions
                .respondToFriend(id, true)
                .then(({ groupId }) => {
                  setProfileUserId(null);
                  if (groupId) selectChat(groupId);
                })
                .catch((err) => showNotice(err.message))
            }
            onOpenGroup={(groupId) => {
              setProfileUserId(null);
              selectChat(groupId);
            }}
            onOpenProfile={setProfileUserId}
            onEditProfile={() => {
              setProfileUserId(null);
              setModal('settings');
            }}
            onClose={() => setProfileUserId(null)}
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
    </ProfileContext.Provider>
  );
}
