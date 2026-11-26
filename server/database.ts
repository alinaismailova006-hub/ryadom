import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createPool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

const settings = process.env;
const pool = createPool({
  host: settings.MYSQL_HOST || '127.0.0.1',
  port: Number(settings.MYSQL_PORT || 3306),
  user: settings.MYSQL_USER || 'ryadom',
  password: settings.MYSQL_PASSWORD,
  database: settings.MYSQL_DATABASE || 'ryadom',
  charset: 'UTF8MB4_BIN',
  dateStrings: true,
  connectionLimit: 8,
  ssl: settings.MYSQL_TLS === '1' ? {
    rejectUnauthorized: true,
    ...(settings.MYSQL_CA_FILE ? {ca: readFileSync(settings.MYSQL_CA_FILE, 'utf8')} : {}),
  } : undefined,
});

type Parameter = string | number | null | Buffer;
type Executor = typeof pool | PoolConnection;

function statements(connection: Executor) {
  return {
    prepare(sql: string) {
      return {
        bind(...values: Parameter[]) {
          async function executeWrite(executor: Executor) {
            const [result] = await executor.execute<ResultSetHeader>(sql, values);
            return {meta: {changes: result.affectedRows}};
          }
          return {
            async first<T = Record<string, unknown>>() {
              const [rows] = await connection.execute<RowDataPacket[]>(sql, values);
              return (rows[0] ?? null) as T | null;
            },
            async all<T = Record<string, unknown>>() {
              const [rows] = await connection.execute<RowDataPacket[]>(sql, values);
              return {results: rows as T[]};
            },
            run: () => executeWrite(connection),
            executeWrite,
          };
        },
      };
    },
  };
}

type Statements = ReturnType<typeof statements>;
type BoundStatement = ReturnType<ReturnType<Statements['prepare']>['bind']>;

async function transaction<T>(apply: (db: Statements, connection: PoolConnection) => Promise<T>) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await apply(statements(connection), connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export const database = {
  ...statements(pool),
  transaction,
  batch(statements: BoundStatement[]) {
    return transaction(async (_, connection) => {
      const results = [];
      for (const statement of statements) results.push(await statement.executeWrite(connection));
      return results;
    });
  },
  close: () => pool.end(),
};

export async function initializeDatabase() {
  if (!settings.MYSQL_PASSWORD) throw new Error('Укажите MYSQL_PASSWORD в файле .env.');
  const connection = await pool.getConnection();
  const migrations = new URL('../migrations/', import.meta.url);
  const lockName = 'ryadom-' + createHash('sha256').update(settings.MYSQL_DATABASE || 'ryadom').digest('hex').slice(0, 24);
  let locked = false;
  try {
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT GET_LOCK(?, 20) AS acquired', [lockName]);
    locked = rows[0]?.acquired === 1;
    if (!locked) throw new Error('Не удалось получить блокировку миграций.');
    await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (file VARCHAR(120) PRIMARY KEY)');
    for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
      const [applied] = await connection.execute<RowDataPacket[]>('SELECT 1 FROM schema_migrations WHERE file=?', [file]);
      if (applied.length) continue;
      const sql = readFileSync(new URL(file, migrations), 'utf8');
      // Migration files are trusted, simple DDL statements.
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) {
        await connection.query(statement);
      }
      await connection.execute('INSERT INTO schema_migrations(file) VALUES(?)', [file]);
    }
  } finally {
    try {
      if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    } finally {
      connection.release();
    }
  }
}
