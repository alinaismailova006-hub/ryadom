import { database } from '../database.ts';
import { digest, equalHash, passwordHash, randomHex, requestToken, sameOrigin, sessionAge, setSession } from '../session.ts';

type Credentials = {id: string; salt: string; password_hash: string};

function reply(body: object, status = 200, cookie?: string) {
  const headers = new Headers({'Cache-Control': 'no-store'});
  if (cookie) headers.set('Set-Cookie', cookie);
  return Response.json(body, {status, headers});
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({error: 'Недопустимый запрос.'}, 403);
  const db = database;
  if (!db) return reply({error: 'Вход временно недоступен.'}, 503);
  try {
    const input = await request.json() as {action?: string; login?: string; password?: string; name?: string};
    const token = requestToken(request);
    if (input.action === 'logout') {
      if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
      return reply({ok: true}, 200, setSession(request, '', 0));
    }

    const login = typeof input.login === 'string' ? input.login.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const registering = input.action === 'register';
    if (!registering && input.action !== 'login') return reply({error: 'Неизвестное действие.'}, 400);
    if (!/^[a-z0-9_.-]{3,32}$/.test(login) || password.length < 12 || password.length > 128) {
      return reply({error: 'Логин: 3–32 латинские буквы, цифры или символы . _ -. Пароль: от 12 до 128 символов.'}, 400);
    }
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (registering && (!name || name.length > 40)) return reply({error: 'Введите имя до 40 символов.'}, 400);

    const now = Date.now();
    const window = Math.floor(now / 900_000);
    const address = request.headers.get('CF-Connecting-IP') || 'local';
    const key = await digest('network:' + address);
    const attempt = await db.transaction(async transaction => {
      await transaction.prepare(
        'INSERT INTO auth_limits(network_key,time_window,attempts) VALUES(?,?,1) ON DUPLICATE KEY UPDATE attempts=LEAST(attempts+1,21)',
      ).bind(key, window).run();
      return transaction.prepare('SELECT attempts FROM auth_limits WHERE network_key=? AND time_window=?')
        .bind(key, window).first<{attempts: number}>();
    });
    if ((attempt?.attempts ?? 0) > 20) return reply({error: 'Слишком много попыток. Попробуйте через 15 минут.'}, 429);

    let id: string;
    const nextToken = randomHex(32);
    const nextTokenHash = await digest(nextToken);
    if (registering) {
      id = crypto.randomUUID();
      const salt = randomHex(16);
      const hash = await passwordHash(password, salt);
      try {
        await db.batch([
          db.prepare('INSERT INTO accounts(id,login,salt,password_hash) VALUES(?,?,?,?)').bind(id, login, salt, hash),
          db.prepare('INSERT INTO profiles(id,name) VALUES(?,?)').bind(id, name),
          db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(nextTokenHash, id, now + sessionAge * 1000),
        ]);
      } catch (error) {
        if (await db.prepare('SELECT id FROM accounts WHERE login=?').bind(login).first()) {
          return reply({error: 'Этот логин уже занят.'}, 409);
        }
        throw error;
      }
    } else {
      const account = await db.prepare('SELECT id,salt,password_hash FROM accounts WHERE login=?').bind(login).first<Credentials>();
      const hash = await passwordHash(password, account?.salt ?? '00000000000000000000000000000000');
      if (!account || !equalHash(hash, account.password_hash)) return reply({error: 'Неверный логин или пароль.'}, 401);
      id = account.id;
      await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
        .bind(nextTokenHash, id, now + sessionAge * 1000).run();
    }
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),
      db.prepare('DELETE FROM auth_limits WHERE time_window<?').bind(window - 1),
    ]);
    return reply({ok: true}, 200, setSession(request, nextToken, sessionAge));
  } catch (error) {
    console.error(error);
    return reply({error: 'Не удалось завершить вход. Попробуйте ещё раз.'}, 500);
  }
}
