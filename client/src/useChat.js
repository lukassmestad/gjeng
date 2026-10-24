import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { io } from 'socket.io-client';
import { shownName } from './lib.js';
import { CallClient } from './voice.js';

// How long "X is typing…" stays up after the last keystroke we heard about.
const TYPING_SHOWN_MS = 3000;
const REQUEST_TIMEOUT_MS = 8000;

const noVoice = { groupId: null, muted: false, deafened: false, speaking: [], micError: null };

const initialState = {
  status: 'connecting', // 'connecting' | 'online' | 'offline' | 'refused'
  error: null,
  me: null,
  socketId: null,
  groups: {},
  friends: { friends: [], incoming: [], outgoing: [] },
  privacy: null, // your own privacy settings
  friendNotice: null, // { text } when a request arrives or gets accepted
  online: [],
  typing: {}, // groupId -> { userId: name }
  calls: {}, // groupId -> { startedAt, participants: [{ socketId, userId, muted, deafened }] }
  voice: noVoice, // the call you're in yourself
};

// Works out what changed in the friends list, so the app can tell you about it.
function friendNotice(before, after) {
  const known = (list) => new Set(list.map((u) => u.id));
  const wasIncoming = known(before.incoming);
  const wasOutgoing = known(before.outgoing);
  const wasFriend = known(before.friends);
  const asked = after.incoming.find((u) => !wasIncoming.has(u.id));
  if (asked) return { text: `${shownName(asked)} sent you a friend request` };
  const accepted = after.friends.find((u) => !wasFriend.has(u.id) && wasOutgoing.has(u.id));
  if (accepted) return { text: `${shownName(accepted)} accepted your friend request`, acceptedId: accepted.id };
  return null;
}

function updateGroup(state, groupId, update) {
  const group = state.groups[groupId];
  if (!group) return state;
  return { ...state, groups: { ...state.groups, [groupId]: update(group) } };
}

function upsertMessage(messages, message) {
  const index = messages.findIndex((m) => m.id === message.id);
  if (index === -1) return [...messages, message];
  const next = messages.slice();
  next[index] = message;
  return next;
}

// Someone changed their name, picture or status: swap in the new version everywhere it appears.
function replaceUser(state, user) {
  const swap = (list) => list.map((u) => (u.id === user.id ? user : u));
  return {
    ...state,
    me: state.me?.id === user.id ? user : state.me,
    groups: Object.fromEntries(
      Object.entries(state.groups).map(([id, g]) => [id, g.members.some((m) => m.id === user.id) ? { ...g, members: swap(g.members) } : g]),
    ),
    friends: {
      friends: swap(state.friends.friends),
      incoming: swap(state.friends.incoming),
      outgoing: swap(state.friends.outgoing),
    },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'status':
      return { ...state, status: action.status, error: action.error ?? null };
    case 'init':
      return {
        ...state,
        status: 'online',
        error: null,
        me: action.me,
        socketId: action.socketId,
        online: action.online,
        groups: Object.fromEntries(action.groups.map((g) => [g.id, g])),
        friends: action.friends,
        privacy: action.privacy,
        calls: Object.fromEntries(action.calls.map((c) => [c.groupId, c])),
        typing: {},
      };
    case 'friends':
      return {
        ...state,
        friends: action.friends,
        friendNotice: friendNotice(state.friends, action.friends) ?? state.friendNotice,
      };
    case 'user:update':
      return replaceUser(state, action.user);
    case 'privacy':
      return { ...state, privacy: action.privacy };
    case 'group:upsert':
      return { ...state, groups: { ...state.groups, [action.group.id]: action.group } };
    case 'group:removed': {
      const groups = { ...state.groups };
      delete groups[action.groupId];
      return { ...state, groups };
    }
    case 'group:members':
      return updateGroup(state, action.groupId, (g) => ({ ...g, members: action.members }));
    case 'message':
      return updateGroup(state, action.groupId, (g) => ({ ...g, messages: upsertMessage(g.messages, action.message) }));
    case 'presence':
      return { ...state, online: action.online };
    case 'call': {
      const calls = { ...state.calls };
      if (action.call.participants.length) calls[action.call.groupId] = action.call;
      else delete calls[action.call.groupId];
      return { ...state, calls };
    }
    case 'voice':
      return { ...state, voice: action.voice };
    case 'typing:start':
      return {
        ...state,
        typing: { ...state.typing, [action.groupId]: { ...state.typing[action.groupId], [action.userId]: action.name } },
      };
    case 'typing:stop': {
      const current = state.typing[action.groupId];
      if (!current?.[action.userId]) return state;
      const next = { ...current };
      delete next[action.userId];
      return { ...state, typing: { ...state.typing, [action.groupId]: next } };
    }
    default:
      return state;
  }
}

// Keeps a live connection to the chat server and mirrors the user's groups in React state.
export function useChat(user) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef(null);
  const voiceRef = useRef(null);

  // Sends an event and waits for the server's { ok, ... } answer. Throws a readable error otherwise.
  const request = useCallback(async (event, payload) => {
    let reply;
    try {
      reply = await socketRef.current.timeout(REQUEST_TIMEOUT_MS).emitWithAck(event, payload);
    } catch {
      throw new Error("Couldn't reach the server. Try again.");
    }
    if (!reply.ok) throw new Error(reply.error);
    return reply;
  }, []);

  useEffect(() => {
    const socket = io({ auth: { user } });
    socketRef.current = socket;
    const voice = new CallClient(socket, request, (snapshot) => dispatch({ type: 'voice', voice: snapshot }));
    voiceRef.current = voice;
    const typingTimers = new Map();

    function stopTyping(groupId, userId) {
      const key = `${groupId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
      dispatch({ type: 'typing:stop', groupId, userId });
    }

    socket.on('connect_error', (err) => {
      // socket.active is false when the server said no, rather than just being unreachable.
      if (socket.active) dispatch({ type: 'status', status: 'offline' });
      else dispatch({ type: 'status', status: 'refused', error: err.message });
    });
    socket.on('disconnect', () => dispatch({ type: 'status', status: 'offline' }));
    socket.on('init', (data) => dispatch({ type: 'init', ...data, socketId: socket.id }));
    socket.on('presence', (online) => dispatch({ type: 'presence', online }));
    socket.on('friends', (friends) => dispatch({ type: 'friends', friends }));
    socket.on('user:update', (changed) => dispatch({ type: 'user:update', user: changed }));
    socket.on('privacy', (privacy) => dispatch({ type: 'privacy', privacy }));
    socket.on('group:upsert', (group) => dispatch({ type: 'group:upsert', group }));
    socket.on('group:removed', ({ groupId }) => dispatch({ type: 'group:removed', groupId }));
    socket.on('group:members', ({ groupId, members }) => dispatch({ type: 'group:members', groupId, members }));
    socket.on('message:new', ({ groupId, message }) => {
      if (message.userId) stopTyping(groupId, message.userId);
      dispatch({ type: 'message', groupId, message });
    });
    socket.on('message:update', ({ groupId, message }) => dispatch({ type: 'message', groupId, message }));
    socket.on('call:state', (call) => {
      dispatch({ type: 'call', call });
      voice.sync(call);
    });
    socket.on('typing', ({ groupId, userId, name }) => {
      const key = `${groupId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.set(key, setTimeout(() => stopTyping(groupId, userId), TYPING_SHOWN_MS));
      dispatch({ type: 'typing:start', groupId, userId, name });
    });

    return () => {
      for (const timer of typingTimers.values()) clearTimeout(timer);
      voice.destroy();
      socket.disconnect();
    };
  }, [user, request]);

  const actions = useMemo(
    () => ({
      createGroup: (name) => request('group:create', { name }),
      joinGroup: (code) => request('group:join', { code }),
      leaveGroup: (groupId) => request('group:leave', { groupId }),
      sendMessage: (groupId, text, attachment) => request('message:send', { groupId, text, attachment }),
      toggleReaction: (groupId, messageId, emoji) => request('reaction:toggle', { groupId, messageId, emoji }),
      addFriendByUsername: (username) => request('friend:add', { username }),
      addFriend: (friendId) => request('friend:add', { friendId }),
      respondToFriend: (fromId, accept) => request('friend:respond', { fromId, accept }),
      cancelFriendRequest: (friendId) => request('friend:cancel', { friendId }),
      removeFriend: (friendId) => request('friend:remove', { friendId }),
      openDm: (friendId) => request('dm:open', { friendId }),
      addToGroup: (groupId, friendId) => request('group:add', { groupId, friendId }),
      updateProfile: (changes) => request('profile:update', changes),
      updatePrivacy: (changes) => request('privacy:update', changes),
      getProfile: (userId) => request('profile:get', { userId }),
      sendTyping: (groupId) => socketRef.current?.emit('typing', { groupId }),
      joinCall: (groupId) => voiceRef.current.join(groupId),
      leaveCall: () => voiceRef.current?.leave(),
      setMuted: (muted) => voiceRef.current?.setMuted(muted),
      setDeafened: (deafened) => voiceRef.current?.setDeafened(deafened),
    }),
    [request],
  );

  return { ...state, actions };
}
