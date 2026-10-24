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

  it('gives each user a friend code that stays the same when they reconnect', () => {
    const code = store.users[ada.id].friendCode;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(store.upsertUser({ ...ada, name: 'Ada L' }).friendCode).toBe(code);
    expect(store.users[bo.id].friendCode).not.toBe(code);
  });

  it('gives friend codes to users saved before friend codes existed', () => {
    const old = new Store({ users: { 'user-old-0001': { id: 'user-old-0001', name: 'Old', color: COLORS[0] } } });
    expect(old.users['user-old-0001'].friendCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
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
  const code = (user) => store.users[user.id].friendCode;

  it('sends a request by friend code, and accepting makes you friends both ways', () => {
    const result = store.addFriend(ada.id, { code: code(bo).toLowerCase() });
    expect(result.status).toBe('sent');
    expect(store.friendsView(bo.id).incoming.map((u) => u.name)).toEqual(['Ada']);
    expect(store.friendsView(ada.id).outgoing.map((u) => u.name)).toEqual(['Bo']);

    store.respondToRequest(bo.id, ada.id, true);
    expect(store.areFriends(ada.id, bo.id)).toBe(true);
    expect(store.areFriends(bo.id, ada.id)).toBe(true);
    expect(store.friendsView(bo.id)).toMatchObject({ incoming: [], outgoing: [] });
  });

  it('does not show friend codes to other people', () => {
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
    expect(() => store.addFriend(ada.id, { code: 'ZZZZZZ' })).toThrow('No one has that friend code.');
    expect(() => store.addFriend(ada.id, { code: code(ada) })).toThrow("You can't add yourself.");
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

describe('saving', () => {
  it('survives a round trip through JSON', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    store.addMessage(ada.id, group.id, 'hello');
    const copy = new Store(JSON.parse(JSON.stringify(store)));
    expect(copy.groupsFor(ada.id)[0].messages.at(-1).text).toBe('hello');
    expect(copy.joinGroup(bo.id, group.code).isNew).toBe(true);
  });
});
