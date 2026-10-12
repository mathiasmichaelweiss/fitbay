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
}

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
  private k = (pk: string, sk: string) => `${pk}\u0000${sk}`;
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
}
