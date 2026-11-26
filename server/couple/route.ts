import { database } from '../database.ts';
import { identity, sameOrigin } from '../session.ts';
import { isCalendarDate } from '../../src/relationship.ts';
import {validQuestion,packs,dates} from '../../src/content.ts';
function fail(message:string,status=400){return Response.json({error:message},{status})}
export async function GET(request: Request){
 const id=await identity(request); if(!id)return Response.json({signedIn:false});
 try{
 const db=database;if(!db)throw new Error("DB binding is unavailable");let me:any=await db.prepare('SELECT * FROM profiles WHERE id=?').bind(id).first();
 if(!me)return Response.json({signedIn:true,me:null});
 const pair:any=me.pair_id?await db.prepare('SELECT * FROM pairs WHERE id=? AND (owner=? OR partner=?)').bind(me.pair_id,id,id).first():null;
 if(!pair)return Response.json({signedIn:true,me,pair:null,answers:[],completed:[]});
 const partner=await db.prepare('SELECT name FROM profiles WHERE pair_id=? AND id<>?').bind(pair.id,id).first();
 const all=await db.prepare('SELECT user_id,question,value FROM answers WHERE pair_id=?').bind(pair.id).all();
 const mine=new Set(all.results.filter((a:any)=>a.user_id===id).map((a:any)=>a.question));
 const visible=all.results.filter((a:any)=>a.user_id===id||mine.has(a.question)).map((a:any)=>({question:a.question,value:a.value,mine:a.user_id===id}));
 const details = await db.prepare('SELECT start_date,photo_version FROM pair_details WHERE pair_id=?')
   .bind(pair.id).first<{start_date: string | null; photo_version: string | null}>();
 const events = await db.prepare('SELECT id,title,date FROM milestones WHERE pair_id=? ORDER BY date,id').bind(pair.id).all();
 const done=await db.prepare('SELECT task FROM completed WHERE pair_id=?').bind(pair.id).all();
 return Response.json({signedIn:true,me,pair:{code:pair.code,createdAt:pair.created_at,partner:partner?.name||null,startDate:details?.start_date,photoVersion:details?.photo_version},events:events.results,answers:visible,completed:done.results.map((x:any)=>x.task)}, {headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error(e);return fail('Не удалось загрузить ваше пространство. Попробуйте ещё раз.',500)}
}
export async function POST(req:Request){
 const id=await identity(req);if(!id)return fail('Сначала войдите в аккаунт.',401);
 if(!sameOrigin(req))return fail('Недопустимый запрос.',403);
 try{
 const b:any=await req.json();const db=database;if(!db)throw new Error("DB binding is unavailable");
 if(b.action==='profile'){
 const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>40)return fail('Введите имя до 40 символов.');
 await db.prepare('INSERT INTO profiles(id,name) VALUES(?,?) ON DUPLICATE KEY UPDATE name=?').bind(id,name,name).run();return Response.json({ok:true});}
 const me:any=await db.prepare('SELECT * FROM profiles WHERE id=?').bind(id).first();if(!me)return fail('Сначала укажите своё имя.');
 if (b.action === 'create') {
   const pairId = crypto.randomUUID();
   const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
   const code = Array.from(crypto.getRandomValues(new Uint8Array(10)), value => alphabet[value % alphabet.length]).join('');
   return await db.transaction(async transaction => {
     const profile = await transaction.prepare('SELECT pair_id FROM profiles WHERE id=? FOR UPDATE')
       .bind(id).first<{pair_id: string | null}>();
     if (!profile || profile.pair_id) return fail('У вас уже есть пара.');
     await transaction.prepare('INSERT INTO pairs(id,code,owner,created_at) VALUES(?,?,?,?)')
       .bind(pairId,code,id,Date.now()).run();
     await transaction.prepare('UPDATE profiles SET pair_id=? WHERE id=?').bind(pairId,id).run();
     return Response.json({ok:true});
   });
 }
 if (b.action === 'join') {
   const code = String(b.code || '').trim().toUpperCase();
   if (!/^[A-Z2-9]{10}$/.test(code)) return fail('Код состоит из 10 букв и цифр.');
   return await db.transaction(async transaction => {
     const profile = await transaction.prepare('SELECT pair_id FROM profiles WHERE id=? FOR UPDATE')
       .bind(id).first<{pair_id: string | null}>();
     if (!profile || profile.pair_id) return fail('У вас уже есть пара.');
     const invited = await transaction.prepare('SELECT id,owner,partner FROM pairs WHERE code=? FOR UPDATE')
       .bind(code).first<{id: string; owner: string; partner: string | null}>();
     if (!invited || invited.partner || invited.owner===id) return fail('Код не найден или пара уже создана. Проверьте код.');
     await transaction.prepare('UPDATE pairs SET partner=? WHERE id=?').bind(id, invited.id).run();
     await transaction.prepare('UPDATE profiles SET pair_id=? WHERE id=?').bind(invited.id,id).run();
     return Response.json({ok:true});
   });
 }
 if(!me.pair_id)return fail('Сначала создайте пару.');
 const pair=await db.prepare('SELECT id FROM pairs WHERE id=? AND (owner=? OR partner=?)').bind(me.pair_id,id,id).first();if(!pair)return fail('Нет доступа к этой паре.',403);
 if (b.action === 'startDate') {
   if (!isCalendarDate(b.date) || Date.parse(b.date) > Date.now() + 86_400_000) return fail('Введите дату начала отношений, которая уже наступила.');
   await db.prepare('INSERT INTO pair_details(pair_id,start_date) VALUES(?,?) ON DUPLICATE KEY UPDATE start_date=?')
     .bind(me.pair_id,b.date,b.date).run();
   return Response.json({ok:true});
 }
 if (b.action === 'photo') {
   const photo = b.photo;
   if (photo !== null && (typeof photo !== 'string' || photo.length > 420_000 || !/^\/9j\/[a-zA-Z0-9+/]*={0,2}$/.test(photo))) {
     return fail('Не удалось загрузить фото. Выберите другой снимок.');
   }
   if (photo !== null) {
     try { atob(photo); } catch { return fail('Выберите корректное фото.'); }
   }
   const version = photo === null ? null : crypto.randomUUID();
   await db.prepare('INSERT INTO pair_details(pair_id,photo,photo_version) VALUES(?,?,?) ON DUPLICATE KEY UPDATE photo=?,photo_version=?')
     .bind(me.pair_id,photo,version,photo,version).run();
   return Response.json({ok:true});
 }
 if (b.action === 'addEvent') {
   const title = typeof b.title === 'string' ? b.title.trim() : '';
   if (!title || title.length > 80 || !isCalendarDate(b.date)) return fail('Введите название до 80 символов и дату.');
   return await db.transaction(async transaction => {
     await transaction.prepare('SELECT id FROM pairs WHERE id=? FOR UPDATE').bind(me.pair_id).first();
     const count = await transaction.prepare('SELECT COUNT(*) AS total FROM milestones WHERE pair_id=?')
       .bind(me.pair_id).first<{total: number}>();
     if (Number(count?.total) >= 100) return fail('В календаре уже 100 дат.');
     await transaction.prepare('INSERT INTO milestones(id,pair_id,title,date) VALUES(?,?,?,?)')
       .bind(crypto.randomUUID(),me.pair_id,title,b.date).run();
     return Response.json({ok:true});
   });
 }
 if (b.action === 'removeEvent') {
   if (typeof b.id !== 'string') return fail('Дата не найдена.');
   await db.prepare('DELETE FROM milestones WHERE id=? AND pair_id=?').bind(b.id,me.pair_id).run();
   return Response.json({ok:true});
 }
 if(b.action==='answer'){
 if(typeof b.question!=='string'||!validQuestion(b.question)||typeof b.value!=='string'||!b.value.trim()||b.value.length>2000)return fail('Проверьте ответ (до 2000 символов).');
 if(!b.question.startsWith('day:')){const [p,i]=b.question.split(':');const q=packs.find(x=>x.id===p)?.questions[Number(i)];if(!q?.slice(1).includes(b.value))return fail('Выберите один из вариантов.');}
 await db.prepare('INSERT INTO answers(pair_id,user_id,question,value) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE value=answers.value').bind(me.pair_id,id,b.question,b.value.trim()).run();return Response.json({ok:true});}
 if(b.action==='task'){
 if(!dates.some(t=>t.id===b.task))return fail('Задание не найдено.');
 await db.prepare('INSERT INTO completed(pair_id,task,at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE at=completed.at').bind(me.pair_id,b.task,Date.now()).run();return Response.json({ok:true});}
 return fail('Действие не найдено.');
 }catch(e){console.error(e);return fail('Не получилось сохранить. Попробуйте ещё раз.',500)}
}
