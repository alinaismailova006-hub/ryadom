import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { database, initializeDatabase } from './database.ts';

const path = process.argv[2];
if (!path || !existsSync(path)) {
  console.error('Укажите путь к существующему файлу SQLite: npm run db:import-sqlite -- ./data/ryadom.sqlite');
  process.exit(1);
}

const tables = {
  accounts: ['id','login','salt','password_hash'],
  profiles: ['id','name','pair_id'],
  pairs: ['id','code','owner','partner','created_at'],
  answers: ['pair_id','user_id','question','value'],
  completed: ['pair_id','task','at'],
  pair_details: ['pair_id','start_date','photo','photo_version'],
  milestones: ['id','pair_id','title','date'],
};
const source = new DatabaseSync(path, {readOnly:true});
try {
  await initializeDatabase();
  source.exec('BEGIN');
  const count = await database.transaction(async transaction => {
    for (const table of Object.keys(tables)) {
      if (await transaction.prepare(`SELECT 1 FROM ${table} LIMIT 1`).bind().first()) {
        throw new Error('Импорт возможен только в пустую MySQL-базу.');
      }
    }

    let imported = 0;
    for (const [table, columns] of Object.entries(tables)) {
      const names = columns.join(',');
      const placeholders = columns.map(() => '?').join(',');
      const insert = transaction.prepare(`INSERT INTO ${table}(${names}) VALUES(${placeholders})`);
      for (const row of source.prepare(`SELECT ${names} FROM ${table}`).iterate()) {
        await insert.bind(...columns.map(column => row[column])).run();
        imported++;
      }
    }
    return imported;
  });
  console.log(`Импортировано записей: ${count}. Войдите заново со своим логином и паролем.`);
} catch (error) {
  console.error('Импорт не выполнен:', error.message);
  process.exitCode = 1;
} finally {
  source.close();
  await database.close();
}
