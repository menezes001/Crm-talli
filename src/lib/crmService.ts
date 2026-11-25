import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { CAIO_REFERRAL_SOURCE, getCaioSeedContacts } from '../data/caioSeedContacts';
import {
  FIELD_LIMITS,
  type FunnelStage,
  type Interaction,
  type InteractionFormInput,
  type Lead,
  type LeadFormInput,
  type Workspace,
} from '../types/crm';
import { getTodayISO } from './crmUtils';
import { db, handleFirestoreError, OperationType } from './firebase';

export const SHARED_WORKSPACE_ID = 'talli-comercial';

export interface WorkspaceBootstrapResult {
  workspace: Workspace;
  migratedCount: number;
}

function clampString(value: string | undefined | null, maxLength: number): string {
  if (!value) return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeEstimatedValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  if (value > 1_000_000_000) return 1_000_000_000;
  return Number(value);
}

function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

function mapLeadDoc(docId: string, d: Record<string, unknown>, fallbackWorkspaceId: string): Lead {
  return {
    id: docId,
    ownerId: typeof d.ownerId === 'string' ? d.ownerId : '',
    workspaceId: typeof d.workspaceId === 'string' ? d.workspaceId : fallbackWorkspaceId,
    fullName: typeof d.fullName === 'string' ? d.fullName : '',
    company: typeof d.company === 'string' ? d.company : '',
    phone: typeof d.phone === 'string' ? d.phone : '',
    email: typeof d.email === 'string' ? d.email : '',
    city: typeof d.city === 'string' ? d.city : '',
    segment: typeof d.segment === 'string' ? d.segment : '',
    source: typeof d.source === 'string' ? d.source : CAIO_REFERRAL_SOURCE,
    importedFromCaioSheet: Boolean(d.importedFromCaioSheet),
    entryDate: typeof d.entryDate === 'string' ? d.entryDate : '',
    ownerName: typeof d.ownerName === 'string' ? d.ownerName : '',
    stage: (d.stage as FunnelStage) || 'novo_lead',
    potential: (d.potential as Lead['potential']) || '',
    estimatedValue:
      typeof d.estimatedValue === 'number' && !Number.isNaN(d.estimatedValue)
        ? d.estimatedValue
        : null,
    notes: typeof d.notes === 'string' ? d.notes : '',
    meetingDate: typeof d.meetingDate === 'string' ? d.meetingDate : '',
    interestLevel: (d.interestLevel as Lead['interestLevel']) || '',
    nextAction: typeof d.nextAction === 'string' ? d.nextAction : '',
    nextFollowUpDate: typeof d.nextFollowUpDate === 'string' ? d.nextFollowUpDate : '',
    lastContactAt: typeof d.lastContactAt === 'string' ? d.lastContactAt : '',
    lastInteractionSummary:
      typeof d.lastInteractionSummary === 'string' ? d.lastInteractionSummary : '',
    interactionCount: typeof d.interactionCount === 'number' ? d.interactionCount : 0,
    createdAt: d.createdAt as Lead['createdAt'],
    updatedAt: d.updatedAt as Lead['updatedAt'],
  };
}

function hasRicherLeadData(candidate: Lead, current: Lead): boolean {
  if (candidate.interactionCount > current.interactionCount) return true;
  if (current.stage === 'novo_lead' && candidate.stage !== 'novo_lead') return true;
  if (!current.phone && candidate.phone) return true;
  if (!current.email && candidate.email) return true;
  if (!current.city && candidate.city) return true;
  if (current.estimatedValue === null && candidate.estimatedValue !== null) return true;
  if (!current.nextAction && candidate.nextAction) return true;
  if (!current.nextFollowUpDate && candidate.nextFollowUpDate) return true;
  if (candidate.notes.length > current.notes.length) return true;
  return false;
}

async function replayLegacyInteractions(
  uid: string,
  leadId: string,
  legacyLead: Lead,
  startingCount: number,
  existingSharedInteractionIds: Set<string>
): Promise<void> {
  const legacyInteractionsQuery = query(
    collection(db, 'workspaces', uid, 'leads', leadId, 'interactions'),
    where('ownerId', '==', uid),
    where('workspaceId', '==', uid),
    where('leadId', '==', leadId)
  );

  let legacyIntSnap;
  try {
    legacyIntSnap = await getDocs(legacyInteractionsQuery);
  } catch {
    return;
  }

  if (legacyIntSnap.empty) return;

  const interactionsToCopy = legacyIntSnap.docs
    .filter((d) => !existingSharedInteractionIds.has(d.id))
    .map((d) => ({ id: d.id, data: d.data() }))
    .sort((a, b) =>
      String(a.data.contactedAt || '').localeCompare(String(b.data.contactedAt || ''))
    );

  let currentCount = startingCount;
  const sharedLeadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', leadId);

  for (const item of interactionsToCopy) {
    const d = item.data;
    const summaryClean = clampString(String(d.summary || ''), FIELD_LIMITS.interactionSummary);
    if (!summaryClean) continue;

    const sharedIntRef = doc(
      db,
      'workspaces',
      SHARED_WORKSPACE_ID,
      'leads',
      leadId,
      'interactions',
      item.id
    );

    const batch = writeBatch(db);
    batch.set(sharedIntRef, {
      ownerId: uid,
      workspaceId: SHARED_WORKSPACE_ID,
      leadId,
      contactedAt:
        clampString(String(d.contactedAt || ''), FIELD_LIMITS.lastContactAt) ||
        new Date().toISOString().slice(0, 16),
      channel: d.channel || 'whatsapp',
      interactionType: d.interactionType || 'follow_up',
      summary: summaryClean,
      clientResponse: clampString(String(d.clientResponse || ''), FIELD_LIMITS.clientResponse),
      interestLevel: d.interestLevel || '',
      needsIdentified: clampString(String(d.needsIdentified || ''), FIELD_LIMITS.needsIdentified),
      objections: clampString(String(d.objections || ''), FIELD_LIMITS.objections),
      nextAction: clampString(String(d.nextAction || ''), FIELD_LIMITS.nextAction),
      nextFollowUpDate: clampString(
        String(d.nextFollowUpDate || ''),
        FIELD_LIMITS.nextFollowUpDate
      ),
      stageAfter: d.stageAfter || '',
      createdAt: serverTimestamp(),
    });

    currentCount += 1;
    batch.update(sharedLeadRef, {
      stage: legacyLead.stage,
      interestLevel: legacyLead.interestLevel,
      nextAction: clampString(legacyLead.nextAction, FIELD_LIMITS.nextAction),
      nextFollowUpDate: clampString(legacyLead.nextFollowUpDate, FIELD_LIMITS.nextFollowUpDate),
      lastContactAt: clampString(legacyLead.lastContactAt, FIELD_LIMITS.lastContactAt),
      lastInteractionSummary: clampString(
        legacyLead.lastInteractionSummary || summaryClean,
        FIELD_LIMITS.lastInteractionSummary
      ),
      interactionCount: currentCount,
      meetingDate: clampString(legacyLead.meetingDate, FIELD_LIMITS.meetingDate),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  }
}

async function migrateLegacyPersonalWorkspace(
  uid: string,
  sharedLeadsById: Map<string, Lead>
): Promise<number> {
  if (uid === SHARED_WORKSPACE_ID) return 0;

  let legacyLeadsSnap;
  try {
    const legacyLeadsQuery = query(
      collection(db, 'workspaces', uid, 'leads'),
      where('ownerId', '==', uid),
      where('workspaceId', '==', uid)
    );
    legacyLeadsSnap = await getDocs(legacyLeadsQuery);
  } catch {
    return 0;
  }

  if (legacyLeadsSnap.empty) return 0;

  let migratedCount = 0;

  for (const docSnap of legacyLeadsSnap.docs) {
    try {
    const legacyLead = mapLeadDoc(docSnap.id, docSnap.data(), uid);
    const existingShared = sharedLeadsById.get(legacyLead.id);
    const sharedLeadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', legacyLead.id);

    if (!existingShared) {
      await setDoc(sharedLeadRef, {
        ownerId: uid,
        workspaceId: SHARED_WORKSPACE_ID,
        fullName: clampString(legacyLead.fullName, FIELD_LIMITS.fullName) || 'A confirmar',
        company:
          clampString(legacyLead.company, FIELD_LIMITS.company) || 'Empresa não informada',
        phone: clampString(legacyLead.phone, FIELD_LIMITS.phone),
        email: clampString(legacyLead.email, FIELD_LIMITS.email),
        city: clampString(legacyLead.city, FIELD_LIMITS.city),
        segment: clampString(legacyLead.segment, FIELD_LIMITS.segment),
        source:
          clampString(legacyLead.source || CAIO_REFERRAL_SOURCE, FIELD_LIMITS.source) ||
          CAIO_REFERRAL_SOURCE,
        importedFromCaioSheet: legacyLead.importedFromCaioSheet,
        entryDate: clampString(legacyLead.entryDate || getTodayISO(), FIELD_LIMITS.entryDate),
        ownerName: clampString(legacyLead.ownerName, FIELD_LIMITS.ownerName),
        stage: legacyLead.stage || 'novo_lead',
        potential: legacyLead.potential || '',
        estimatedValue: sanitizeEstimatedValue(legacyLead.estimatedValue),
        notes: clampString(legacyLead.notes, FIELD_LIMITS.notes),
        meetingDate: clampString(legacyLead.meetingDate, FIELD_LIMITS.meetingDate),
        interestLevel: legacyLead.interestLevel || '',
        nextAction: clampString(legacyLead.nextAction, FIELD_LIMITS.nextAction),
        nextFollowUpDate: clampString(
          legacyLead.nextFollowUpDate,
          FIELD_LIMITS.nextFollowUpDate
        ),
        lastContactAt: clampString(legacyLead.lastContactAt, FIELD_LIMITS.lastContactAt),
        lastInteractionSummary: clampString(
          legacyLead.lastInteractionSummary,
          FIELD_LIMITS.lastInteractionSummary
        ),
        interactionCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await replayLegacyInteractions(uid, legacyLead.id, legacyLead, 0, new Set());
      sharedLeadsById.set(legacyLead.id, {
        ...legacyLead,
        workspaceId: SHARED_WORKSPACE_ID,
      });
      migratedCount += 1;
    } else if (hasRicherLeadData(legacyLead, existingShared)) {
      await updateDoc(sharedLeadRef, {
        fullName:
          clampString(legacyLead.fullName || existingShared.fullName, FIELD_LIMITS.fullName) ||
          'A confirmar',
        company:
          clampString(legacyLead.company || existingShared.company, FIELD_LIMITS.company) ||
          'Empresa não informada',
        phone: clampString(legacyLead.phone || existingShared.phone, FIELD_LIMITS.phone),
        email: clampString(legacyLead.email || existingShared.email, FIELD_LIMITS.email),
        city: clampString(legacyLead.city || existingShared.city, FIELD_LIMITS.city),
        segment: clampString(legacyLead.segment || existingShared.segment, FIELD_LIMITS.segment),
        source:
          clampString(
            legacyLead.source || existingShared.source || CAIO_REFERRAL_SOURCE,
            FIELD_LIMITS.source
          ) || CAIO_REFERRAL_SOURCE,
        entryDate: clampString(
          legacyLead.entryDate || existingShared.entryDate,
          FIELD_LIMITS.entryDate
        ),
        ownerName: clampString(
          legacyLead.ownerName || existingShared.ownerName,
          FIELD_LIMITS.ownerName
        ),
        stage:
          existingShared.stage === 'novo_lead' && legacyLead.stage !== 'novo_lead'
            ? legacyLead.stage
            : existingShared.stage,
        potential: legacyLead.potential || existingShared.potential,
        estimatedValue: sanitizeEstimatedValue(
          legacyLead.estimatedValue !== null
            ? legacyLead.estimatedValue
            : existingShared.estimatedValue
        ),
        notes: clampString(
          legacyLead.notes.length > existingShared.notes.length
            ? legacyLead.notes
            : existingShared.notes,
          FIELD_LIMITS.notes
        ),
        meetingDate: clampString(
          legacyLead.meetingDate || existingShared.meetingDate,
          FIELD_LIMITS.meetingDate
        ),
        interestLevel: legacyLead.interestLevel || existingShared.interestLevel,
        nextAction: clampString(
          legacyLead.nextAction || existingShared.nextAction,
          FIELD_LIMITS.nextAction
        ),
        nextFollowUpDate: clampString(
          legacyLead.nextFollowUpDate || existingShared.nextFollowUpDate,
          FIELD_LIMITS.nextFollowUpDate
        ),
        updatedAt: serverTimestamp(),
      });

      const sharedIntsQuery = query(
        collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', legacyLead.id, 'interactions'),
        where('workspaceId', '==', SHARED_WORKSPACE_ID),
        where('leadId', '==', legacyLead.id)
      );
      const sharedIntSnap = await getDocs(sharedIntsQuery).catch(() => null);
      const existingIds = new Set(sharedIntSnap?.docs.map((d) => d.id) ?? []);

      await replayLegacyInteractions(
        uid,
        legacyLead.id,
        legacyLead,
        existingShared.interactionCount,
        existingIds
      );
      migratedCount += 1;
    }
    } catch {
      // Skip individual conflicting lead migration without blocking workspace boot
    }
  }

  return migratedCount;
}

export async function ensureWorkspaceAndSeed(user: User): Promise<WorkspaceBootstrapResult> {
  const uid = user.uid;
  const workspacePath = `workspaces/${SHARED_WORKSPACE_ID}`;
  const workspaceRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID);
  const memberPath = `workspaces/${SHARED_WORKSPACE_ID}/members/${uid}`;
  const memberRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'members', uid);

  // Ensure the fresh ID token is ready before the first Firestore call
  await user.getIdToken();

  // 1. Ensure shared Talli CRM workspace exists
  let workspaceSnap;
  try {
    workspaceSnap = await getDoc(workspaceRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, workspacePath);
  }

  let workspace: Workspace;
  if (!workspaceSnap.exists()) {
    const nowISO = new Date().toISOString();
    const workspacePayload = {
      ownerId: uid,
      ownerEmail: clampString(user.email || '', 254),
      name: 'Talli Marketing — Comercial',
      caioBaseImported: true,
      caioBaseImportedAt: nowISO,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(workspaceRef, workspacePayload);
      workspace = {
        id: SHARED_WORKSPACE_ID,
        ownerId: uid,
        ownerEmail: workspacePayload.ownerEmail,
        name: workspacePayload.name,
        caioBaseImported: true,
        caioBaseImportedAt: nowISO,
      };
    } catch (error) {
      // Handle rare concurrent workspace creation by another teammate
      const retrySnap = await getDoc(workspaceRef).catch(() => null);
      if (retrySnap?.exists()) {
        const d = retrySnap.data();
        workspace = {
          id: retrySnap.id,
          ownerId: d.ownerId,
          ownerEmail: d.ownerEmail,
          name: d.name,
          caioBaseImported: Boolean(d.caioBaseImported),
          caioBaseImportedAt: d.caioBaseImportedAt || '',
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      } else {
        handleFirestoreError(error, OperationType.CREATE, workspacePath);
      }
    }
  } else {
    const data = workspaceSnap.data();
    workspace = {
      id: workspaceSnap.id,
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail,
      name: data.name,
      caioBaseImported: Boolean(data.caioBaseImported),
      caioBaseImportedAt: data.caioBaseImportedAt || '',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  // 2. Enroll current authenticated user as a team member in the shared workspace
  let memberSnap;
  try {
    memberSnap = await getDoc(memberRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, memberPath);
  }

  let legacyMigrated = false;
  if (!memberSnap.exists()) {
    try {
      await setDoc(memberRef, {
        uid,
        email: clampString(user.email || '', 254),
        displayName: clampString(user.displayName || '', 120),
        role: 'member',
        legacyMigrated: false,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, memberPath);
    }
  } else {
    legacyMigrated = Boolean(memberSnap.data().legacyMigrated);
  }

  // 3. Load current shared leads snapshot once to check migration / initial seeding
  const sharedLeadsQuery = query(
    collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads'),
    where('workspaceId', '==', SHARED_WORKSPACE_ID)
  );
  let sharedLeadsSnap;
  try {
    sharedLeadsSnap = await getDocs(sharedLeadsQuery);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `${workspacePath}/leads`);
  }

  const sharedLeadsById = new Map<string, Lead>();
  for (const docSnap of sharedLeadsSnap.docs) {
    sharedLeadsById.set(docSnap.id, mapLeadDoc(docSnap.id, docSnap.data(), SHARED_WORKSPACE_ID));
  }

  // 4. One-time automatic merge of any leads/interactions saved earlier in this user's personal workspace
  let migratedCount = 0;
  if (!legacyMigrated) {
    migratedCount = await migrateLegacyPersonalWorkspace(uid, sharedLeadsById);
    try {
      await updateDoc(memberRef, {
        legacyMigrated: true,
        displayName: clampString(user.displayName || '', 120),
        email: clampString(user.email || '', 254),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal: will retry quietly next boot if needed
    }
  }

  // 5. Seed the 7 original Caio contacts once if the shared workspace is completely empty
  if (sharedLeadsById.size === 0) {
    const todayISO = getTodayISO();
    const seeds = getCaioSeedContacts(todayISO);
    const batch = writeBatch(db);

    for (const seed of seeds) {
      const leadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', seed.seedId);
      batch.set(leadRef, {
        ownerId: uid,
        workspaceId: SHARED_WORKSPACE_ID,
        fullName: clampString(seed.fullName, FIELD_LIMITS.fullName) || 'A confirmar',
        company: clampString(seed.company, FIELD_LIMITS.company) || 'Empresa não informada',
        phone: clampString(seed.phone, FIELD_LIMITS.phone),
        email: clampString(seed.email, FIELD_LIMITS.email),
        city: clampString(seed.city, FIELD_LIMITS.city),
        segment: clampString(seed.segment, FIELD_LIMITS.segment),
        source: clampString(seed.source || CAIO_REFERRAL_SOURCE, FIELD_LIMITS.source),
        importedFromCaioSheet: true,
        entryDate: clampString(seed.entryDate || todayISO, FIELD_LIMITS.entryDate),
        ownerName: clampString(seed.ownerName, FIELD_LIMITS.ownerName),
        stage: seed.stage,
        potential: seed.potential,
        estimatedValue: sanitizeEstimatedValue(seed.estimatedValue),
        notes: clampString(seed.notes, FIELD_LIMITS.notes),
        meetingDate: clampString(seed.meetingDate, FIELD_LIMITS.meetingDate),
        interestLevel: seed.interestLevel,
        nextAction: clampString(seed.nextAction, FIELD_LIMITS.nextAction),
        nextFollowUpDate: clampString(seed.nextFollowUpDate, FIELD_LIMITS.nextFollowUpDate),
        lastContactAt: '',
        lastInteractionSummary: '',
        interactionCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${workspacePath}/leads`);
    }
  }

  return { workspace, migratedCount };
}

export function subscribeLeads(
  _uid: string,
  onData: (leads: Lead[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `workspaces/${SHARED_WORKSPACE_ID}/leads`;
  const leadsQuery = query(
    collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads'),
    where('workspaceId', '==', SHARED_WORKSPACE_ID)
  );

  return onSnapshot(
    leadsQuery,
    (snapshot) => {
      const items: Lead[] = snapshot.docs.map((docSnap) =>
        mapLeadDoc(docSnap.id, docSnap.data(), SHARED_WORKSPACE_ID)
      );

      // Stable deterministic order: Caio seeded contacts keep original spreadsheet order, newest custom leads on top
      items.sort((a, b) => {
        if (a.importedFromCaioSheet && b.importedFromCaioSheet) {
          return a.id.localeCompare(b.id);
        }
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeInteractions(
  _uid: string,
  leadId: string,
  onData: (interactions: Interaction[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `workspaces/${SHARED_WORKSPACE_ID}/leads/${leadId}/interactions`;
  const interactionsQuery = query(
    collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', leadId, 'interactions'),
    where('workspaceId', '==', SHARED_WORKSPACE_ID),
    where('leadId', '==', leadId)
  );

  return onSnapshot(
    interactionsQuery,
    (snapshot) => {
      const items: Interaction[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: d.ownerId || '',
          workspaceId: d.workspaceId || SHARED_WORKSPACE_ID,
          leadId: d.leadId || leadId,
          contactedAt: d.contactedAt || '',
          channel: d.channel || 'whatsapp',
          interactionType: d.interactionType || 'follow_up',
          summary: d.summary || '',
          clientResponse: d.clientResponse || '',
          interestLevel: d.interestLevel || '',
          needsIdentified: d.needsIdentified || '',
          objections: d.objections || '',
          nextAction: d.nextAction || '',
          nextFollowUpDate: d.nextFollowUpDate || '',
          stageAfter: d.stageAfter || '',
          createdAt: d.createdAt,
        };
      });

      // Chronological newest first
      items.sort((a, b) => {
        if (a.contactedAt !== b.contactedAt) {
          return b.contactedAt.localeCompare(a.contactedAt);
        }
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createLead(uid: string, input: LeadFormInput): Promise<string> {
  const leadId = generateSafeId('lead');
  const path = `workspaces/${SHARED_WORKSPACE_ID}/leads/${leadId}`;
  const leadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', leadId);

  try {
    await setDoc(leadRef, {
      ownerId: uid,
      workspaceId: SHARED_WORKSPACE_ID,
      fullName: clampString(input.fullName, FIELD_LIMITS.fullName) || 'A confirmar',
      company: clampString(input.company, FIELD_LIMITS.company) || 'Empresa não informada',
      phone: clampString(input.phone, FIELD_LIMITS.phone),
      email: clampString(input.email, FIELD_LIMITS.email),
      city: clampString(input.city, FIELD_LIMITS.city),
      segment: clampString(input.segment, FIELD_LIMITS.segment),
      source: clampString(input.source || CAIO_REFERRAL_SOURCE, FIELD_LIMITS.source),
      importedFromCaioSheet: false,
      entryDate: clampString(input.entryDate || getTodayISO(), FIELD_LIMITS.entryDate),
      ownerName: clampString(input.ownerName, FIELD_LIMITS.ownerName),
      stage: input.stage || 'novo_lead',
      potential: input.potential || '',
      estimatedValue: sanitizeEstimatedValue(input.estimatedValue),
      notes: clampString(input.notes, FIELD_LIMITS.notes),
      meetingDate: clampString(input.meetingDate, FIELD_LIMITS.meetingDate),
      interestLevel: input.interestLevel || '',
      nextAction: clampString(input.nextAction, FIELD_LIMITS.nextAction),
      nextFollowUpDate: clampString(input.nextFollowUpDate, FIELD_LIMITS.nextFollowUpDate),
      lastContactAt: '',
      lastInteractionSummary: '',
      interactionCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return leadId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLeadStage(
  _uid: string,
  leadId: string,
  stage: FunnelStage
): Promise<void> {
  const path = `workspaces/${SHARED_WORKSPACE_ID}/leads/${leadId}`;
  const leadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', leadId);
  try {
    await updateDoc(leadRef, {
      stage,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLeadDetails(
  _uid: string,
  leadId: string,
  input: LeadFormInput
): Promise<void> {
  const path = `workspaces/${SHARED_WORKSPACE_ID}/leads/${leadId}`;
  const leadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', leadId);
  try {
    await updateDoc(leadRef, {
      fullName: clampString(input.fullName, FIELD_LIMITS.fullName) || 'A confirmar',
      company: clampString(input.company, FIELD_LIMITS.company) || 'Empresa não informada',
      phone: clampString(input.phone, FIELD_LIMITS.phone),
      email: clampString(input.email, FIELD_LIMITS.email),
      city: clampString(input.city, FIELD_LIMITS.city),
      segment: clampString(input.segment, FIELD_LIMITS.segment),
      source: clampString(input.source || CAIO_REFERRAL_SOURCE, FIELD_LIMITS.source),
      entryDate: clampString(input.entryDate, FIELD_LIMITS.entryDate),
      ownerName: clampString(input.ownerName, FIELD_LIMITS.ownerName),
      stage: input.stage,
      potential: input.potential,
      estimatedValue: sanitizeEstimatedValue(input.estimatedValue),
      notes: clampString(input.notes, FIELD_LIMITS.notes),
      meetingDate: clampString(input.meetingDate, FIELD_LIMITS.meetingDate),
      interestLevel: input.interestLevel,
      nextAction: clampString(input.nextAction, FIELD_LIMITS.nextAction),
      nextFollowUpDate: clampString(input.nextFollowUpDate, FIELD_LIMITS.nextFollowUpDate),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLead(_uid: string, leadId: string): Promise<void> {
  const path = `workspaces/${SHARED_WORKSPACE_ID}/leads/${leadId}`;
  const leadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', leadId);
  try {
    await deleteDoc(leadRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function logInteraction(
  uid: string,
  lead: Lead,
  input: InteractionFormInput
): Promise<void> {
  const interactionId = generateSafeId('int');
  const interactionPath = `workspaces/${SHARED_WORKSPACE_ID}/leads/${lead.id}/interactions/${interactionId}`;
  const interactionRef = doc(
    db,
    'workspaces',
    SHARED_WORKSPACE_ID,
    'leads',
    lead.id,
    'interactions',
    interactionId
  );
  const leadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', lead.id);

  const summaryClean = clampString(input.summary, FIELD_LIMITS.interactionSummary);
  if (!summaryClean) {
    throw new Error('O resumo da conversa é obrigatório.');
  }

  const nextStage: FunnelStage = input.stageAfter || lead.stage;
  const nextInterest = input.interestLevel !== '' ? input.interestLevel : lead.interestLevel;
  const nextActionVal = clampString(input.nextAction, FIELD_LIMITS.nextAction) || lead.nextAction;
  const nextFollowUpVal =
    clampString(input.nextFollowUpDate, FIELD_LIMITS.nextFollowUpDate) || lead.nextFollowUpDate;
  const nextMeetingDate =
    input.meetingDate !== undefined
      ? clampString(input.meetingDate, FIELD_LIMITS.meetingDate)
      : lead.meetingDate;

  try {
    const batch = writeBatch(db);

    batch.set(interactionRef, {
      ownerId: uid,
      workspaceId: SHARED_WORKSPACE_ID,
      leadId: lead.id,
      contactedAt: clampString(input.contactedAt, FIELD_LIMITS.lastContactAt),
      channel: input.channel,
      interactionType: input.interactionType,
      summary: summaryClean,
      clientResponse: clampString(input.clientResponse, FIELD_LIMITS.clientResponse),
      interestLevel: input.interestLevel,
      needsIdentified: clampString(input.needsIdentified, FIELD_LIMITS.needsIdentified),
      objections: clampString(input.objections, FIELD_LIMITS.objections),
      nextAction: clampString(input.nextAction, FIELD_LIMITS.nextAction),
      nextFollowUpDate: clampString(input.nextFollowUpDate, FIELD_LIMITS.nextFollowUpDate),
      stageAfter: input.stageAfter,
      createdAt: serverTimestamp(),
    });

    batch.update(leadRef, {
      stage: nextStage,
      interestLevel: nextInterest,
      nextAction: nextActionVal,
      nextFollowUpDate: nextFollowUpVal,
      lastContactAt: clampString(input.contactedAt, FIELD_LIMITS.lastContactAt),
      lastInteractionSummary: clampString(summaryClean, FIELD_LIMITS.lastInteractionSummary),
      interactionCount: lead.interactionCount + 1,
      meetingDate: nextMeetingDate,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, interactionPath);
  }
}

export async function restoreMissingCaioContacts(
  uid: string,
  existingLeads: Lead[]
): Promise<number> {
  const existingIds = new Set(existingLeads.map((l) => l.id));
  const todayISO = getTodayISO();
  const seeds = getCaioSeedContacts(todayISO).filter((s) => !existingIds.has(s.seedId));
  if (seeds.length === 0) return 0;

  const path = `workspaces/${SHARED_WORKSPACE_ID}/leads`;
  try {
    const batch = writeBatch(db);
    for (const seed of seeds) {
      const leadRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'leads', seed.seedId);
      batch.set(leadRef, {
        ownerId: uid,
        workspaceId: SHARED_WORKSPACE_ID,
        fullName: clampString(seed.fullName, FIELD_LIMITS.fullName) || 'A confirmar',
        company: clampString(seed.company, FIELD_LIMITS.company) || 'Empresa não informada',
        phone: clampString(seed.phone, FIELD_LIMITS.phone),
        email: clampString(seed.email, FIELD_LIMITS.email),
        city: clampString(seed.city, FIELD_LIMITS.city),
        segment: clampString(seed.segment, FIELD_LIMITS.segment),
        source: clampString(seed.source || CAIO_REFERRAL_SOURCE, FIELD_LIMITS.source),
        importedFromCaioSheet: true,
        entryDate: clampString(seed.entryDate || todayISO, FIELD_LIMITS.entryDate),
        ownerName: clampString(seed.ownerName, FIELD_LIMITS.ownerName),
        stage: seed.stage,
        potential: seed.potential,
        estimatedValue: sanitizeEstimatedValue(seed.estimatedValue),
        notes: clampString(seed.notes, FIELD_LIMITS.notes),
        meetingDate: clampString(seed.meetingDate, FIELD_LIMITS.meetingDate),
        interestLevel: seed.interestLevel,
        nextAction: clampString(seed.nextAction, FIELD_LIMITS.nextAction),
        nextFollowUpDate: clampString(seed.nextFollowUpDate, FIELD_LIMITS.nextFollowUpDate),
        lastContactAt: '',
        lastInteractionSummary: '',
        interactionCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return seeds.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
