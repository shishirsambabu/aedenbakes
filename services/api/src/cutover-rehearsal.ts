import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

type JsonRecord = Record<string, unknown>;

type SnapshotInput = JsonRecord & {
  customers?: JsonRecord[];
  customerBranches?: JsonRecord[];
  customerUsers?: JsonRecord[];
  customerAuthRecords?: JsonRecord[];
  products?: JsonRecord[];
  capacities?: JsonRecord[];
  slots?: JsonRecord[];
  orders?: JsonRecord[];
  productionBatches?: JsonRecord[];
  supportCases?: JsonRecord[];
  documents?: JsonRecord[];
  invoiceExports?: JsonRecord[];
  deliveryManifests?: JsonRecord[];
  deliveryManifestStops?: JsonRecord[];
  proofOfDelivery?: JsonRecord[];
  returnRecords?: JsonRecord[];
  eventOutbox?: JsonRecord[];
};

type LocalAuthCounts = {
  authPrincipals: number;
  activeAuthPrincipals: number;
  authSessions: number;
};

type CutoverIssue = {
  severity: 'blocker' | 'warn';
  area: string;
  message: string;
};

type CutoverRehearsalReport = {
  generatedAt: string;
  source: {
    databasePath: string;
    snapshotFound: boolean;
  };
  counts: Record<string, number>;
  totals: Record<string, number>;
  issues: CutoverIssue[];
  gate: {
    okToImport: boolean;
    blockers: number;
    warnings: number;
  };
};

const defaultAuthCounts: LocalAuthCounts = {
  authPrincipals: 0,
  activeAuthPrincipals: 0,
  authSessions: 0,
};

export function resolveLocalDatabasePath(databaseUrl = process.env.DATABASE_URL?.trim() ?? '') {
  const trimmed = databaseUrl.trim();
  if (!trimmed) {
    return join(process.cwd(), 'data', 'aeden-bakes.sqlite');
  }
  if (/^postgres(ql)?:\/\//iu.test(trimmed)) {
    throw new Error('cutover:rehearsal reads the local SQLite recovery database, not the target PostgreSQL database.');
  }
  if (trimmed.startsWith('file:')) {
    return trimmed.slice('file:'.length);
  }
  return trimmed;
}

export function analyzeCutoverSnapshot(
  snapshot: SnapshotInput,
  options: {
    databasePath?: string;
    snapshotFound?: boolean;
    authCounts?: LocalAuthCounts;
    generatedAt?: string;
  } = {},
): CutoverRehearsalReport {
  const customers = snapshot.customers ?? [];
  const branches = snapshot.customerBranches ?? [];
  const customerUsers = snapshot.customerUsers ?? [];
  const customerAuthRecords = snapshot.customerAuthRecords ?? [];
  const products = snapshot.products ?? [];
  const capacities = snapshot.capacities ?? [];
  const slots = snapshot.slots ?? [];
  const orders = snapshot.orders ?? [];
  const productionBatches = snapshot.productionBatches ?? [];
  const supportCases = snapshot.supportCases ?? [];
  const documents = snapshot.documents ?? [];
  const invoiceExports = snapshot.invoiceExports ?? [];
  const deliveryManifests = snapshot.deliveryManifests ?? [];
  const deliveryManifestStops = snapshot.deliveryManifestStops ?? [];
  const proofOfDelivery = snapshot.proofOfDelivery ?? [];
  const returnRecords = snapshot.returnRecords ?? [];
  const eventOutbox = snapshot.eventOutbox ?? [];
  const authCounts = options.authCounts ?? defaultAuthCounts;

  const issues: CutoverIssue[] = [];
  const customerIds = collectIds(customers, issues, 'customers');
  const branchIds = collectIds(branches, issues, 'customerBranches');
  const productIds = collectIds(products, issues, 'products');
  const slotIds = collectIds(slots, issues, 'slots');
  const orderIds = collectIds(orders, issues, 'orders');

  if (customerAuthRecords.length > 0) {
    issues.push({
      severity: 'blocker',
      area: 'auth',
      message: 'Snapshot still contains customerAuthRecords. Auth must stay in normalized auth_principals only.',
    });
  }

  if (authCounts.authPrincipals === 0) {
    issues.push({
      severity: 'warn',
      area: 'auth',
      message: 'No auth_principals were found in local SQLite. Staff/customer login import would be empty.',
    });
  }

  for (const branch of branches) {
    const customerId = stringValue(branch.customerId);
    if (!customerId || !customerIds.has(customerId)) {
      issues.push({
        severity: 'blocker',
        area: 'branches',
        message: `Branch ${stringValue(branch.id) || '(missing id)'} references missing customer ${customerId || '(blank)'}.`,
      });
    }
  }

  for (const user of customerUsers) {
    const customerId = stringValue(user.customerId);
    const branchId = stringValue(user.branchId);
    if (!customerId || !customerIds.has(customerId)) {
      issues.push({
        severity: 'blocker',
        area: 'customerUsers',
        message: `Customer user ${stringValue(user.id) || '(missing id)'} references missing customer ${customerId || '(blank)'}.`,
      });
    }
    if (branchId && !branchIds.has(branchId)) {
      issues.push({
        severity: 'warn',
        area: 'customerUsers',
        message: `Customer user ${stringValue(user.id) || '(missing id)'} references missing branch ${branchId}.`,
      });
    }
  }

  for (const order of orders) {
    const orderId = stringValue(order.id) || '(missing id)';
    const customerId = stringValue(order.customerId);
    const branchId = stringValue(order.branchId);
    const slotId = stringValue(order.slotId);
    if (!customerId || !customerIds.has(customerId)) {
      issues.push({ severity: 'blocker', area: 'orders', message: `Order ${orderId} references missing customer ${customerId || '(blank)'}.` });
    }
    if (!branchId || !branchIds.has(branchId)) {
      issues.push({ severity: 'blocker', area: 'orders', message: `Order ${orderId} references missing branch ${branchId || '(blank)'}.` });
    }
    if (!slotId || !slotIds.has(slotId)) {
      issues.push({ severity: 'warn', area: 'orders', message: `Order ${orderId} references missing slot ${slotId || '(blank)'}.` });
    }

    const itemTotal = orderItems(order).reduce((sum, item) => {
      const productId = stringValue(item.productId);
      if (!productId || !productIds.has(productId)) {
        issues.push({ severity: 'blocker', area: 'orders', message: `Order ${orderId} has line for missing product ${productId || '(blank)'}.` });
      }
      return sum + numberValue(item.quantity) * numberValue(item.unitPrice);
    }, 0);
    const amountTotal = numberValue(order.amountTotal);
    if (amountTotal > 0 && Math.abs(itemTotal - amountTotal) > 1) {
      issues.push({
        severity: 'warn',
        area: 'orders',
        message: `Order ${orderId} item total ${roundMoney(itemTotal)} does not match amountTotal ${roundMoney(amountTotal)}.`,
      });
    }
  }

  for (const document of documents) {
    const customerId = stringValue(document.customerId);
    if (customerId && !customerIds.has(customerId)) {
      issues.push({
        severity: 'blocker',
        area: 'documents',
        message: `Document ${stringValue(document.id) || '(missing id)'} references missing customer ${customerId}.`,
      });
    }
  }

  for (const invoice of invoiceExports) {
    const customerId = stringValue(invoice.customerId);
    if (customerId && !customerIds.has(customerId)) {
      issues.push({
        severity: 'blocker',
        area: 'invoices',
        message: `Invoice export ${stringValue(invoice.id) || '(missing id)'} references missing customer ${customerId}.`,
      });
    }
  }

  for (const stop of deliveryManifestStops) {
    const orderId = stringValue(stop.orderId);
    if (orderId && !orderIds.has(orderId)) {
      issues.push({
        severity: 'blocker',
        area: 'delivery',
        message: `Delivery stop ${stringValue(stop.id) || '(missing id)'} references missing order ${orderId}.`,
      });
    }
  }

  const counts = {
    customers: customers.length,
    customerBranches: branches.length,
    customerUsers: customerUsers.length,
    authPrincipals: authCounts.authPrincipals,
    activeAuthPrincipals: authCounts.activeAuthPrincipals,
    authSessions: authCounts.authSessions,
    products: products.length,
    capacities: capacities.length,
    slots: slots.length,
    orders: orders.length,
    orderLines: orders.reduce((sum, order) => sum + orderItems(order).length, 0),
    productionBatches: productionBatches.length,
    supportCases: supportCases.length,
    documents: documents.length,
    invoiceExports: invoiceExports.length,
    deliveryManifests: deliveryManifests.length,
    deliveryManifestStops: deliveryManifestStops.length,
    proofOfDelivery: proofOfDelivery.length,
    returnRecords: returnRecords.length,
    eventOutbox: eventOutbox.length,
  };

  const totals = {
    customerOutstandingBalance: roundMoney(customers.reduce((sum, customer) => sum + numberValue(customer.outstandingBalance), 0)),
    customerCreditLimit: roundMoney(customers.reduce((sum, customer) => sum + numberValue(customer.creditLimit), 0)),
    orderAmountTotal: roundMoney(orders.reduce((sum, order) => sum + numberValue(order.amountTotal), 0)),
    orderLineComputedTotal: roundMoney(
      orders.reduce(
        (sum, order) =>
          sum + orderItems(order).reduce((lineSum, item) => lineSum + numberValue(item.quantity) * numberValue(item.unitPrice), 0),
        0,
      ),
    ),
    capacityTotal: roundMoney(capacities.reduce((sum, capacity) => sum + numberValue(capacity.capacity), 0)),
    capacityBookedQuantity: roundMoney(capacities.reduce((sum, capacity) => sum + numberValue(capacity.bookedQuantity), 0)),
  };

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length;
  const warnings = issues.filter((issue) => issue.severity === 'warn').length;

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: {
      databasePath: options.databasePath ?? 'in-memory',
      snapshotFound: options.snapshotFound ?? true,
    },
    counts,
    totals,
    issues,
    gate: {
      okToImport: blockers === 0,
      blockers,
      warnings,
    },
  };
}

export function repairMissingOrderBranches(snapshot: SnapshotInput) {
  const customers = snapshot.customers ?? [];
  const branches = snapshot.customerBranches ?? [];
  const orders = snapshot.orders ?? [];
  let repaired = 0;
  let createdBranches = 0;
  const skipped: string[] = [];

  for (const order of orders) {
    if (stringValue(order.branchId)) {
      continue;
    }

    const orderId = stringValue(order.id) || '(missing id)';
    const customerId = stringValue(order.customerId);
    let customerBranches = branches.filter((branch) => stringValue(branch.customerId) === customerId);
    if (customerBranches.length === 0 && customerId) {
      const customer = customers.find((entry) => stringValue(entry.id) === customerId);
      if (customer) {
        const now = new Date().toISOString();
        const branchId = `branch_${customerId.replace(/[^a-z0-9_]/giu, '_')}_main`;
        const branch = {
          id: branchId,
          customerId,
          name: `${stringValue(customer.name) || customerId} - Main Kitchen`,
          code: `${customerId.slice(-6).toUpperCase()}-MAIN`,
          status: 'active',
          serviceZone: stringValue(customer.deliveryZone) || 'Unassigned',
          deliveryNotes: 'Created during R1 cutover repair because historical orders predated branch-wise ordering.',
          createdAt: now,
          updatedAt: now,
        };
        branches.push(branch);
        customerBranches = [branch];
        createdBranches += 1;
      }
    }
    const activeBranch =
      customerBranches.find((branch) => stringValue(branch.status) === 'active') ??
      customerBranches.find((branch) => stringValue(branch.state) === 'active') ??
      customerBranches[0];

    const branchId = activeBranch ? stringValue(activeBranch.id) : '';
    if (!branchId) {
      skipped.push(orderId);
      continue;
    }

    order.branchId = branchId;
    repaired += 1;
  }

  return { repaired, createdBranches, skipped };
}

export function readLocalSnapshot(databasePath = resolveLocalDatabasePath()) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = database.prepare('SELECT snapshot FROM app_state WHERE id = 1').get() as { snapshot?: string } | undefined;
    if (!row?.snapshot) {
      return { snapshot: {}, snapshotFound: false };
    }
    return { snapshot: JSON.parse(row.snapshot) as SnapshotInput, snapshotFound: true };
  } finally {
    database.close();
  }
}

export function writeLocalSnapshot(snapshot: SnapshotInput, databasePath = resolveLocalDatabasePath()) {
  const database = new DatabaseSync(databasePath);
  try {
    database
      .prepare(
        `
        INSERT INTO app_state (id, snapshot, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          snapshot = excluded.snapshot,
          updated_at = excluded.updated_at
        `,
      )
      .run(JSON.stringify(snapshot), new Date().toISOString());
  } finally {
    database.close();
  }
}

export function readLocalAuthCounts(databasePath = resolveLocalDatabasePath()): LocalAuthCounts {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const authPrincipals = countRows(database, 'auth_principals');
    const activeAuthPrincipals = countRows(database, 'auth_principals', 'active = 1');
    const authSessions = countRows(database, 'auth_sessions');
    return { authPrincipals, activeAuthPrincipals, authSessions };
  } finally {
    database.close();
  }
}

function collectIds(records: JsonRecord[], issues: CutoverIssue[], area: string) {
  const ids = new Set<string>();
  for (const record of records) {
    const id = stringValue(record.id);
    if (!id) {
      issues.push({ severity: 'blocker', area, message: `${area} contains a record without an id.` });
      continue;
    }
    if (ids.has(id)) {
      issues.push({ severity: 'blocker', area, message: `${area} contains duplicate id ${id}.` });
    }
    ids.add(id);
  }
  return ids;
}

function countRows(database: DatabaseSync, tableName: string, whereClause?: string) {
  const exists = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  if (!exists) {
    return 0;
  }
  const sql = `SELECT COUNT(*) AS count FROM ${tableName}${whereClause ? ` WHERE ${whereClause}` : ''}`;
  const row = database.prepare(sql).get() as { count: number };
  return row.count;
}

function orderItems(order: JsonRecord) {
  return Array.isArray(order.items) ? (order.items.filter((item): item is JsonRecord => isRecord(item)) as JsonRecord[]) : [];
}

function isRecord(input: unknown): input is JsonRecord {
  return typeof input === 'object' && input !== null;
}

function stringValue(input: unknown) {
  return typeof input === 'string' ? input.trim() : '';
}

function numberValue(input: unknown) {
  return typeof input === 'number' && Number.isFinite(input) ? input : 0;
}

function roundMoney(input: number) {
  return Math.round(input * 100) / 100;
}

function isDirectRun() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isDirectRun()) {
  const databasePath = resolveLocalDatabasePath();
  const { snapshot, snapshotFound } = readLocalSnapshot(databasePath);

  if (process.argv.includes('--repair-missing-order-branches')) {
    const repairResult = repairMissingOrderBranches(snapshot);
    writeLocalSnapshot(snapshot, databasePath);
    console.log(
      `Missing order branch repair complete. Repaired: ${repairResult.repaired}. Created branches: ${repairResult.createdBranches}. Skipped: ${repairResult.skipped.length}.`,
    );
    if (repairResult.skipped.length > 0) {
      console.log(`Skipped orders: ${repairResult.skipped.join(', ')}`);
      process.exitCode = 1;
    }
  }

  const authCounts = readLocalAuthCounts(databasePath);
  const report = analyzeCutoverSnapshot(snapshot, { databasePath, snapshotFound, authCounts });
  const outputPath = join(process.cwd(), 'data', 'cutover-rehearsal-report.json');

  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Cutover rehearsal report written to ${outputPath}`);
  console.log(`Gate: ${report.gate.okToImport ? 'PASS' : 'BLOCKED'} (${report.gate.blockers} blockers, ${report.gate.warnings} warnings)`);
  console.log(`Counts: customers=${report.counts.customers}, orders=${report.counts.orders}, orderLines=${report.counts.orderLines}, documents=${report.counts.documents}`);
  console.log(`Totals: orders=${report.totals.orderAmountTotal}, computedLines=${report.totals.orderLineComputedTotal}`);

  if (!report.gate.okToImport) {
    process.exitCode = 1;
  }
}
