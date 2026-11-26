import { database } from '../../database.ts';
import { identity } from '../../session.ts';

export async function GET(request: Request) {
  const id = await identity(request);
  if (!id || !database) return new Response(null, {status: 404});
  const row = await database.prepare(
    'SELECT d.photo FROM pair_details d JOIN pairs p ON p.id=d.pair_id WHERE (p.owner=? OR p.partner=?) AND d.photo IS NOT NULL',
  ).bind(id, id).first<{photo: string}>();
  if (!row) return new Response(null, {status: 404});
  return new Response(Uint8Array.from(atob(row.photo), c => c.charCodeAt(0)), {
    headers: {'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'},
  });
}
