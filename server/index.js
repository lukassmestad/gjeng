import express from 'express';
import fs from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { Store, StoreError } from './store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.resolve(process.env.DATA_FILE || path.join(root, 'data', 'gjeng.json'));
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

const store = new Store(loadData());
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
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
} else {
  app.get('/', (_req, res) => {
    res.send('No build found. Run "npm run build" first, or use "npm run dev" and open http://localhost:5173.');
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer);

// --- Real-time chat -------------------------------------------------------

const groupRoom = (groupId) => `group:${groupId}`;
const userRoom = (userId) => `user:${userId}`;
const onlineCount = new Map(); // userId -> number of open tabs/devices

const onlineIds = () => [...onlineCount.keys()];

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
  socket.emit('init', { me: store.users[userId], groups: groups.map((g) => store.view(g)), online: onlineIds() });
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

  // Puts all of this user's tabs in the group and sends them the full group.
  function addUserToGroup(group) {
    io.in(userRoom(userId)).socketsJoin(groupRoom(group.id));
    io.to(userRoom(userId)).emit('group:upsert', store.view(group));
  }

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
    io.in(userRoom(userId)).socketsLeave(groupRoom(groupId));
    io.to(userRoom(userId)).emit('group:removed', { groupId });
    if (!deleted) {
      io.to(groupRoom(groupId)).emit('group:members', { groupId, members: store.view(group).members });
      io.to(groupRoom(groupId)).emit('message:new', { groupId, message });
    }
    return {};
  });

  handle('message:send', ({ groupId, text }) => {
    const message = store.addMessage(userId, groupId, text);
    io.to(groupRoom(groupId)).emit('message:new', { groupId, message });
    return {};
  });

  handle('reaction:toggle', ({ groupId, messageId, emoji }) => {
    const message = store.toggleReaction(userId, groupId, messageId, emoji);
    io.to(groupRoom(groupId)).emit('message:update', { groupId, message });
    return {};
  });

  // Typing isn't saved, it's just passed on to the others in the group.
  socket.on('typing', ({ groupId } = {}) => {
    if (!store.isMember(userId, groupId)) return;
    socket.to(groupRoom(groupId)).except(userRoom(userId)).emit('typing', {
      groupId,
      userId,
      name: store.users[userId].name,
    });
  });

  socket.on('disconnect', () => {
    const left = (onlineCount.get(userId) ?? 1) - 1;
    if (left > 0) onlineCount.set(userId, left);
    else onlineCount.delete(userId);
    io.emit('presence', onlineIds());
  });
});

httpServer.listen(PORT, () => {
  console.log(`Gjeng is running on http://localhost:${PORT}`);
  const lanAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net?.family === 'IPv4' && !net.internal)
    .map((net) => `http://${net.address}:${PORT}`);
  if (lanAddresses.length) console.log(`On the same Wi-Fi, try: ${lanAddresses.join('  ')}`);
});
