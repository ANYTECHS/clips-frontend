export type UserFactoryOverrides = Partial<MockUser>;
export type JobFactoryOverrides = Partial<MockJob>;
export type ClipFactoryOverrides = Partial<MockClip>;
export type TransactionFactoryOverrides = Partial<MockTransaction>;
export type NotificationFactoryOverrides = Partial<MockNotification>;

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  plan: "free" | "pro" | "enterprise";
  planUsagePercent: number;
  createdAt: string;
}

export interface MockJob {
  id: string;
  userId: string;
  status: "queued" | "processing" | "complete" | "failed";
  title: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface MockClip {
  id: string;
  userId: string;
  title: string;
  status: "draft" | "processing" | "ready" | "error";
  durationSeconds: number;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface MockTransaction {
  id: string;
  userId: string;
  type: "charge" | "payout" | "withdrawal" | "refund";
  amount: number;
  currency: "USD" | "XLM";
  status: "pending" | "complete" | "failed";
  createdAt: string;
}

export interface MockNotification {
  id: string;
  userId: string;
  type: "job_complete" | "transform_complete" | "mint_success" | "earnings_received";
  read: boolean;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

const makeId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const merge = <T extends object>(defaults: T, overrides: Partial<T> = {}): T => ({
  ...defaults,
  ...overrides,
});

export function createUser(overrides: UserFactoryOverrides = {}): MockUser {
  const defaults: MockUser = {
    id: makeId("user"),
    name: "Test User",
    email: "test-user@example.com",
    avatarUrl: "/avatar.png",
    plan: "pro",
    planUsagePercent: 72,
    createdAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  };

  return merge(defaults, overrides);
}

export function createJob(overrides: JobFactoryOverrides = {}): MockJob {
  const defaults: MockJob = {
    id: makeId("job"),
    userId: makeId("user"),
    status: "processing",
    title: "Test Job",
    progress: 42,
    createdAt: new Date("2024-01-15T00:00:00.000Z").toISOString(),
    updatedAt: new Date("2024-01-15T00:00:00.000Z").toISOString(),
  };

  return merge(defaults, overrides);
}

export function createClip(overrides: ClipFactoryOverrides = {}): MockClip {
  const defaults: MockClip = {
    id: makeId("clip"),
    userId: makeId("user"),
    title: "Test Clip",
    status: "ready",
    durationSeconds: 45,
    thumbnailUrl: "/thumb.jpg",
    createdAt: new Date("2024-01-20T00:00:00.000Z").toISOString(),
  };

  return merge(defaults, overrides);
}

export function createTransaction(overrides: TransactionFactoryOverrides = {}): MockTransaction {
  const defaults: MockTransaction = {
    id: makeId("txn"),
    userId: makeId("user"),
    type: "payout",
    amount: 24.5,
    currency: "USD",
    status: "complete",
    createdAt: new Date("2024-01-22T00:00:00.000Z").toISOString(),
  };

  return merge(defaults, overrides);
}

export function createNotification(
  overrides: NotificationFactoryOverrides = {},
): MockNotification {
  const defaults: MockNotification = {
    id: makeId("notification"),
    userId: makeId("user"),
    type: "job_complete",
    read: false,
    payload: {
      jobId: makeId("job"),
      message: "Your clips are ready!",
    },
    createdAt: new Date("2024-01-25T00:00:00.000Z").toISOString(),
    readAt: null,
  };

  return merge(defaults, overrides);
}
