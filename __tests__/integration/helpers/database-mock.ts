/**
 * Database mocking utilities for API integration tests
 */

export interface MockDatabase {
  users: Map<string, any>;
  projects: Map<string, any>;
  clips: Map<string, any>;
  reset: () => void;
}

export function createMockDatabase(): MockDatabase {
  return {
    users: new Map(),
    projects: new Map(),
    clips: new Map(),
    reset() {
      this.users.clear();
      this.projects.clear();
      this.clips.clear();
    },
  };
}

/**
 * Mock user record factory
 */
export function createMockUser(overrides?: Partial<any>) {
  return {
    id: 'user-' + Math.random().toString(36).substr(2, 9),
    email: `user-${Date.now()}@example.com`,
    name: 'Test User',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock project record factory
 */
export function createMockProject(userId: string, overrides?: Partial<any>) {
  return {
    id: 'project-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Project',
    ownerId: userId,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock clip record factory
 */
export function createMockClip(projectId: string, overrides?: Partial<any>) {
  return {
    id: 'clip-' + Math.random().toString(36).substr(2, 9),
    projectId,
    title: 'Test Clip',
    description: 'Test Description',
    duration: 60,
    createdAt: new Date(),
    ...overrides,
  };
}

export const mockDb = createMockDatabase();

// Reset before each test
beforeEach(() => {
  mockDb.reset();
});
