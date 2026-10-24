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
    expect(user).toEqual({ id: 'user-cy-00003', name: 'Cy', color: COLORS[0] });
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

describe('saving', () => {
  it('survives a round trip through JSON', () => {
    const group = store.createGroup(ada.id, 'Gym crew');
    store.addMessage(ada.id, group.id, 'hello');
    const copy = new Store(JSON.parse(JSON.stringify(store)));
    expect(copy.groupsFor(ada.id)[0].messages.at(-1).text).toBe('hello');
    expect(copy.joinGroup(bo.id, group.code).isNew).toBe(true);
  });
});
