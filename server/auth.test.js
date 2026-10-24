import { describe, expect, it } from 'vitest';
import { hashPassword, LoginLimiter, newSessionToken, sessionKey, verifyPassword } from './auth.js';
import { publicUser, Store } from './store.js';

describe('passwords', () => {
  it('are stored only as a salted hash, and checked against it', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt:/);
    expect(hash).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('Correct horse battery', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('get a different salt each time, so equal passwords look different', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('are never sent to other people', async () => {
    const store = new Store();
    const user = store.createUser({ name: 'Ada', passwordHash: await hashPassword('secret-secret') });
    expect(publicUser(user)).not.toHaveProperty('passwordHash');
  });
});

describe('sessions', () => {
  it('work with the key the browser holds, but only its hash is saved', () => {
    const store = new Store();
    const user = store.createUser({ name: 'Ada', passwordHash: 'x' });
    const token = newSessionToken();
    store.startSession(user.id, sessionKey(token));

    expect(store.sessionUser(sessionKey(token))).toBe(user.id);
    expect(JSON.stringify(store)).not.toContain(token);
    expect(store.sessionUser(sessionKey('a made-up key'))).toBeNull();
  });

  it('end on logout, and other devices are logged out after a password change', () => {
    const store = new Store();
    const user = store.createUser({ name: 'Ada', passwordHash: 'x' });
    const [laptop, phone] = [sessionKey(newSessionToken()), sessionKey(newSessionToken())];
    store.startSession(user.id, laptop);
    store.startSession(user.id, phone);

    store.endOtherSessions(user.id, laptop);
    expect(store.sessionUser(laptop)).toBe(user.id);
    expect(store.sessionUser(phone)).toBeNull();

    store.endSession(laptop);
    expect(store.sessionUser(laptop)).toBeNull();
  });

  it('run out after 30 days', () => {
    const store = new Store();
    const user = store.createUser({ name: 'Ada', passwordHash: 'x' });
    const key = sessionKey(newSessionToken());
    store.startSession(user.id, key);
    store.sessions[key].createdAt -= 31 * 24 * 60 * 60 * 1000;
    expect(store.sessionUser(key)).toBeNull();
  });
});

describe('guessing passwords', () => {
  it('is blocked for a while after too many wrong tries, per name and address', () => {
    const limiter = new LoginLimiter({ maxFailures: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) limiter.fail('1.2.3.4', 'Ada');
    expect(limiter.blocked('1.2.3.4', 'ada')).toBe(true);
    expect(limiter.blocked('5.6.7.8', 'Ada')).toBe(false);
    expect(limiter.blocked('1.2.3.4', 'Bo')).toBe(false);
  });

  it('forgets earlier mistakes after a correct login', () => {
    const limiter = new LoginLimiter({ maxFailures: 3, windowMs: 60_000 });
    limiter.fail('1.2.3.4', 'Ada');
    limiter.fail('1.2.3.4', 'Ada');
    limiter.succeed('1.2.3.4', 'Ada');
    limiter.fail('1.2.3.4', 'Ada');
    expect(limiter.blocked('1.2.3.4', 'Ada')).toBe(false);
  });
});
