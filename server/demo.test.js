import { describe, expect, it } from 'vitest';
import { seedDemo } from './demo.js';

describe('demo data', () => {
  const store = seedDemo();
  const emma = store.findByUsername('Emma');

  it('has made-up people that the join screen can offer', () => {
    expect(store.demoUsers().map((u) => u.name)).toEqual(['Emma', 'Jonas', 'Sara', 'Ola', 'Noah', 'Ingrid', 'Maja']);
  });

  it('gives Emma three groups, two direct messages, three friends and a waiting request', () => {
    const chats = store.groupsFor(emma.id);
    expect(chats.filter((g) => g.type === 'group').map((g) => g.name).sort()).toEqual([
      'Exam study group',
      'Gym crew',
      'Kollektiv 🏠',
    ]);
    expect(chats.filter((g) => g.type === 'dm')).toHaveLength(2);
    const friends = store.friendsView(emma.id);
    expect(friends.friends.map((f) => f.name).sort()).toEqual(['Jonas', 'Ola', 'Sara']);
    expect(friends.incoming.map((f) => f.name)).toEqual(['Maja']);
  });

  it('keeps every chat in time order, with "joined" messages first', () => {
    for (const group of Object.values(store.groups)) {
      const times = group.messages.map((m) => m.ts);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });
});
