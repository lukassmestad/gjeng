import { randomInt, randomUUID } from 'node:crypto';
import { COLORS, INVITE_CODE_LENGTH, LIMITS, REACTIONS, USERNAME_PATTERN, USERNAME_RULES } from '../shared/constants.js';

// No 0/O or 1/I, so codes are easy to read out loud.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Errors meant to be shown to the user (bad input, not a member, ...).
export class StoreError extends Error {}

function cleanText(value, max, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new StoreError(`${label} can't be empty.`);
  if (text.length > max) throw new StoreError(`${label} can be at most ${max} characters.`);
  return text;
}

// What the client gets to see of a user.
const publicUser = ({ id, name, color }) => ({ id, name, color });

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

// All chat data lives here. It's plain JSON so the server can save it to a file.
// A "group" is either a normal group (type 'group') or a direct message between two friends (type 'dm').
export class Store {
  constructor(data = {}) {
    this.users = data.users ?? {};
    this.groups = data.groups ?? {};
    this.friends = data.friends ?? {}; // userId -> ids of their friends
    this.requests = data.requests ?? {}; // userId -> ids of people who asked to be their friend
  }

  toJSON() {
    return { users: this.users, groups: this.groups, friends: this.friends, requests: this.requests };
  }

  upsertUser({ id, name, color } = {}) {
    if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) throw new StoreError('Invalid user id.');
    const user = {
      id,
      name: this.#cleanUsername(name, id),
      color: COLORS.includes(color) ? color : COLORS[0],
    };
    if (this.users[id]?.demo) user.demo = true;
    this.users[id] = user;
    return user;
  }

  // The made-up people from "npm run demo", for the join screen.
  demoUsers() {
    return Object.values(this.users).filter((u) => u.demo).map(publicUser);
  }

  // For the join screen, so it can say "taken" before you try. `id` is you, if you already have a name.
  checkUsername(name, id) {
    try {
      this.#cleanUsername(name, id);
      return { available: true };
    } catch (err) {
      if (err instanceof StoreError) return { available: false, error: err.message };
      throw err;
    }
  }

  findByUsername(name) {
    const wanted = String(name ?? '').trim();
    return Object.values(this.users).find((u) => sameName(u.name, wanted));
  }

  // --- Groups ---------------------------------------------------------------

  createGroup(userId, name) {
    const group = {
      id: randomUUID(),
      type: 'group',
      name: cleanText(name, LIMITS.groupName, 'Group name'),
      code: this.#newCode(Object.values(this.groups).map((g) => g.code)),
      memberIds: [userId],
      messages: [],
      createdAt: Date.now(),
    };
    this.groups[group.id] = group;
    this.#addSystem(group, `${this.users[userId].name} created the group`);
    return group;
  }

  joinGroup(userId, code) {
    const wanted = String(code ?? '').trim().toUpperCase();
    const group = Object.values(this.groups).find((g) => g.type !== 'dm' && g.code === wanted);
    if (!group) throw new StoreError('No group has that invite code.');
    if (group.memberIds.includes(userId)) return { group, isNew: false };
    group.memberIds.push(userId);
    const message = this.#addSystem(group, `${this.users[userId].name} joined the group`);
    return { group, isNew: true, message };
  }

  // Members can pull their friends straight into a group, no invite code needed.
  addToGroup(userId, groupId, friendId) {
    const group = this.#memberGroup(userId, groupId);
    if (group.type === 'dm') throw new StoreError("You can't add people to a direct message.");
    if (!this.areFriends(userId, friendId)) throw new StoreError('You can only add your friends.');
    if (group.memberIds.includes(friendId)) throw new StoreError(`${this.users[friendId].name} is already in the group.`);
    group.memberIds.push(friendId);
    const message = this.#addSystem(group, `${this.users[userId].name} added ${this.users[friendId].name}`);
    return { group, message };
  }

  leaveGroup(userId, groupId) {
    const group = this.#memberGroup(userId, groupId);
    if (group.type === 'dm') throw new StoreError("You can't leave a direct message.");
    group.memberIds = group.memberIds.filter((id) => id !== userId);
    if (group.memberIds.length === 0) {
      delete this.groups[groupId];
      return { group, deleted: true };
    }
    const message = this.#addSystem(group, `${this.users[userId].name} left the group`);
    return { group, deleted: false, message };
  }

  // --- Messages -------------------------------------------------------------

  addMessage(userId, groupId, text) {
    const group = this.#memberGroup(userId, groupId);
    if (group.type === 'dm') {
      const otherId = group.memberIds.find((id) => id !== userId);
      if (!this.areFriends(userId, otherId)) {
        throw new StoreError(`You're no longer friends with ${this.users[otherId].name}.`);
      }
    }
    const { name, color } = this.users[userId];
    return this.#push(group, {
      id: randomUUID(),
      type: 'user',
      userId,
      name,
      color,
      text: cleanText(text, LIMITS.message, 'Message'),
      ts: Date.now(),
      reactions: {},
    });
  }

  toggleReaction(userId, groupId, messageId, emoji) {
    const group = this.#memberGroup(userId, groupId);
    if (!REACTIONS.includes(emoji)) throw new StoreError('Unknown reaction.');
    const message = group.messages.find((m) => m.id === messageId && m.type === 'user');
    if (!message) throw new StoreError('Message not found.');
    const reactedBy = message.reactions[emoji] ?? [];
    const next = reactedBy.includes(userId) ? reactedBy.filter((id) => id !== userId) : [...reactedBy, userId];
    if (next.length) message.reactions[emoji] = next;
    else delete message.reactions[emoji];
    return message;
  }

  // --- Friends --------------------------------------------------------------

  areFriends(a, b) {
    return (this.friends[a] ?? []).includes(b);
  }

  // Find the other person either by username or by id (the "Add friend" button in a group).
  addFriend(fromId, { username, friendId } = {}) {
    const target = username !== undefined ? this.findByUsername(username) : this.users[friendId];
    if (!target) throw new StoreError(username !== undefined ? 'No one has that username.' : 'User not found.');
    if (target.id === fromId) throw new StoreError("You can't add yourself.");
    if (this.areFriends(fromId, target.id)) throw new StoreError(`You're already friends with ${target.name}.`);

    // They already asked us, so asking back means yes.
    if (this.#incoming(fromId).includes(target.id)) {
      this.#befriend(fromId, target.id);
      return { status: 'accepted', user: target };
    }
    if (this.#incoming(target.id).includes(fromId)) throw new StoreError(`You already sent ${target.name} a request.`);
    this.requests[target.id] = [...this.#incoming(target.id), fromId];
    return { status: 'sent', user: target };
  }

  respondToRequest(userId, fromId, accept) {
    if (!this.#incoming(userId).includes(fromId)) throw new StoreError('That friend request is no longer there.');
    if (accept) this.#befriend(userId, fromId);
    else this.requests[userId] = this.#incoming(userId).filter((id) => id !== fromId);
  }

  cancelRequest(fromId, toId) {
    if (!this.#incoming(toId).includes(fromId)) throw new StoreError('That friend request is no longer there.');
    this.requests[toId] = this.#incoming(toId).filter((id) => id !== fromId);
  }

  removeFriend(userId, friendId) {
    if (!this.areFriends(userId, friendId)) throw new StoreError("You're not friends.");
    this.friends[userId] = this.friends[userId].filter((id) => id !== friendId);
    this.friends[friendId] = (this.friends[friendId] ?? []).filter((id) => id !== userId);
  }

  friendsView(userId) {
    const people = (ids) => ids.map((id) => this.users[id]).filter(Boolean).map(publicUser);
    const outgoing = Object.keys(this.requests).filter((toId) => this.#incoming(toId).includes(userId));
    return {
      friends: people(this.friends[userId] ?? []),
      incoming: people(this.#incoming(userId)),
      outgoing: people(outgoing),
    };
  }

  // Direct messages reuse groups: a 'dm' group with exactly the two friends in it.
  openDm(userId, friendId) {
    if (!this.areFriends(userId, friendId)) throw new StoreError('You can only message your friends.');
    const existing = Object.values(this.groups).find(
      (g) => g.type === 'dm' && g.memberIds.includes(userId) && g.memberIds.includes(friendId),
    );
    if (existing) return { group: existing, isNew: false };
    const group = {
      id: randomUUID(),
      type: 'dm',
      name: '',
      code: null,
      memberIds: [userId, friendId],
      messages: [],
      createdAt: Date.now(),
    };
    this.groups[group.id] = group;
    return { group, isNew: true };
  }

  // --- Lookups --------------------------------------------------------------

  isMember(userId, groupId) {
    return Boolean(this.groups[groupId]?.memberIds.includes(userId));
  }

  groupsFor(userId) {
    return Object.values(this.groups).filter((g) => g.memberIds.includes(userId));
  }

  // What the client gets to see of a group.
  view(group) {
    return {
      id: group.id,
      type: group.type ?? 'group',
      name: group.name,
      code: group.code,
      members: group.memberIds.map((id) => this.users[id]).filter(Boolean).map(publicUser),
      messages: group.messages,
    };
  }

  #memberGroup(userId, groupId) {
    if (!this.isMember(userId, groupId)) throw new StoreError("You're not in that group.");
    return this.groups[groupId];
  }

  #incoming(userId) {
    return this.requests[userId] ?? [];
  }

  #cleanUsername(value, id) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!USERNAME_PATTERN.test(name)) throw new StoreError(USERNAME_RULES);
    const owner = this.findByUsername(name);
    if (owner && owner.id !== id) throw new StoreError(`"${name}" is already taken.`);
    return name;
  }

  #befriend(a, b) {
    for (const [me, other] of [
      [a, b],
      [b, a],
    ]) {
      if (!this.areFriends(me, other)) this.friends[me] = [...(this.friends[me] ?? []), other];
      this.requests[me] = this.#incoming(me).filter((id) => id !== other);
    }
  }

  #addSystem(group, text) {
    return this.#push(group, { id: randomUUID(), type: 'system', text, ts: Date.now() });
  }

  #push(group, message) {
    group.messages.push(message);
    if (group.messages.length > LIMITS.history) group.messages.splice(0, group.messages.length - LIMITS.history);
    return message;
  }

  #newCode(existing) {
    const taken = new Set(existing);
    let code;
    do {
      code = Array.from({ length: INVITE_CODE_LENGTH }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
    } while (taken.has(code));
    return code;
  }
}
