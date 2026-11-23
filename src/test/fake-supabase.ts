/**
 * A tiny in-memory stand-in for the Supabase client, covering only the calls
 * the website's server routes make. Used to test the real route code
 * (enquiries, photo uploads, Stripe webhook) without a network connection.
 */
type Row = Record<string, unknown>;
type Filter = { col: string; op: "eq" | "is"; value: unknown };

export class FakeDb {
  tables: Record<string, Row[]> = {};
  files: Record<string, string[]> = {};
  /** Make the next insert into this table fail (to test error handling). */
  failInsertOn = new Set<string>();
  calls: string[] = [];

  table(name: string): Row[] {
    return (this.tables[name] ??= []);
  }

  from(name: string) {
    return new Query(this, name);
  }

  storage = {
    from: (bucket: string) => ({
      list: async (folder: string) => {
        const names = (this.files[bucket] ?? []).filter((p) => p.startsWith(`${folder}/`)).map((p) => ({ name: p.slice(folder.length + 1) }));
        return { data: names, error: null };
      },
      createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://fake.storage/upload/${path}?token=abc`, path }, error: null }),
    }),
  };

  /** Simulates the browser finishing a signed upload. */
  addFile(bucket: string, path: string) {
    (this.files[bucket] ??= []).push(path);
  }
}

class Query implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> {
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private returning = false;
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};

  constructor(
    private db: FakeDb,
    private name: string,
  ) {}

  select() {
    if (this.mode !== "select") this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  upsert(row: Row, opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.mode = "upsert";
    this.payload = row;
    this.upsertOpts = opts;
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push({ col, op: "eq", value });
    return this;
  }
  is(col: string, value: unknown) {
    this.filters.push({ col, op: "is", value });
    return this;
  }
  order() {
    return this;
  }

  private matches(r: Row) {
    return this.filters.every((f) => (f.op === "is" ? (r[f.col] ?? null) === f.value : r[f.col] === f.value));
  }

  private run(): { data: unknown; error: { message: string; code?: string } | null } {
    const rows = this.db.table(this.name);
    this.db.calls.push(`${this.mode}:${this.name}`);
    if (this.mode === "select") return { data: rows.filter((r) => this.matches(r)), error: null };
    if (this.mode === "insert") {
      if (this.db.failInsertOn.has(this.name)) return { data: null, error: { message: `insert into ${this.name} failed` } };
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r) => ({ id: crypto.randomUUID(), ...r }));
      rows.push(...list);
      return { data: this.returning ? list : null, error: null };
    }
    if (this.mode === "update") {
      const hit = rows.filter((r) => this.matches(r));
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: this.returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
    }
    if (this.mode === "delete") {
      const keep = rows.filter((r) => !this.matches(r));
      this.db.tables[this.name] = keep;
      return { data: null, error: null };
    }
    // upsert
    const row = this.payload as Row;
    const key = this.upsertOpts.onConflict ?? "id";
    const existing = rows.find((r) => r[key] === row[key]);
    if (existing) {
      if (!this.upsertOpts.ignoreDuplicates) Object.assign(existing, row);
    } else rows.push({ ...row });
    return { data: null, error: null };
  }

  async single() {
    const { data, error } = this.run();
    const list = (data as Row[] | null) ?? [];
    return { data: list[0] ?? null, error: error ?? (list.length === 1 ? null : { message: "not exactly one row" }) };
  }
  async maybeSingle() {
    const { data, error } = this.run();
    return { data: ((data as Row[] | null) ?? [])[0] ?? null, error };
  }
  then<T1, T2>(onfulfilled?: ((v: { data: unknown; error: { message: string; code?: string } | null }) => T1 | PromiseLike<T1>) | null, onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}
