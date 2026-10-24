import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { io } from 'socket.io-client';

// How long "X is typing…" stays up after the last keystroke we heard about.
const TYPING_SHOWN_MS = 3000;
const REQUEST_TIMEOUT_MS = 5000;

const initialState = {
  status: 'connecting', // 'connecting' | 'online' | 'offline' | 'refused'
  error: null,
  me: null,
  groups: {},
  friends: { friends: [], incoming: [], outgoing: [] },
  friendNotice: null, // { text } when a request arrives or gets accepted
  online: [],
  typing: {}, // groupId -> { userId: name }
};

// Works out what changed in the friends list, so the app can tell you about it.
function friendNotice(before, after) {
  const known = (list) => new Set(list.map((u) => u.id));
  const wasIncoming = known(before.incoming);
  const wasOutgoing = known(before.outgoing);
  const wasFriend = known(before.friends);
  const asked = after.incoming.find((u) => !wasIncoming.has(u.id));
  if (asked) return { text: `${asked.name} sent you a friend request` };
  const accepted = after.friends.find((u) => !wasFriend.has(u.id) && wasOutgoing.has(u.id));
  if (accepted) return { text: `${accepted.name} accepted your friend request`, acceptedId: accepted.id };
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
        online: action.online,
        groups: Object.fromEntries(action.groups.map((g) => [g.id, g])),
        friends: action.friends,
        typing: {},
      };
    case 'friends':
      return {
        ...state,
        friends: action.friends,
        friendNotice: friendNotice(state.friends, action.friends) ?? state.friendNotice,
      };
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

  useEffect(() => {
    const socket = io({ auth: { user } });
    socketRef.current = socket;
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
    socket.on('init', (data) => dispatch({ type: 'init', ...data }));
    socket.on('presence', (online) => dispatch({ type: 'presence', online }));
    socket.on('friends', (friends) => dispatch({ type: 'friends', friends }));
    socket.on('group:upsert', (group) => dispatch({ type: 'group:upsert', group }));
    socket.on('group:removed', ({ groupId }) => dispatch({ type: 'group:removed', groupId }));
    socket.on('group:members', ({ groupId, members }) => dispatch({ type: 'group:members', groupId, members }));
    socket.on('message:new', ({ groupId, message }) => {
      if (message.userId) stopTyping(groupId, message.userId);
      dispatch({ type: 'message', groupId, message });
    });
    socket.on('message:update', ({ groupId, message }) => dispatch({ type: 'message', groupId, message }));
    socket.on('typing', ({ groupId, userId, name }) => {
      const key = `${groupId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.set(key, setTimeout(() => stopTyping(groupId, userId), TYPING_SHOWN_MS));
      dispatch({ type: 'typing:start', groupId, userId, name });
    });

    return () => {
      for (const timer of typingTimers.values()) clearTimeout(timer);
      socket.disconnect();
    };
  }, [user]);

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

  const actions = useMemo(
    () => ({
      createGroup: (name) => request('group:create', { name }),
      joinGroup: (code) => request('group:join', { code }),
      leaveGroup: (groupId) => request('group:leave', { groupId }),
      sendMessage: (groupId, text) => request('message:send', { groupId, text }),
      toggleReaction: (groupId, messageId, emoji) => request('reaction:toggle', { groupId, messageId, emoji }),
      addFriendByUsername: (username) => request('friend:add', { username }),
      addFriend: (friendId) => request('friend:add', { friendId }),
      respondToFriend: (fromId, accept) => request('friend:respond', { fromId, accept }),
      cancelFriendRequest: (friendId) => request('friend:cancel', { friendId }),
      removeFriend: (friendId) => request('friend:remove', { friendId }),
      openDm: (friendId) => request('dm:open', { friendId }),
      addToGroup: (groupId, friendId) => request('group:add', { groupId, friendId }),
      sendTyping: (groupId) => socketRef.current?.emit('typing', { groupId }),
    }),
    [request],
  );

  return { ...state, actions };
}
