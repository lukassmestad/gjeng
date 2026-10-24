import express from 'express';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { seedDemo } from './demo.js';
import { displayOf, publicUser, Store, StoreError } from './store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
// "--demo" starts with fresh made-up people and chats every time, kept apart from your real data.
const DEMO = process.argv.includes('--demo');
// "--https" makes a homemade certificate, because browsers only allow the microphone on https (or localhost).
const HTTPS = process.argv.includes('--https');
const DATA_FILE = path.resolve(process.env.DATA_FILE || path.join(root, 'data', DEMO ? 'demo.json' : 'gjeng.json'));
const DIST_DIR = path.join(root, 'dist');

// --- Saving to disk -------------------------------------------------------

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Could not read ${DATA_FILE}, starting empty:`, err.message);
    return {};
  }
}

const store = DEMO ? seedDemo() : new Store(loadData());
let saveTimer = null;

function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store));
}

// Batch writes so a burst of messages doesn't hit the disk every time.
function save() {
  if (!saveTimer) saveTimer = setTimeout(flush, 300);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (saveTimer) flush();
    process.exit(0);
  });
}

// --- Web server -----------------------------------------------------------

const app = express();

// Lets the join screen check a username while you type.
app.get('/api/username', (req, res) => {
  res.json(store.checkUsername(req.query.name, req.query.id));
});

app.get('/api/demo-users', (_req, res) => {
  res.json(store.demoUsers());
});

// Pictures and files from messages. Anything that isn't a picture is always downloaded,
// never opened in the browser, so a file can't pretend to be part of the app.
app.get('/api/files/:id', (req, res) => {
  const file = store.getFile(req.params.id);
  if (!file) return res.status(404).send('Not found');
  const isImage = file.mime.startsWith('image/');
  res.set({
    'Content-Type': file.mime,
    'Content-Disposition': `${isImage ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
  res.send(Buffer.from(file.data, 'base64'));
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
} else {
  app.get('/', (_req, res) => {
    res.send('No build found. Run "npm run build" first, or use "npm run dev" and open http://localhost:5173.');
  });
}

async function makeServer() {
  if (!HTTPS) return createServer(app);
  const { default: selfsigned } = await import('selfsigned');
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'gjeng.local' }], { days: 30, keySize: 2048 });
  return createHttpsServer({ key: pems.private, cert: pems.cert }, app);
}

const httpServer = await makeServer();
// Profile pictures make some messages bigger than the 1 MB default.
const io = new Server(httpServer, { maxHttpBufferSize: 2e6 });

// --- Real-time chat -------------------------------------------------------

const groupRoom = (groupId) => `group:${groupId}`;
const userRoom = (userId) => `user:${userId}`;
const onlineCount = new Map(); // userId -> number of open tabs/devices

const onlineIds = () => [...onlineCount.keys()];

// --- Voice calls ------------------------------------------------------------
// The server only keeps track of who is in which call and passes connection messages
// between browsers. The sound itself goes directly between the browsers (WebRTC).

const calls = new Map(); // groupId -> { startedAt, participants: Map<socketId, { userId, muted, deafened }> }

function callView(groupId) {
  const call = calls.get(groupId);
  if (!call) return { groupId, startedAt: null, participants: [] };
  return {
    groupId,
    startedAt: call.startedAt,
    participants: [...call.participants].map(([socketId, p]) => ({ socketId, ...p })),
  };
}

function sendCall(groupId) {
  io.to(groupRoom(groupId)).emit('call:state', callView(groupId));
}

// Takes one tab out of its call. The last one out ends the call and leaves a note in the chat.
function leaveCall(socket) {
  const groupId = socket.data.callId;
  if (!groupId) return;
  socket.data.callId = null;
  const call = calls.get(groupId);
  if (!call) return;
  call.participants.delete(socket.id);
  if (call.participants.size === 0) {
    calls.delete(groupId);
    const message = store.callEnded(groupId, Date.now() - call.startedAt);
    if (message) {
      io.to(groupRoom(groupId)).emit('message:new', { groupId, message });
      save();
    }
  }
  sendCall(groupId);
}

// Removes a person from a call wherever they are (e.g. they left the group, or joined from another tab).
function dropFromCall(groupId, userId, exceptSocketId) {
  const call = calls.get(groupId);
  if (!call) return;
  for (const [socketId, p] of call.participants) {
    if (p.userId !== userId || socketId === exceptSocketId) continue;
    const other = io.sockets.sockets.get(socketId);
    if (other) {
      leaveCall(other);
      other.emit('call:moved');
    }
  }
}

// Every connection says who it is. There are no passwords: this is a prototype.
io.use((socket, next) => {
  try {
    socket.data.userId = store.upsertUser(socket.handshake.auth?.user).id;
    save();
    next();
  } catch (err) {
    next(new Error(err instanceof StoreError ? err.message : 'Could not sign in.'));
  }
});

io.on('connection', (socket) => {
  const { userId } = socket.data;
  const groups = store.groupsFor(userId);

  socket.join(userRoom(userId));
  for (const group of groups) socket.join(groupRoom(group.id));

  onlineCount.set(userId, (onlineCount.get(userId) ?? 0) + 1);
  socket.emit('init', {
    me: publicUser(store.users[userId]),
    groups: groups.map((g) => store.view(g)),
    friends: store.friendsView(userId),
    calls: groups.filter((g) => calls.has(g.id)).map((g) => callView(g.id)),
    online: onlineIds(),
  });
  io.emit('presence', onlineIds());

  // Wraps a handler so it always answers the client with { ok, ... } or { ok: false, error }.
  function handle(event, handler) {
    socket.on(event, (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const result = handler(payload ?? {});
        save();
        reply({ ok: true, ...result });
      } catch (err) {
        if (!(err instanceof StoreError)) console.error(`Error in ${event}:`, err);
        reply({ ok: false, error: err instanceof StoreError ? err.message : 'Something went wrong.' });
      }
    });
  }

  // Puts all of a user's tabs in the group and sends them the full group (and its call, if there is one).
  function addUserToGroup(group, id = userId) {
    io.in(userRoom(id)).socketsJoin(groupRoom(group.id));
    io.to(userRoom(id)).emit('group:upsert', store.view(group));
    if (calls.has(group.id)) io.to(userRoom(id)).emit('call:state', callView(group.id));
  }

  // Sends each person their up-to-date friends, requests and sent requests.
  function sendFriends(...ids) {
    for (const id of ids) io.to(userRoom(id)).emit('friends', store.friendsView(id));
  }

  handle('profile:update', ({ displayName, color, avatar, status }) => {
    const user = store.updateProfile(userId, { displayName, color, avatar, status });
    io.emit('user:update', publicUser(user));
    return { me: publicUser(user) };
  });

  handle('group:create', ({ name }) => {
    const group = store.createGroup(userId, name);
    addUserToGroup(group);
    return { groupId: group.id };
  });

  handle('group:join', ({ code }) => {
    const { group, isNew, message } = store.joinGroup(userId, code);
    addUserToGroup(group);
    if (isNew) {
      const others = io.to(groupRoom(group.id)).except(userRoom(userId));
      others.emit('group:members', { groupId: group.id, members: store.view(group).members });
      others.emit('message:new', { groupId: group.id, message });
    }
    return { groupId: group.id };
  });

  handle('group:leave', ({ groupId }) => {
    const { group, deleted, message } = store.leaveGroup(userId, groupId);
    dropFromCall(groupId, userId);
    io.in(userRoom(userId)).socketsLeave(groupRoom(groupId));
    io.to(userRoom(userId)).emit('group:removed', { groupId });
    if (!deleted) {
      io.to(groupRoom(groupId)).emit('group:members', { groupId, members: store.view(group).members });
      io.to(groupRoom(groupId)).emit('message:new', { groupId, message });
    }
    return {};
  });

  handle('message:send', ({ groupId, text, attachment }) => {
    const message = store.addMessage(userId, groupId, text, attachment);
    io.to(groupRoom(groupId)).emit('message:new', { groupId, message });
    return {};
  });

  handle('reaction:toggle', ({ groupId, messageId, emoji }) => {
    const message = store.toggleReaction(userId, groupId, messageId, emoji);
    io.to(groupRoom(groupId)).emit('message:update', { groupId, message });
    return {};
  });

  // New friends get their direct message right away, so it's waiting for both of them.
  // It's sent before the friends update, so the other person's app already has it when they hear about it.
  function startDm(friendId) {
    const { group, isNew } = store.openDm(userId, friendId);
    if (isNew) for (const id of group.memberIds) addUserToGroup(group, id);
    return group.id;
  }

  handle('friend:add', ({ username, friendId }) => {
    const { status, user } = store.addFriend(userId, username !== undefined ? { username } : { friendId });
    const groupId = status === 'accepted' ? startDm(user.id) : undefined;
    sendFriends(userId, user.id);
    return { status, name: displayOf(user), groupId };
  });

  handle('friend:respond', ({ fromId, accept }) => {
    store.respondToRequest(userId, fromId, Boolean(accept));
    const groupId = accept ? startDm(fromId) : undefined;
    sendFriends(userId, fromId);
    return { groupId };
  });

  handle('group:add', ({ groupId, friendId }) => {
    const { group, message } = store.addToGroup(userId, groupId, friendId);
    const others = io.to(groupRoom(group.id)).except(userRoom(friendId));
    others.emit('group:members', { groupId: group.id, members: store.view(group).members });
    others.emit('message:new', { groupId: group.id, message });
    addUserToGroup(group, friendId);
    return {};
  });

  handle('friend:cancel', ({ friendId }) => {
    store.cancelRequest(userId, friendId);
    sendFriends(userId, friendId);
    return {};
  });

  handle('friend:remove', ({ friendId }) => {
    store.removeFriend(userId, friendId);
    sendFriends(userId, friendId);
    return {};
  });

  handle('dm:open', ({ friendId }) => {
    const { group, isNew } = store.openDm(userId, friendId);
    for (const id of isNew ? group.memberIds : [userId]) addUserToGroup(group, id);
    return { groupId: group.id };
  });

  // Joining a call answers with the tabs already in it. The newcomer then calls each of them.
  handle('call:join', ({ groupId, muted }) => {
    if (!store.isMember(userId, groupId)) throw new StoreError("You're not in that group.");
    if (socket.data.callId !== groupId) leaveCall(socket);
    dropFromCall(groupId, userId, socket.id); // only one tab per person in a call

    let call = calls.get(groupId);
    if (!call) {
      call = { startedAt: Date.now(), participants: new Map() };
      calls.set(groupId, call);
      const message = store.callStarted(userId, groupId);
      io.to(groupRoom(groupId)).emit('message:new', { groupId, message });
    }
    const peers = [...call.participants.keys()].filter((id) => id !== socket.id);
    call.participants.set(socket.id, { userId, muted: Boolean(muted), deafened: false });
    socket.data.callId = groupId;
    sendCall(groupId);
    return { peers };
  });

  socket.on('call:leave', () => leaveCall(socket));

  socket.on('call:update', ({ muted, deafened } = {}) => {
    const groupId = socket.data.callId;
    const me = groupId && calls.get(groupId)?.participants.get(socket.id);
    if (!me) return;
    me.muted = Boolean(muted);
    me.deafened = Boolean(deafened);
    sendCall(groupId);
  });

  // Connection offers, answers and network routes between two browsers in the same call.
  socket.on('call:signal', ({ to, data } = {}) => {
    const groupId = socket.data.callId;
    if (!groupId || !calls.get(groupId)?.participants.has(to)) return;
    io.to(to).emit('call:signal', { from: socket.id, data });
  });

  // Typing isn't saved, it's just passed on to the others in the group.
  socket.on('typing', ({ groupId } = {}) => {
    if (!store.isMember(userId, groupId)) return;
    socket.to(groupRoom(groupId)).except(userRoom(userId)).emit('typing', {
      groupId,
      userId,
      name: displayOf(store.users[userId]),
    });
  });

  socket.on('disconnect', () => {
    leaveCall(socket);
    const left = (onlineCount.get(userId) ?? 1) - 1;
    if (left > 0) onlineCount.set(userId, left);
    else onlineCount.delete(userId);
    io.emit('presence', onlineIds());
  });
});

httpServer.listen(PORT, () => {
  const scheme = HTTPS ? 'https' : 'http';
  console.log(`Gjeng is running on ${scheme}://localhost:${PORT}`);
  if (DEMO) {
    console.log('Demo mode: made-up people and chats, reset every time the server starts.');
    save();
  }
  const lanAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net?.family === 'IPv4' && !net.internal)
    .map((net) => `${scheme}://${net.address}:${PORT}`);
  if (lanAddresses.length) console.log(`On the same Wi-Fi, try: ${lanAddresses.join('  ')}`);
  if (HTTPS) console.log('The certificate is homemade, so browsers warn once. Choose "Advanced" and continue.');
  else if (lanAddresses.length) console.log('Voice calls on phones need https: run "npm run demo:https" instead.');
});
