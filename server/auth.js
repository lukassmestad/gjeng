// Passwords and sessions.
// Passwords are never stored: only a scrypt hash with a random salt (scrypt is built into Node and is
// deliberately slow, so guessing is expensive). Sessions are random keys; only their SHA-256 is saved,
// so even someone reading the data file can't use them.
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || typeof password !== 'string') return false;
  const [kind, salt, expected] = stored.split(':');
  if (kind !== 'scrypt' || !salt || !expected) return false;
  const hash = await scrypt(password, Buffer.from(salt, 'base64'), KEY_LENGTH);
  const wanted = Buffer.from(expected, 'base64');
  return wanted.length === hash.length && timingSafeEqual(wanted, hash);
}

export const newSessionToken = () => randomBytes(32).toString('base64url');

export const sessionKey = (token) => createHash('sha256').update(String(token)).digest('hex');

// Slows down password guessing: after too many wrong tries for one name from one address, wait a while.
export class LoginLimiter {
  constructor({ maxFailures = 8, windowMs = 15 * 60 * 1000 } = {}) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.failures = new Map(); // key -> { count, until }
  }

  #key(ip, username) {
    return `${ip}|${String(username).toLowerCase()}`;
  }

  blocked(ip, username) {
    const entry = this.failures.get(this.#key(ip, username));
    if (!entry) return false;
    if (Date.now() > entry.until) {
      this.failures.delete(this.#key(ip, username));
      return false;
    }
    return entry.count >= this.maxFailures;
  }

  fail(ip, username) {
    const key = this.#key(ip, username);
    const entry = this.failures.get(key);
    if (!entry || Date.now() > entry.until) this.failures.set(key, { count: 1, until: Date.now() + this.windowMs });
    else entry.count += 1;
  }

  succeed(ip, username) {
    this.failures.delete(this.#key(ip, username));
  }
}
