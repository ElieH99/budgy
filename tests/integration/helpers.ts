/**
 * Mock Convex context for integration testing.
 *
 * Provides an in-memory database that mirrors the Convex API surface
 * (get, insert, patch, query) so we can test mutation handler logic
 * without a live Convex deployment.
 */

type DocId = string;

interface Doc {
  _id: DocId;
  _creationTime: number;
  [key: string]: unknown;
}

type Table = Map<DocId, Doc>;

let idCounter = 0;
function nextId(table: string): DocId {
  return `${table}:${++idCounter}` as DocId;
}

export function resetIdCounter() {
  idCounter = 0;
}

/**
 * Creates a mock Convex MutationCtx with an in-memory database.
 */
export function createMockCtx(options?: {
  /** The userId returned by getAuthUserId — null = unauthenticated */
  authUserId?: DocId | null;
}) {
  const tables = new Map<string, Table>();

  function getTable(name: string): Table {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  const db = {
    get: async (id: DocId) => {
      // Find the doc in any table by its id prefix
      const tablePrefix = id.split(":")[0];
      const table = getTable(tablePrefix);
      return table.get(id) ?? null;
    },

    insert: async (tableName: string, doc: Record<string, unknown>) => {
      const table = getTable(tableName);
      const id = nextId(tableName);
      const fullDoc = { ...doc, _id: id, _creationTime: Date.now() };
      table.set(id, fullDoc);
      return id;
    },

    patch: async (id: DocId, updates: Record<string, unknown>) => {
      const tablePrefix = id.split(":")[0];
      const table = getTable(tablePrefix);
      const existing = table.get(id);
      if (!existing) throw new Error(`Document ${id} not found for patch`);
      table.set(id, { ...existing, ...updates });
    },

    query: (tableName: string) => {
      const table = getTable(tableName);
      return {
        withIndex: (_indexName: string, filterFn?: (q: IndexQuery) => IndexQuery) => {
          let filters: Array<{ field: string; value: unknown }> = [];
          if (filterFn) {
            const q = new IndexQuery();
            filterFn(q);
            filters = q._filters;
          }
          return {
            unique: async () => {
              for (const doc of table.values()) {
                const matches = filters.every((f) => doc[f.field] === f.value);
                if (matches) return doc;
              }
              return null;
            },
            collect: async () => {
              const results: Doc[] = [];
              for (const doc of table.values()) {
                const matches = filters.every((f) => doc[f.field] === f.value);
                if (matches) results.push(doc);
              }
              return results;
            },
          };
        },
        collect: async () => {
          return [...table.values()];
        },
      };
    },
  };

  const ctx = {
    db,
    auth: {
      getUserIdentity: async () =>
        options?.authUserId
          ? { subject: options.authUserId, tokenIdentifier: `token:${options.authUserId}` }
          : null,
    },
  };

  return { ctx, db, tables, getTable };
}

class IndexQuery {
  _filters: Array<{ field: string; value: unknown }> = [];

  eq(field: string, value: unknown) {
    this._filters.push({ field, value });
    return this;
  }
}

// ── Test data factory helpers ──────────────────────────────────────────────

export function createTestUser(
  db: ReturnType<typeof createMockCtx>["db"],
  overrides?: Partial<{ firstName: string; lastName: string; email: string; role: string }>
) {
  return db.insert("users", {
    firstName: overrides?.firstName ?? "Miles",
    lastName: overrides?.lastName ?? "Morales",
    email: overrides?.email ?? "miles@employee.dev",
    role: overrides?.role ?? "employee",
    createdAt: Date.now(),
  });
}

export function createTestExpense(
  db: ReturnType<typeof createMockCtx>["db"],
  userId: DocId,
  overrides?: Partial<{ status: string; currentVersion: number }>
) {
  return db.insert("expenses", {
    submittedBy: userId,
    status: overrides?.status ?? "Draft",
    currentVersion: overrides?.currentVersion ?? 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export function createTestVersion(
  db: ReturnType<typeof createMockCtx>["db"],
  expenseId: DocId,
  versionNumber: number,
  overrides?: Partial<{
    title: string;
    amount: number;
    receiptStorageId: string;
  }>
) {
  return db.insert("expenseVersions", {
    expenseId,
    versionNumber,
    title: overrides?.title ?? "Test Expense",
    description: "Test description for expense",
    amount: overrides?.amount ?? 100,
    currencyCode: "USD",
    categoryId: "categories:1" as DocId,
    expenseDate: Date.now(),
    receiptStorageId: overrides?.receiptStorageId ?? "receipt-storage-123",
    notes: "Test notes",
    submittedAt: Date.now(),
  });
}

/**
 * Retrieves all history entries for a given expense from the mock db.
 */
export async function getHistoryForExpense(
  db: ReturnType<typeof createMockCtx>["db"],
  expenseId: DocId
) {
  return db
    .query("expenseHistory")
    .withIndex("by_expenseId", (q) => q.eq("expenseId", expenseId))
    .collect();
}

/**
 * Retrieves all versions for a given expense from the mock db.
 */
export async function getVersionsForExpense(
  db: ReturnType<typeof createMockCtx>["db"],
  expenseId: DocId
) {
  return db
    .query("expenseVersions")
    .withIndex("by_expenseId", (q) => q.eq("expenseId", expenseId))
    .collect();
}
