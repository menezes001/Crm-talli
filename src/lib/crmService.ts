import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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

export async function ensureWorkspaceAndSeed(user: User): Promise<Workspace> {
  const uid = user.uid;
  const workspacePath = `workspaces/${uid}`;
  const workspaceRef = doc(db, 'workspaces', uid);

  try {
    const snap = await getDoc(workspaceRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        ownerId: data.ownerId,
        ownerEmail: data.ownerEmail,
        name: data.name,
        caioBaseImported: Boolean(data.caioBaseImported),
        caioBaseImportedAt: data.caioBaseImportedAt || '',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }

    const nowISO = new Date().toISOString();
    const todayISO = getTodayISO();

    const workspacePayload = {
      ownerId: uid,
      ownerEmail: clampString(user.email || '', 254),
      name: 'Talli Marketing — Comercial',
      caioBaseImported: true,
      caioBaseImportedAt: nowISO,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Create workspace first so Master Gate parent lookup passes on lead batch creation
    await setDoc(workspaceRef, workspacePayload);

    const seeds = getCaioSeedContacts(todayISO);
    const batch = writeBatch(db);

    for (const seed of seeds) {
      const leadRef = doc(db, 'workspaces', uid, 'leads', seed.seedId);
      batch.set(leadRef, {
        ownerId: uid,
        workspaceId: uid,
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

    return {
      id: uid,
      ownerId: uid,
      ownerEmail: workspacePayload.ownerEmail,
      name: workspacePayload.name,
      caioBaseImported: true,
      caioBaseImportedAt: nowISO,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, workspacePath);
  }
}

export function subscribeLeads(
  uid: string,
  onData: (leads: Lead[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `workspaces/${uid}/leads`;
  const leadsQuery = query(
    collection(db, 'workspaces', uid, 'leads'),
    where('ownerId', '==', uid),
    where('workspaceId', '==', uid)
  );

  return onSnapshot(
    leadsQuery,
    (snapshot) => {
      const items: Lead[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: d.ownerId || uid,
          workspaceId: d.workspaceId || uid,
          fullName: d.fullName || '',
          company: d.company || '',
          phone: d.phone || '',
          email: d.email || '',
          city: d.city || '',
          segment: d.segment || '',
          source: d.source || CAIO_REFERRAL_SOURCE,
          importedFromCaioSheet: Boolean(d.importedFromCaioSheet),
          entryDate: d.entryDate || '',
          ownerName: d.ownerName || '',
          stage: (d.stage as FunnelStage) || 'novo_lead',
          potential: d.potential || '',
          estimatedValue:
            typeof d.estimatedValue === 'number' && !Number.isNaN(d.estimatedValue)
              ? d.estimatedValue
              : null,
          notes: d.notes || '',
          meetingDate: d.meetingDate || '',
          interestLevel: d.interestLevel || '',
          nextAction: d.nextAction || '',
          nextFollowUpDate: d.nextFollowUpDate || '',
          lastContactAt: d.lastContactAt || '',
          lastInteractionSummary: d.lastInteractionSummary || '',
          interactionCount: typeof d.interactionCount === 'number' ? d.interactionCount : 0,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      });

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
  uid: string,
  leadId: string,
  onData: (interactions: Interaction[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `workspaces/${uid}/leads/${leadId}/interactions`;
  const interactionsQuery = query(
    collection(db, 'workspaces', uid, 'leads', leadId, 'interactions'),
    where('ownerId', '==', uid),
    where('workspaceId', '==', uid),
    where('leadId', '==', leadId)
  );

  return onSnapshot(
    interactionsQuery,
    (snapshot) => {
      const items: Interaction[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: d.ownerId || uid,
          workspaceId: d.workspaceId || uid,
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
  const path = `workspaces/${uid}/leads/${leadId}`;
  const leadRef = doc(db, 'workspaces', uid, 'leads', leadId);

  try {
    await setDoc(leadRef, {
      ownerId: uid,
      workspaceId: uid,
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
  uid: string,
  leadId: string,
  stage: FunnelStage
): Promise<void> {
  const path = `workspaces/${uid}/leads/${leadId}`;
  const leadRef = doc(db, 'workspaces', uid, 'leads', leadId);
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
  uid: string,
  leadId: string,
  input: LeadFormInput
): Promise<void> {
  const path = `workspaces/${uid}/leads/${leadId}`;
  const leadRef = doc(db, 'workspaces', uid, 'leads', leadId);
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

export async function deleteLead(uid: string, leadId: string): Promise<void> {
  const path = `workspaces/${uid}/leads/${leadId}`;
  const leadRef = doc(db, 'workspaces', uid, 'leads', leadId);
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
  const interactionPath = `workspaces/${uid}/leads/${lead.id}/interactions/${interactionId}`;
  const interactionRef = doc(db, 'workspaces', uid, 'leads', lead.id, 'interactions', interactionId);
  const leadRef = doc(db, 'workspaces', uid, 'leads', lead.id);

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
      workspaceId: uid,
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

  const path = `workspaces/${uid}/leads`;
  try {
    const batch = writeBatch(db);
    for (const seed of seeds) {
      const leadRef = doc(db, 'workspaces', uid, 'leads', seed.seedId);
      batch.set(leadRef, {
        ownerId: uid,
        workspaceId: uid,
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
