import { randomInt, randomUUID } from 'node:crypto';
import { COLORS, INVITE_CODE_LENGTH, LIMITS, REACTIONS } from '../shared/constants.js';

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

// All chat data lives here. It's plain JSON so the server can save it to a file.
export class Store {
  constructor(data = {}) {
    this.users = data.users ?? {};
    this.groups = data.groups ?? {};
  }

  toJSON() {
    return { users: this.users, groups: this.groups };
  }

  upsertUser({ id, name, color } = {}) {
    if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) throw new StoreError('Invalid user id.');
    const user = {
      id,
      name: cleanText(name, LIMITS.userName, 'Name'),
      color: COLORS.includes(color) ? color : COLORS[0],
    };
    this.users[id] = user;
    return user;
  }

  createGroup(userId, name) {
    const group = {
      id: randomUUID(),
      name: cleanText(name, LIMITS.groupName, 'Group name'),
      code: this.#newCode(),
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
    const group = Object.values(this.groups).find((g) => g.code === wanted);
    if (!group) throw new StoreError('No group has that invite code.');
    if (group.memberIds.includes(userId)) return { group, isNew: false };
    group.memberIds.push(userId);
    const message = this.#addSystem(group, `${this.users[userId].name} joined the group`);
    return { group, isNew: true, message };
  }

  leaveGroup(userId, groupId) {
    const group = this.#memberGroup(userId, groupId);
    group.memberIds = group.memberIds.filter((id) => id !== userId);
    if (group.memberIds.length === 0) {
      delete this.groups[groupId];
      return { group, deleted: true };
    }
    const message = this.#addSystem(group, `${this.users[userId].name} left the group`);
    return { group, deleted: false, message };
  }

  addMessage(userId, groupId, text) {
    const group = this.#memberGroup(userId, groupId);
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
      name: group.name,
      code: group.code,
      members: group.memberIds.map((id) => this.users[id]).filter(Boolean),
      messages: group.messages,
    };
  }

  #memberGroup(userId, groupId) {
    if (!this.isMember(userId, groupId)) throw new StoreError("You're not in that group.");
    return this.groups[groupId];
  }

  #addSystem(group, text) {
    return this.#push(group, { id: randomUUID(), type: 'system', text, ts: Date.now() });
  }

  #push(group, message) {
    group.messages.push(message);
    if (group.messages.length > LIMITS.history) group.messages.splice(0, group.messages.length - LIMITS.history);
    return message;
  }

  #newCode() {
    const taken = new Set(Object.values(this.groups).map((g) => g.code));
    let code;
    do {
      code = Array.from({ length: INVITE_CODE_LENGTH }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
    } while (taken.has(code));
    return code;
  }
}
