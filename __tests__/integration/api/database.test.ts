/**
 * Database Integration Tests
 * 
 * Tests database mocking and data layer functionality
 */

import {
  createMockDatabase,
  createMockUser,
  createMockProject,
  createMockClip,
  mockDb,
} from '../helpers/database-mock';

describe('Database Mock', () => {
  it('should initialize empty database', () => {
    const db = createMockDatabase();
    
    expect(db.users.size).toBe(0);
    expect(db.projects.size).toBe(0);
    expect(db.clips.size).toBe(0);
  });

  it('should reset database state', () => {
    const db = createMockDatabase();
    db.users.set('user-1', { id: 'user-1' });
    
    expect(db.users.size).toBe(1);
    
    db.reset();
    expect(db.users.size).toBe(0);
  });

  it('should create user records', () => {
    const user = createMockUser();
    
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.name).toBe('Test User');
  });

  it('should override user properties', () => {
    const user = createMockUser({
      name: 'Custom Name',
      email: 'custom@test.com',
    });
    
    expect(user.name).toBe('Custom Name');
    expect(user.email).toBe('custom@test.com');
  });

  it('should create project records', () => {
    const project = createMockProject('user-123');
    
    expect(project.id).toBeDefined();
    expect(project.ownerId).toBe('user-123');
    expect(project.name).toBe('Test Project');
  });

  it('should create clip records', () => {
    const clip = createMockClip('project-123');
    
    expect(clip.id).toBeDefined();
    expect(clip.projectId).toBe('project-123');
    expect(clip.title).toBe('Test Clip');
  });

  it('should clear all data on reset', () => {
    mockDb.users.set('u1', createMockUser());
    mockDb.projects.set('p1', createMockProject('u1'));
    mockDb.clips.set('c1', createMockClip('p1'));

    expect(mockDb.users.size).toBeGreaterThan(0);
    
    mockDb.reset();

    expect(mockDb.users.size).toBe(0);
    expect(mockDb.projects.size).toBe(0);
    expect(mockDb.clips.size).toBe(0);
  });
});
