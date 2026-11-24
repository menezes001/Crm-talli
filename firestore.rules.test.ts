/**
 * Phase 0 Security Test Specification for Talli CRM Firestore Rules.
 * Verifies all 12 "Dirty Dozen" adversarial payloads expect PERMISSION_DENIED.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read of lead PII',
    operation: 'get',
    path: '/workspaces/userA/leads/caio-lead-1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email user write',
    operation: 'create',
    path: '/workspaces/userA/leads/lead-unverified',
    auth: { uid: 'userA', email_verified: false },
    payload: { ownerId: 'userA', workspaceId: 'userA', fullName: 'Test', company: 'Co' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-tenant PII read by another authenticated user',
    operation: 'get',
    path: '/workspaces/userA/leads/caio-lead-1',
    auth: { uid: 'userB', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity spoofing via ownerId mismatch',
    operation: 'create',
    path: '/workspaces/userA/leads/lead-spoof',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userB', workspaceId: 'userA', fullName: 'Spoof', company: 'Co' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow field injection on lead creation',
    operation: 'create',
    path: '/workspaces/userA/leads/lead-shadow',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userA', workspaceId: 'userA', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow update with ghost key',
    operation: 'update',
    path: '/workspaces/userA/leads/caio-lead-1',
    auth: { uid: 'userA', email_verified: true },
    payload: { stage: 'primeiro_contato', ghostField: 'injected' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immutable field tampering (importedFromCaioSheet)',
    operation: 'update',
    path: '/workspaces/userA/leads/caio-lead-1',
    auth: { uid: 'userA', email_verified: true },
    payload: { importedFromCaioSheet: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Value poisoning on whitelisted stage field',
    operation: 'update',
    path: '/workspaces/userA/leads/caio-lead-1',
    auth: { uid: 'userA', email_verified: true },
    payload: { stage: 'invalid_stage_value' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path ID poisoning with invalid characters',
    operation: 'create',
    path: '/workspaces/userA/leads/invalid$id..hack',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userA', workspaceId: 'userA' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Forged client timestamp on creation',
    operation: 'create',
    path: '/workspaces/userA/leads/lead-time-forge',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userA', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Non-atomic interaction write without parent interactionCount increment',
    operation: 'create',
    path: '/workspaces/userA/leads/caio-lead-1/interactions/int-1',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userA', workspaceId: 'userA', leadId: 'caio-lead-1', summary: 'Orphan' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Attempt to delete historical interaction',
    operation: 'delete',
    path: '/workspaces/userA/leads/caio-lead-1/interactions/int-1',
    auth: { uid: 'userA', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
