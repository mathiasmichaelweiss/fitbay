import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

export type Item = { PK: string; SK: string; [k: string]: unknown };

/** Минимальный доступ к single-table `fitbay-main`. Отделён от DynamoDB, чтобы тесты шли на памяти. */
export interface Repo {
  get(pk: string, sk: string): Promise<Item | undefined>;
  put(item: Item): Promise<void>;
  delete(pk: string, sk: string): Promise<void>;
  /** Все записи PK, SK начинается с prefix; from/to ограничивают SK (включительно). */
  query(pk: string, opts?: { prefix?: string; from?: string; to?: string; limit?: number }): Promise<Item[]>;
  /** Запрос по GSI (GSI1: записи клиента, GSI2: каталог, GSI3: код партнёра). */
  queryIndex(index: 'GSI1' | 'GSI2' | 'GSI3', pk: string, opts?: { prefix?: string }): Promise<Item[]>;
  /**
   * Условная запись: put выполняется, только если условие верно на момент записи (атомарно).
   * Иначе бросает ConditionFailed. Это защита от двойной брони (спека 5.3).
   */
  putIf(item: Item, cond: Cond): Promise<void>;
}

/** Условие для putIf: запись должна существовать или нет, поле должно быть пустым или равным значению. */
export interface Cond {
  exists?: boolean;
  /** Поле отсутствует или null. */
  empty?: string;
  /** Поле равно значению. */
  eq?: [string, unknown];
}
export class ConditionFailed extends Error {
  constructor() {
    super('condition failed');
  }
}
const condOk = (cur: Item | undefined, c: Cond) =>
  (c.exists === undefined || c.exists === !!cur) &&
  (c.empty === undefined || cur?.[c.empty] === undefined || cur?.[c.empty] === null) &&
  (c.eq === undefined || cur?.[c.eq[0]] === c.eq[1]);

export class DynamoRepo implements Repo {
  private doc: DynamoDBDocumentClient;
  constructor(private table: string, client = new DynamoDBClient({})) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async get(pk: string, sk: string) {
    const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: { PK: pk, SK: sk } }));
    return r.Item as Item | undefined;
  }

  async put(item: Item) {
    await this.doc.send(new PutCommand({ TableName: this.table, Item: item }));
  }

  async delete(pk: string, sk: string) {
    await this.doc.send(new DeleteCommand({ TableName: this.table, Key: { PK: pk, SK: sk } }));
  }

  async query(pk: string, opts: { prefix?: string; from?: string; to?: string; limit?: number } = {}) {
    const values: Record<string, string> = { ':pk': pk };
    let cond = 'PK = :pk';
    if (opts.from || opts.to) {
      values[':a'] = opts.from ?? opts.prefix ?? '';
      values[':b'] = opts.to ?? `${opts.prefix ?? ''}￿`;
      cond += ' AND SK BETWEEN :a AND :b';
    } else if (opts.prefix) {
      values[':p'] = opts.prefix;
      cond += ' AND begins_with(SK, :p)';
    }
    const out: Item[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(
        new QueryCommand({ TableName: this.table, KeyConditionExpression: cond, ExpressionAttributeValues: values, ExclusiveStartKey: start, Limit: opts.limit }),
      );
      out.push(...((r.Items ?? []) as Item[]));
      start = opts.limit && out.length >= opts.limit ? undefined : r.LastEvaluatedKey;
    } while (start);
    return out;
  }

  async queryIndex(index: 'GSI1' | 'GSI2' | 'GSI3', pk: string, opts: { prefix?: string } = {}) {
    const values: Record<string, string> = { ':pk': pk };
    let cond = `${index}PK = :pk`;
    if (opts.prefix) {
      values[':p'] = opts.prefix;
      cond += ` AND begins_with(${index}SK, :p)`;
    }
    const out: Item[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(new QueryCommand({ TableName: this.table, IndexName: index, KeyConditionExpression: cond, ExpressionAttributeValues: values, ExclusiveStartKey: start }));
      out.push(...((r.Items ?? []) as Item[]));
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  }

  async putIf(item: Item, c: Cond) {
    const parts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    if (c.exists === true) parts.push('attribute_exists(PK)');
    if (c.exists === false) parts.push('attribute_not_exists(PK)');
    if (c.empty) {
      names['#e'] = c.empty;
      values[':null'] = null;
      parts.push('(attribute_not_exists(#e) OR #e = :null)');
    }
    if (c.eq) {
      names['#q'] = c.eq[0];
      values[':q'] = c.eq[1];
      parts.push('#q = :q');
    }
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.table,
          Item: item,
          ConditionExpression: parts.join(' AND ') || undefined,
          ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
          ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
        }),
      );
    } catch (e) {
      if ((e as Error).name === 'ConditionalCheckFailedException') throw new ConditionFailed();
      throw e;
    }
  }

  /** Удаление пачками по 25 (для «удалить аккаунт»). */
  async deleteMany(keys: { PK: string; SK: string }[]) {
    for (let i = 0; i < keys.length; i += 25) {
      const chunk = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
      await this.doc.send(new BatchWriteCommand({ RequestItems: { [this.table]: chunk } }));
    }
  }
}

/** In-memory реализация для тестов и локальной разработки. */
export class MemoryRepo implements Repo {
  items = new Map<string, Item>();
  protected k = (pk: string, sk: string) => `${pk}\u0000${sk}`;
  async get(pk: string, sk: string) {
    const i = this.items.get(this.k(pk, sk));
    return i && structuredClone(i);
  }
  async put(item: Item) {
    this.items.set(this.k(item.PK, item.SK), structuredClone(item));
  }
  async delete(pk: string, sk: string) {
    this.items.delete(this.k(pk, sk));
  }
  async query(pk: string, opts: { prefix?: string; from?: string; to?: string; limit?: number } = {}) {
    const lo = opts.from ?? opts.prefix ?? '';
    const hi = opts.to ?? (opts.prefix !== undefined ? `${opts.prefix}￿` : '￿');
    const res = [...this.items.values()]
      .filter((i) => i.PK === pk && i.SK >= lo && i.SK <= hi && (!opts.prefix || opts.from || opts.to || i.SK.startsWith(opts.prefix)))
      .sort((a, b) => (a.SK < b.SK ? -1 : 1))
      .map((i) => structuredClone(i));
    return opts.limit ? res.slice(0, opts.limit) : res;
  }
  async queryIndex(index: 'GSI1' | 'GSI2' | 'GSI3', pk: string, opts: { prefix?: string } = {}) {
    return [...this.items.values()]
      .filter((i) => i[`${index}PK`] === pk && (!opts.prefix || String(i[`${index}SK`] ?? '').startsWith(opts.prefix)))
      .sort((a, b) => (String(a[`${index}SK`]) < String(b[`${index}SK`]) ? -1 : 1))
      .map((i) => structuredClone(i));
  }
  /** Проверка и запись без await между ними: в одном процессе Node это атомарно, как conditional write в DynamoDB. */
  putIf(item: Item, c: Cond): Promise<void> {
    const cur = this.items.get(this.k(item.PK, item.SK));
    if (!condOk(cur, c)) return Promise.reject(new ConditionFailed());
    this.items.set(this.k(item.PK, item.SK), structuredClone(item));
    this.afterWrite();
    return Promise.resolve();
  }
  /** Хук для FileRepo (сохранение на диск). */
  protected afterWrite() {}
}
