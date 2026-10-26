/**
 * In-memory stand-in for the subset of the Firebase Admin Firestore API used by
 * `src/lib/attendance`. Transactions run serially and apply writes on commit.
 */
import type { Firestore } from "firebase-admin/firestore";

type Data = Record<string, unknown>;
type Op = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

class AlreadyExistsError extends Error {
  code = 6;
  constructor(path: string) {
    super(`ALREADY_EXISTS: ${path}`);
  }
}

class NotFoundError extends Error {
  code = 5;
  constructor(path: string) {
    super(`NOT_FOUND: ${path}`);
  }
}

class Snapshot {
  constructor(
    readonly ref: DocRef,
    private readonly value: Data | undefined,
  ) {}
  get id() {
    return this.ref.id;
  }
  get exists() {
    return this.value !== undefined;
  }
  data() {
    return clone(this.value);
  }
  get(field: string) {
    return this.value?.[field];
  }
}

class QuerySnapshot {
  constructor(readonly docs: Snapshot[]) {}
  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }
}

let autoId = 0;

class DocRef {
  constructor(
    readonly store: FakeFirestore,
    readonly collectionName: string,
    readonly id: string,
  ) {}
  get path() {
    return `${this.collectionName}/${this.id}`;
  }
  async get() {
    return new Snapshot(this, this.store.read(this.path));
  }
  async set(data: Data, options?: { merge?: boolean }) {
    this.store.write(this.path, data, options?.merge);
  }
  async create(data: Data) {
    if (this.store.read(this.path) !== undefined) throw new AlreadyExistsError(this.path);
    this.store.write(this.path, data);
  }
  async update(data: Data) {
    if (this.store.read(this.path) === undefined) throw new NotFoundError(this.path);
    this.store.write(this.path, data, true);
  }
  async delete() {
    this.store.remove(this.path);
  }
}

class Query {
  constructor(
    readonly store: FakeFirestore,
    readonly collectionName: string,
    readonly filters: { field: string; op: Op; value: unknown }[] = [],
    readonly max?: number,
  ) {}
  where(field: string, op: Op, value: unknown) {
    return new Query(this.store, this.collectionName, [...this.filters, { field, op, value }], this.max);
  }
  limit(n: number) {
    return new Query(this.store, this.collectionName, this.filters, n);
  }
  async get() {
    const docs = this.store
      .list(this.collectionName)
      .filter(([, data]) => this.filters.every((f) => matches(data[f.field], f.op, f.value)))
      .map(([id, data]) => new Snapshot(new DocRef(this.store, this.collectionName, id), data));
    return new QuerySnapshot(this.max ? docs.slice(0, this.max) : docs);
  }
}

class CollectionRef extends Query {
  constructor(store: FakeFirestore, name: string) {
    super(store, name);
  }
  doc(id?: string) {
    autoId += 1;
    return new DocRef(this.store, this.collectionName, id ?? `auto${autoId}`);
  }
  async add(data: Data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

function matches(actual: unknown, op: Op, expected: unknown): boolean {
  const a = actual === undefined ? null : actual;
  switch (op) {
    case "==":
      return a === expected;
    case "!=":
      return a !== expected;
    case "<":
      return a != null && (a as never) < (expected as never);
    case "<=":
      return a != null && (a as never) <= (expected as never);
    case ">":
      return a != null && (a as never) > (expected as never);
    case ">=":
      return a != null && (a as never) >= (expected as never);
    case "in":
      return Array.isArray(expected) && expected.includes(a);
    case "array-contains":
      return Array.isArray(a) && a.includes(expected);
  }
}

class Transaction {
  private writes: (() => void)[] = [];
  constructor(private readonly store: FakeFirestore) {}
  async get(target: DocRef | Query) {
    return target.get();
  }
  set(ref: DocRef, data: Data, options?: { merge?: boolean }) {
    this.writes.push(() => this.store.write(ref.path, data, options?.merge));
    return this;
  }
  create(ref: DocRef, data: Data) {
    if (this.store.read(ref.path) !== undefined) throw new AlreadyExistsError(ref.path);
    this.writes.push(() => {
      if (this.store.read(ref.path) !== undefined) throw new AlreadyExistsError(ref.path);
      this.store.write(ref.path, data);
    });
    return this;
  }
  update(ref: DocRef, data: Data) {
    this.writes.push(() => {
      if (this.store.read(ref.path) === undefined) throw new NotFoundError(ref.path);
      this.store.write(ref.path, data, true);
    });
    return this;
  }
  delete(ref: DocRef) {
    this.writes.push(() => this.store.remove(ref.path));
    return this;
  }
  commit() {
    for (const write of this.writes) write();
  }
}

export class FakeFirestore {
  private docs = new Map<string, Data>();
  private queue: Promise<unknown> = Promise.resolve();

  collection(name: string) {
    return new CollectionRef(this, name);
  }

  batch() {
    const tx = new Transaction(this);
    return Object.assign(tx, { commit: async () => tx.commit() });
  }

  runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const tx = new Transaction(this);
      const result = await fn(tx);
      tx.commit();
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  read(path: string) {
    const value = this.docs.get(path);
    return value === undefined ? undefined : clone(value);
  }

  write(path: string, data: Data, merge = false) {
    const existing = merge ? this.docs.get(path) ?? {} : {};
    this.docs.set(path, clone({ ...existing, ...data }));
  }

  remove(path: string) {
    this.docs.delete(path);
  }

  list(collectionName: string): [string, Data][] {
    const prefix = `${collectionName}/`;
    return Array.from(this.docs.entries())
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
      .map(([path, data]) => [path.slice(prefix.length), clone(data)]);
  }

  /** Test helper: all documents of a collection */
  all<T = Data>(collectionName: string): (T & { id: string })[] {
    return this.list(collectionName).map(([id, data]) => ({ id, ...(data as T) }));
  }

  asFirestore() {
    return this as unknown as Firestore;
  }
}
