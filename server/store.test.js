import { beforeEach, describe, expect, it } from 'vitest';
import { COLORS, LIMITS } from '../shared/constants.js';
import { Store, StoreError } from './store.js';

const ada = { id: 'user-ada-0001', name: 'Ada', color: COLORS[1] };
const bo = { id: 'user-bo-00002', name: 'Bo', color: COLORS[4] };

let store;

beforeEach(() => {
  store = new Store();
  store.upsertUser(ada);
  store.upsertUser(bo);
});

describe('users', () => {
  it('trims names and falls back to the first colour for unknown colours', () => {
    const user = store.upsertUser({ id: 'user-cy-00003', name: '  Cy  ', color: 'hotpink' });
    expect(user).toMatchObject({ id: 'user-cy-00003', name: 'Cy', color: COLORS[0] });
  });

  it('keeps usernames unique, ignoring upper/lower case', () => {
    expect(() => store.upsertUser({ id: 'user-x-000001', name: 'ADA' })).toThrow('"ADA" is already taken.');
    expect(store.checkUsername('ada')).toEqual({ available: false, error: '"ada" is already taken.' });
    expect(store.checkUsername('Ada', ada.id)).toEqual({ available: true });
    expect(store.checkUsername('Ingrid')).toEqual({ available: true });
  });

  it('keeps your saved profile when you reconnect, even if the browser has an old copy', () => {
    store.updateProfile(ada.id, { displayName: 'Ada L.', color: COLORS[5] });
    const again = store.upsertUser({ ...ada, name: 'something-else', color: COLORS[0] });
    expect(again).toMatchObject({ name: 'Ada', displayName: 'Ada L.', color: COLORS[5] });
    expect(store.checkUsername('Ada', ada.id)).toEqual({ available: true });
  });

  it('only allows usernames you can type: no spaces, 2–20 characters, Norwegian letters are fine', () => {
    expect(store.upsertUser({ id: 'user-x-000001', name: 'Bjørn.Ærlig_2' }).name).toBe('Bjørn.Ærlig_2');
    for (const bad of ['Ada Lovelace', 'x', 'a'.repeat(21), 'hi!', '<b>']) {
      expect(store.checkUsername(bad).available).toBe(false);
    }
  });

  it('rejects empty and too long names', () => {
    expect(() => store.upsertUser({ id: 'user-x-000001', name: '   ' })).toThrow(StoreError);
    expect(() => store.upsertUser({ id: 'user-x-000001', name: 'x'.repeat(LIMITS.userName + 1) })).toThrow(StoreError);
  });

  it('rejects missing or odd ids', () => {
    expect(() => store.upsertUser({ name: 'No id' })).toThrow(StoreError);
    expect(() => store.upsertUser({ id: '../../etc', name: 'Sneaky' })).toThrow(StoreError);
  });
});

describe('profiles', () => {
  const picture = `data:image/jpeg;base64,${'A'.repeat(100)}`;

  it('sets and clears a display name, which is what people see', () => {
    store.updateProfile(ada.id, { displayName: '  Ada Lovelace 💻 ' });
    expect(store.users[ada.id]).toMatchObject({ name: 'Ada', displayName: 'Ada Lovelace 💻' });
    const group = store.createGroup(ada.id, 'Maths');
    expect(group.messages[0].text).toBe('Ada Lovelace 💻 created the group');
    expect(store.addMessage(ada.id, group.id, 'hi').name).toBe('Ada Lovelace 💻');

    store.updateProfile(ada.id, { displayName: '' });
    expect(store.users[ada.id].displayName).toBeUndefined();
  });

  it('allows display names that are not unique, but not too long', () => {
    store.updateProfile(bo.id, { displayName: 'Ada' });
    expect(store.users[bo.id].displayName).toBe('Ada');
    expect(() => store.updateProfile(bo.id, { displayName: 'x'.repeat(33) })).toThrow('at most 32');
  });

  it('accepts real pictures and removes them again', () => {
    store.updateProfile(ada.id, { avatar: picture });
    expect(store.users[ada.id].avatar).toBe(picture);
    store.updateProfile(ada.id, { avatar: null });
    expect(store.users[ada.id].avatar).toBeUndefined();
  });

  it('refuses pictures that are not photos or are too big', () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg onload="alert(1)"/>').toString('base64')}`;
    expect(() => store.updateProfile(ada.id, { avatar: svg })).toThrow("That picture can't be used.");
    expect(() => store.updateProfile(ada.id, { avatar: 'https://example.com/me.jpg' })).toThrow("can't be used");
    expect(() => store.updateProfile(ada.id, { avatar: `data:image/jpeg;base64,${'A'.repeat(200_001)}` })).toThrow(
      'too big',
    );
  });

  it('shows pictures and display names to others, but never the demo flag', () => {
    store.updateProfile(ada.id, { displayName: 'Ada L.', avatar: picture });
    store.users[ada.id].demo = true;
    const group = store.createGroup(ada.id, 'Maths');
    expect(store.view(group).members[0]).toEqual({
      id: ada.id,
      name: 'Ada',
      displayName: 'Ada L.',
      color: ada.color,
      avatar: picture,
    });
  });
});

describe('status', () => {
  it('can be away or do-not-disturb, and only shows when it is not plain online', () => {
    store.updateProfile(ada.id, { status: 'dnd' });
    const group = store.createGroup(ada.id, 'Maths');
    expect(store.view(group).members[0].status).toBe('dnd');
    store.updateProfile(ada.id, { status: 'online' });
    expect(store.view(group).members[0].status).toBeUndefined();
    expect(() => store.updateProfile(ada.id, { status: 'invisible' })).toThrow('Unknown status.');
  });
});

describe('attachments', () => {
  let group;
  const base64 = (text) => Buffer.from(text).toString('base64');

  beforeEach(() => {
    group = store.createGroup(ada.id, 'Photos');
  });

  it('stores a picture apart from the message and links to it', () => {
    const data = `data:image/jpeg;base64,${base64('fake jpeg bytes')}`;
    const message = store.addMessage(ada.id, group.id, '', { kind: 'image', name: 'gym.jpg', data, width: 800, height: 600 });
    expect(message.text).toBe('');
    expect(message.attachment).toMatchObject({ kind: 'image', name: 'gym.jpg', size: 15, width: 800, height: 600 });
    const file = store.getFile(message.attachment.url.split('/').pop());
    expect(file).toMatchObject({ mime: 'image/jpeg', name: 'gym.jpg' });
    expect(Buffer.from(file.data, 'base64').toString()).toBe('fake jpeg bytes');
  });

  it('keeps any other file as a download, with a safe file name', () => {
    const data = `data:application/pdf;base64,${base64('%PDF')}`;
    const message = store.addMessage(ada.id, group.id, 'Notes!', { kind: 'file', name: '../../notes?.pdf', data });
    expect(message.text).toBe('Notes!');
    expect(store.getFile(message.attachment.url.split('/').pop())).toMatchObject({
      mime: 'application/octet-stream',
      name: '.._.._notes_.pdf',
    });
  });

  it('refuses fake pictures, huge files and empty messages', () => {
    const svg = `data:image/svg+xml;base64,${base64('<svg/>')}`;
    expect(() => store.addMessage(ada.id, group.id, '', { kind: 'image', data: svg })).toThrow("can't be sent");
    const huge = `data:application/zip;base64,${'A'.repeat(1_400_000)}`;
    expect(() => store.addMessage(ada.id, group.id, '', { kind: 'file', name: 'big.zip', data: huge })).toThrow('at most 1 MB');
    expect(() => store.addMessage(ada.id, group.id, '  ')).toThrow("can't be empty");
  });
});

describe('call notes in the chat', () => {
  it('says who started a call and how long it lasted', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    expect(store.callStarted(ada.id, group.id)).toMatchObject({ kind: 'call', text: 'Ada started a call' });
    expect(store.callEnded(group.id, 20_000).text).toBe('Call ended after a few seconds');
    expect(store.callEnded(group.id, 3 * 60_000).text).toBe('Call ended after 3 minutes');
    expect(store.callEnded(group.id, 65 * 60_000).text).toBe('Call ended after 1 hour 5 minutes');
  });

  it('only lets members start a call', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    expect(() => store.callStarted(bo.id, group.id)).toThrow("You're not in that group.");
  });
});

describe('groups', () => {
  it('creates a group with a readable invite code and a system message', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    expect(group.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(group.memberIds).toEqual([ada.id]);
    expect(group.messages[0]).toMatchObject({ type: 'system', text: 'Ada created the group' });
  });

  it('gives every group a different code', () => {
    const codes = new Set(Array.from({ length: 200 }, (_, i) => store.createGroup(ada.id, `G${i}`).code));
    expect(codes.size).toBe(200);
  });

  it('lets someone join with the code, in any letter case', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    const result = store.joinGroup(bo.id, ` ${group.code.toLowerCase()} `);
    expect(result.isNew).toBe(true);
    expect(result.message.text).toBe('Bo joined the group');
    expect(store.view(group).members.map((m) => m.name)).toEqual(['Ada', 'Bo']);
  });

  it('does nothing when a member joins again', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    store.joinGroup(bo.id, group.code);
    expect(store.joinGroup(bo.id, group.code).isNew).toBe(false);
    expect(group.memberIds).toHaveLength(2);
  });

  it('rejects a wrong code', () => {
    expect(() => store.joinGroup(bo.id, 'NOPE00')).toThrow('No group has that invite code.');
  });

  it('removes people who leave, and deletes the group when the last one leaves', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    store.joinGroup(bo.id, group.code);

    const first = store.leaveGroup(ada.id, group.id);
    expect(first.deleted).toBe(false);
    expect(first.message.text).toBe('Ada left the group');

    expect(store.leaveGroup(bo.id, group.id).deleted).toBe(true);
    expect(store.groups[group.id]).toBeUndefined();
  });

  it('only lists the groups you are in', () => {
    store.createGroup(ada.id, 'Ada only');
    const shared = store.createGroup(ada.id, 'Shared');
    store.joinGroup(bo.id, shared.code);
    expect(store.groupsFor(bo.id).map((g) => g.name)).toEqual(['Shared']);
  });
});

describe('messages', () => {
  let group;

  beforeEach(() => {
    group = store.createGroup(ada.id, 'Gym crew');
    store.joinGroup(bo.id, group.code);
  });

  it('stores the text with the author name and colour', () => {
    const message = store.addMessage(bo.id, group.id, '  Leg day tomorrow?  ');
    expect(message).toMatchObject({ type: 'user', userId: bo.id, name: 'Bo', color: bo.color, text: 'Leg day tomorrow?' });
  });

  it('blocks people who are not in the group', () => {
    const outsider = store.upsertUser({ id: 'user-cy-00003', name: 'Cy' });
    expect(() => store.addMessage(outsider.id, group.id, 'hi')).toThrow("You're not in that group.");
  });

  it('rejects empty and too long messages', () => {
    expect(() => store.addMessage(ada.id, group.id, '   ')).toThrow(StoreError);
    expect(() => store.addMessage(ada.id, group.id, 'x'.repeat(LIMITS.message + 1))).toThrow(StoreError);
  });

  it(`keeps only the newest ${LIMITS.history} messages`, () => {
    for (let i = 0; i < LIMITS.history + 10; i++) store.addMessage(ada.id, group.id, `msg ${i}`);
    expect(group.messages).toHaveLength(LIMITS.history);
    expect(group.messages.at(-1).text).toBe(`msg ${LIMITS.history + 9}`);
  });

  it('toggles reactions on and off', () => {
    const message = store.addMessage(ada.id, group.id, 'PR on bench!');
    store.toggleReaction(bo.id, group.id, message.id, '🔥');
    store.toggleReaction(ada.id, group.id, message.id, '🔥');
    expect(message.reactions['🔥']).toEqual([bo.id, ada.id]);

    store.toggleReaction(bo.id, group.id, message.id, '🔥');
    store.toggleReaction(ada.id, group.id, message.id, '🔥');
    expect(message.reactions).toEqual({});
  });

  it('rejects unknown reactions', () => {
    const message = store.addMessage(ada.id, group.id, 'hi');
    expect(() => store.toggleReaction(bo.id, group.id, message.id, '💩')).toThrow('Unknown reaction.');
  });
});

describe('friends', () => {
  it('sends a request by username, and accepting makes you friends both ways', () => {
    const result = store.addFriend(ada.id, { username: ' bo ' });
    expect(result.status).toBe('sent');
    expect(store.friendsView(bo.id).incoming.map((u) => u.name)).toEqual(['Ada']);
    expect(store.friendsView(ada.id).outgoing.map((u) => u.name)).toEqual(['Bo']);

    store.respondToRequest(bo.id, ada.id, true);
    expect(store.areFriends(ada.id, bo.id)).toBe(true);
    expect(store.areFriends(bo.id, ada.id)).toBe(true);
    expect(store.friendsView(bo.id)).toMatchObject({ incoming: [], outgoing: [] });
  });

  it('only shares name and colour of other people', () => {
    store.addFriend(ada.id, { friendId: bo.id });
    expect(store.friendsView(bo.id).incoming[0]).toEqual({ id: ada.id, name: 'Ada', color: ada.color });
  });

  it('declining removes the request without making friends', () => {
    store.addFriend(ada.id, { friendId: bo.id });
    store.respondToRequest(bo.id, ada.id, false);
    expect(store.areFriends(ada.id, bo.id)).toBe(false);
    expect(store.friendsView(bo.id).incoming).toEqual([]);
  });

  it('asking someone who already asked you makes you friends straight away', () => {
    store.addFriend(ada.id, { friendId: bo.id });
    expect(store.addFriend(bo.id, { friendId: ada.id }).status).toBe('accepted');
    expect(store.areFriends(ada.id, bo.id)).toBe(true);
  });

  it('rejects bad requests with a clear message', () => {
    expect(() => store.addFriend(ada.id, { username: 'Nobody' })).toThrow('No one has that username.');
    expect(() => store.addFriend(ada.id, { username: 'ADA' })).toThrow("You can't add yourself.");
    store.addFriend(ada.id, { friendId: bo.id });
    expect(() => store.addFriend(ada.id, { friendId: bo.id })).toThrow('You already sent Bo a request.');
    store.respondToRequest(bo.id, ada.id, true);
    expect(() => store.addFriend(ada.id, { friendId: bo.id })).toThrow("You're already friends with Bo.");
  });

  it('can cancel a sent request and remove a friend', () => {
    store.addFriend(ada.id, { friendId: bo.id });
    store.cancelRequest(ada.id, bo.id);
    expect(store.friendsView(bo.id).incoming).toEqual([]);

    store.addFriend(ada.id, { friendId: bo.id });
    store.respondToRequest(bo.id, ada.id, true);
    store.removeFriend(bo.id, ada.id);
    expect(store.areFriends(ada.id, bo.id)).toBe(false);
  });
});

describe('direct messages', () => {
  beforeEach(() => {
    store.addFriend(ada.id, { friendId: bo.id });
    store.respondToRequest(bo.id, ada.id, true);
  });

  it('opens one shared conversation per pair of friends', () => {
    const first = store.openDm(ada.id, bo.id);
    expect(first.isNew).toBe(true);
    expect(store.view(first.group)).toMatchObject({ type: 'dm', code: null, messages: [] });

    const again = store.openDm(bo.id, ada.id);
    expect(again).toMatchObject({ isNew: false, group: first.group });
  });

  it('only works between friends, and stops when you unfriend', () => {
    const cy = store.upsertUser({ id: 'user-cy-00003', name: 'Cy' });
    expect(() => store.openDm(ada.id, cy.id)).toThrow('You can only message your friends.');

    const { group } = store.openDm(ada.id, bo.id);
    store.addMessage(ada.id, group.id, 'hi Bo');
    store.removeFriend(ada.id, bo.id);
    expect(() => store.addMessage(ada.id, group.id, 'hello?')).toThrow("You're no longer friends with Bo.");
  });

  it("can't be joined by code or left", () => {
    const { group } = store.openDm(ada.id, bo.id);
    expect(() => store.leaveGroup(ada.id, group.id)).toThrow("You can't leave a direct message.");
    expect(() => store.joinGroup(ada.id, '')).toThrow('No group has that invite code.');
  });
});

describe('adding friends to a group', () => {
  let group;
  let cy;

  beforeEach(() => {
    cy = store.upsertUser({ id: 'user-cy-00003', name: 'Cy' });
    store.addFriend(ada.id, { friendId: bo.id });
    store.respondToRequest(bo.id, ada.id, true);
    group = store.createGroup(ada.id, 'Gym crew');
  });

  it('adds a friend straight into the group with a message about it', () => {
    const { message } = store.addToGroup(ada.id, group.id, bo.id);
    expect(group.memberIds).toEqual([ada.id, bo.id]);
    expect(message.text).toBe('Ada added Bo');
  });

  it('only works for your friends, for members, and not twice', () => {
    expect(() => store.addToGroup(ada.id, group.id, cy.id)).toThrow('You can only add your friends.');
    expect(() => store.addToGroup(bo.id, group.id, ada.id)).toThrow("You're not in that group.");
    store.addToGroup(ada.id, group.id, bo.id);
    expect(() => store.addToGroup(ada.id, group.id, bo.id)).toThrow('Bo is already in the group.');
  });

  it("doesn't work on direct messages", () => {
    const { group: dm } = store.openDm(ada.id, bo.id);
    expect(() => store.addToGroup(ada.id, dm.id, bo.id)).toThrow("You can't add people to a direct message.");
  });
});

describe('saving', () => {
  it('survives a round trip through JSON', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    store.addMessage(ada.id, group.id, 'hello');
    const copy = new Store(JSON.parse(JSON.stringify(store)));
    expect(copy.groupsFor(ada.id)[0].messages.at(-1).text).toBe('hello');
    expect(copy.joinGroup(bo.id, group.code).isNew).toBe(true);
  });
});
