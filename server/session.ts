import { database } from './database.ts';

export const sessionCookie = 'ryadom_session';
export const sessionAge = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function hex(bytes: Uint8Array) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes: number) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function digest(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100_000, hash: 'SHA-256'}, key, 256,
  );
  return hex(new Uint8Array(bits));
}

export function equalHash(a: string, b: string) {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function requestToken(request: Request) {
  const match = request.headers.get('cookie')?.match(/(?:^|;\s*)ryadom_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1];
}

export async function identity(request: Request) {
  const token = requestToken(request);
  if (!token || !database) return null;
  const session = await database.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?')
    .bind(await digest(token), Date.now()).first<{user_id: string}>();
  return session?.user_id ?? null;
}

export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export function setSession(request: Request, token: string, age: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`;
}
