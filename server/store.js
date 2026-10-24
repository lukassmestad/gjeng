import { randomInt, randomUUID } from 'node:crypto';
import {
  ATTACHMENT_MAX_BYTES,
  AVATAR_MAX_LENGTH,
  BANNER_MAX_LENGTH,
  BIO_MAX,
  COLORS,
  DISPLAY_NAME_MAX,
  INVITE_CODE_LENGTH,
  LIMITS,
  PRIVACY_OPTIONS,
  REACTIONS,
  STATUS_VALUES,
  USERNAME_PATTERN,
  USERNAME_RULES,
} from '../shared/constants.js';
import { findPreset } from '../shared/avatars.js';

// Only real pictures (the browser turns uploads into JPEG), never SVG or anything that could run code.
const AVATAR_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const BANNER_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/;
const FILE_PATTERN = /^data:([\w.+-]+\/[\w.+-]+)?(?:;[\w-]+=[\w.+-]+)*;base64,([A-Za-z0-9+/=]+)$/;
const MINUTE = 60 * 1000;

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

// What the client gets to see of a user. `name` is the unique username, `displayName` what people see.
// The banner picture is left out (it's big); it's sent only when someone opens your profile card.
export const publicUser = ({ id, name, displayName, color, avatar, status, bannerColor, bio }) => ({
  id,
  name,
  color,
  ...(displayName && { displayName }),
  ...(avatar && { avatar }),
  ...(status && status !== 'online' && { status }),
  ...(bannerColor && { bannerColor }),
  ...(bio && { bio }),
});

const DEFAULT_PRIVACY = {
  friendRequests: PRIVACY_OPTIONS.friendRequests[0],
  friendsVisibility: PRIVACY_OPTIONS.friendsVisibility[0],
  showOnline: true,
};

export const displayOf = (user) => user.displayName || user.name;

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// "a few seconds", "1 minute", "1 hour 5 minutes"
function duration(ms) {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 1) return 'a few seconds';
  if (minutes < 60) return plural(minutes, 'minute');
  const rest = minutes % 60;
  return plural(Math.floor(minutes / 60), 'hour') + (rest ? ` ${plural(rest, 'minute')}` : '');
}

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

// All chat data lives here. It's plain JSON so the server can save it to a file.
// A "group" is either a normal group (type 'group') or a direct message between two friends (type 'dm').
export class Store {
  constructor(data = {}) {
    this.users = data.users ?? {};
    this.groups = data.groups ?? {};
    this.friends = data.friends ?? {}; // userId -> ids of their friends
    this.requests = data.requests ?? {}; // userId -> ids of people who asked to be their friend
    this.files = data.files ?? {}; // fileId -> { groupId, mime, name, data } for pictures and files in messages
  }

  toJSON() {
    return { users: this.users, groups: this.groups, friends: this.friends, requests: this.requests, files: this.files };
  }

  // Signs someone in. New people are created; people we already know keep the profile saved here,
  // so an old copy in their browser can't undo a change they made.
  upsertUser({ id, name, color } = {}) {
    if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) throw new StoreError('Invalid user id.');
    if (this.users[id]) return this.users[id];
    const user = {
      id,
      name: this.#cleanUsername(name, id),
      color: COLORS.includes(color) ? color : COLORS[0],
      joinedAt: Date.now(),
    };
    this.users[id] = user;
    return user;
  }

  // Display name, colour, picture and status. The username can't change, since friends add you by it.
  updateProfile(userId, { displayName, color, avatar, status, bio, bannerColor, bannerImage } = {}) {
    const user = this.users[userId];
    if (status !== undefined) {
      if (!STATUS_VALUES.includes(status)) throw new StoreError('Unknown status.');
      if (status === 'online') delete user.status;
      else user.status = status;
    }
    if (displayName !== undefined) {
      const text = typeof displayName === 'string' ? displayName.trim() : '';
      if (Array.from(text).length > DISPLAY_NAME_MAX) {
        throw new StoreError(`Display names can be at most ${DISPLAY_NAME_MAX} characters.`);
      }
      if (text) user.displayName = text;
      else delete user.displayName;
    }
    if (color !== undefined) {
      if (!COLORS.includes(color)) throw new StoreError('Unknown colour.');
      user.color = color;
    }
    if (avatar !== undefined) {
      if (avatar === null) delete user.avatar;
      else if (findPreset(avatar)) user.avatar = avatar;
      else if (typeof avatar !== 'string' || !AVATAR_PATTERN.test(avatar)) throw new StoreError("That picture can't be used.");
      else if (avatar.length > AVATAR_MAX_LENGTH) throw new StoreError('That picture is too big.');
      else user.avatar = avatar;
    }
    if (bio !== undefined) {
      const text = typeof bio === 'string' ? bio.trim() : '';
      if (Array.from(text).length > BIO_MAX) throw new StoreError(`"About me" can be at most ${BIO_MAX} characters.`);
      if (text) user.bio = text;
      else delete user.bio;
    }
    if (bannerColor !== undefined) {
      if (bannerColor === null) delete user.bannerColor;
      else if (!HEX_COLOR.test(bannerColor)) throw new StoreError('Unknown banner colour.');
      else user.bannerColor = bannerColor.toLowerCase();
    }
    if (bannerImage !== undefined) {
      if (bannerImage === null) delete user.bannerImage;
      else if (typeof bannerImage !== 'string' || !BANNER_PATTERN.test(bannerImage)) throw new StoreError("That banner can't be used.");
      else if (bannerImage.length > BANNER_MAX_LENGTH) throw new StoreError('That banner is too big.');
      else user.bannerImage = bannerImage;
    }
    return user;
  }

  // --- Privacy --------------------------------------------------------------

  privacyOf(userId) {
    return { ...DEFAULT_PRIVACY, ...this.users[userId]?.privacy };
  }

  updatePrivacy(userId, { friendRequests, friendsVisibility, showOnline } = {}) {
    const privacy = this.privacyOf(userId);
    if (friendRequests !== undefined) {
      if (!PRIVACY_OPTIONS.friendRequests.includes(friendRequests)) throw new StoreError('Unknown privacy choice.');
      privacy.friendRequests = friendRequests;
    }
    if (friendsVisibility !== undefined) {
      if (!PRIVACY_OPTIONS.friendsVisibility.includes(friendsVisibility)) throw new StoreError('Unknown privacy choice.');
      privacy.friendsVisibility = friendsVisibility;
    }
    if (showOnline !== undefined) privacy.showOnline = Boolean(showOnline);
    this.users[userId].privacy = privacy;
    return privacy;
  }

  // Whether others should see this person as online (they can choose to always look offline).
  showsOnline(userId) {
    return this.privacyOf(userId).showOnline;
  }

  mutualFriends(a, b) {
    const theirs = new Set(this.friends[b] ?? []);
    return (this.friends[a] ?? []).filter((id) => theirs.has(id));
  }

  // Can `viewerId` see who `ownerId`'s friends are? Follows the owner's privacy choice.
  canSeeFriends(viewerId, ownerId) {
    if (viewerId === ownerId) return true;
    switch (this.privacyOf(ownerId).friendsVisibility) {
      case 'everyone':
        return true;
      case 'friends':
        return this.areFriends(viewerId, ownerId);
      case 'friends-of-friends':
        return this.areFriends(viewerId, ownerId) || this.mutualFriends(viewerId, ownerId).length > 0;
      default:
        return false;
    }
  }

  // What you see when you open someone's profile card.
  profileFor(viewerId, userId) {
    const user = this.users[userId];
    if (!user) throw new StoreError('User not found.');
    let relation = null;
    if (viewerId === userId) relation = 'self';
    else if (this.areFriends(viewerId, userId)) relation = 'friend';
    else if (this.#incoming(viewerId).includes(userId)) relation = 'incoming';
    else if (this.#incoming(userId).includes(viewerId)) relation = 'outgoing';

    const sharedGroups = Object.values(this.groups)
      .filter((g) => g.type !== 'dm' && g.memberIds.includes(viewerId) && g.memberIds.includes(userId))
      .map((g) => ({ id: g.id, name: g.name }));
    const canSee = this.canSeeFriends(viewerId, userId);
    return {
      user: publicUser(user),
      bio: user.bio ?? '',
      bannerImage: user.bannerImage ?? null,
      joinedAt: user.joinedAt ?? null,
      relation,
      sharedGroups,
      // null means "hidden by their privacy settings"
      mutualFriends:
        viewerId === userId || !canSee ? null : this.mutualFriends(viewerId, userId).map((id) => publicUser(this.users[id])),
      friendCount: canSee ? (this.friends[userId] ?? []).length : null,
    };
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
    this.#addSystem(group, `${displayOf(this.users[userId])} created the group`);
    return group;
  }

  joinGroup(userId, code) {
    const wanted = String(code ?? '').trim().toUpperCase();
    const group = Object.values(this.groups).find((g) => g.type !== 'dm' && g.code === wanted);
    if (!group) throw new StoreError('No group has that invite code.');
    if (group.memberIds.includes(userId)) return { group, isNew: false };
    group.memberIds.push(userId);
    const message = this.#addSystem(group, `${displayOf(this.users[userId])} joined the group`);
    return { group, isNew: true, message };
  }

  // Members can pull their friends straight into a group, no invite code needed.
  addToGroup(userId, groupId, friendId) {
    const group = this.#memberGroup(userId, groupId);
    if (group.type === 'dm') throw new StoreError("You can't add people to a direct message.");
    if (!this.areFriends(userId, friendId)) throw new StoreError('You can only add your friends.');
    if (group.memberIds.includes(friendId)) throw new StoreError(`${displayOf(this.users[friendId])} is already in the group.`);
    group.memberIds.push(friendId);
    const message = this.#addSystem(group, `${displayOf(this.users[userId])} added ${displayOf(this.users[friendId])}`);
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
    const message = this.#addSystem(group, `${displayOf(this.users[userId])} left the group`);
    return { group, deleted: false, message };
  }

  // --- Messages -------------------------------------------------------------

  // A message has text, an attachment (picture or file), or both.
  addMessage(userId, groupId, text, attachment) {
    const group = this.#memberGroup(userId, groupId);
    if (group.type === 'dm') {
      const otherId = group.memberIds.find((id) => id !== userId);
      if (!this.areFriends(userId, otherId)) {
        throw new StoreError(`You're no longer friends with ${displayOf(this.users[otherId])}.`);
      }
    }
    const hasText = typeof text === 'string' && text.trim() !== '';
    const body = hasText || !attachment ? cleanText(text, LIMITS.message, 'Message') : '';
    const file = attachment ? this.#saveFile(groupId, attachment) : undefined;

    // Name and colour are saved with the message, for when the author has since left the group.
    const author = this.users[userId];
    return this.#push(group, {
      id: randomUUID(),
      type: 'user',
      userId,
      name: displayOf(author),
      color: author.color,
      text: body,
      ...(file && { attachment: file }),
      ts: Date.now(),
      reactions: {},
    });
  }

  // For the download link. Pictures show in the chat; other files are always downloaded, never opened.
  getFile(fileId) {
    return this.files[fileId] ?? null;
  }

  // Calls themselves live on the server only while they're happening; these leave a note in the chat.
  callStarted(userId, groupId) {
    const group = this.#memberGroup(userId, groupId);
    return this.#addSystem(group, `${displayOf(this.users[userId])} started a call`, 'call');
  }

  callEnded(groupId, ms) {
    const group = this.groups[groupId];
    if (!group) return null;
    return this.#addSystem(group, `Call ended after ${duration(ms)}`, 'call');
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
    if (this.areFriends(fromId, target.id)) throw new StoreError(`You're already friends with ${displayOf(target)}.`);

    // They already asked us, so asking back means yes.
    if (this.#incoming(fromId).includes(target.id)) {
      this.#befriend(fromId, target.id);
      return { status: 'accepted', user: target };
    }
    if (this.#incoming(target.id).includes(fromId)) throw new StoreError(`You already sent ${displayOf(target)} a request.`);

    // Their privacy settings decide who may ask.
    const { friendRequests } = this.privacyOf(target.id);
    if (friendRequests === 'nobody') throw new StoreError(`${displayOf(target)} isn't accepting friend requests.`);
    if (friendRequests === 'friends-of-friends' && this.mutualFriends(fromId, target.id).length === 0) {
      throw new StoreError(`${displayOf(target)} only accepts requests from friends of friends.`);
    }
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

  // Checks an attachment and keeps it apart from the message, which only gets a link to it.
  #saveFile(groupId, { kind, name, data, width, height } = {}) {
    const pattern = kind === 'image' ? IMAGE_PATTERN : kind === 'file' ? FILE_PATTERN : null;
    const match = pattern && typeof data === 'string' ? pattern.exec(data) : null;
    if (!match) throw new StoreError("That file can't be sent.");
    const base64 = match[2];
    const size = Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    if (size > ATTACHMENT_MAX_BYTES) throw new StoreError(`Files can be at most ${ATTACHMENT_MAX_BYTES / 1_000_000} MB.`);

    const fileName = (typeof name === 'string' ? name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') : '').slice(0, 100);
    const id = randomUUID();
    const mime = kind === 'image' ? `image/${match[1]}` : 'application/octet-stream';
    this.files[id] = { groupId, mime, name: fileName || (kind === 'image' ? 'picture.jpg' : 'file'), data: base64 };
    return {
      kind,
      url: `/api/files/${id}`,
      name: this.files[id].name,
      size,
      ...(kind === 'image' && { width: Math.round(width) || null, height: Math.round(height) || null }),
    };
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

  // `kind` lets the app pick an icon, e.g. a phone for call notes.
  #addSystem(group, text, kind) {
    return this.#push(group, { id: randomUUID(), type: 'system', ...(kind && { kind }), text, ts: Date.now() });
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
