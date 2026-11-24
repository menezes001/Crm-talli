import type { Timestamp } from 'firebase/firestore';

export type FunnelStage =
  | 'novo_lead'
  | 'primeiro_contato'
  | 'aguardando_retorno'
  | 'contato_estabelecido'
  | 'reuniao_agendada'
  | 'reuniao_realizada'
  | 'proposta_enviada'
  | 'em_negociacao'
  | 'venda_fechada'
  | 'perdido';

export type BusinessPotential = '' | 'baixo' | 'medio' | 'alto';

export type InterestLevel = '' | 'frio' | 'morno' | 'quente' | 'muito_quente';

export type InteractionChannel = 'whatsapp' | 'ligacao' | 'email' | 'reuniao' | 'outro';

export type InteractionType =
  | 'primeiro_contato'
  | 'follow_up'
  | 'qualificacao'
  | 'reuniao'
  | 'apresentacao_proposta'
  | 'negociacao'
  | 'pos_venda'
  | 'outro';

export type ViewSection = 'dashboard' | 'contatos' | 'funil' | 'followups';

export interface Workspace {
  id: string;
  ownerId: string;
  ownerEmail: string;
  name: string;
  caioBaseImported: boolean;
  caioBaseImportedAt: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Lead {
  id: string;
  ownerId: string;
  workspaceId: string;
  fullName: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  segment: string;
  source: string;
  importedFromCaioSheet: boolean;
  entryDate: string;
  ownerName: string;
  stage: FunnelStage;
  potential: BusinessPotential;
  estimatedValue: number | null;
  notes: string;
  meetingDate: string;
  interestLevel: InterestLevel;
  nextAction: string;
  nextFollowUpDate: string;
  lastContactAt: string;
  lastInteractionSummary: string;
  interactionCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LeadFormInput {
  fullName: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  segment: string;
  source: string;
  entryDate: string;
  ownerName: string;
  stage: FunnelStage;
  potential: BusinessPotential;
  estimatedValue: number | null;
  notes: string;
  meetingDate: string;
  interestLevel: InterestLevel;
  nextAction: string;
  nextFollowUpDate: string;
}

export interface Interaction {
  id: string;
  ownerId: string;
  workspaceId: string;
  leadId: string;
  contactedAt: string;
  channel: InteractionChannel;
  interactionType: InteractionType;
  summary: string;
  clientResponse: string;
  interestLevel: InterestLevel;
  needsIdentified: string;
  objections: string;
  nextAction: string;
  nextFollowUpDate: string;
  stageAfter: FunnelStage | '';
  createdAt?: Timestamp;
}

export interface InteractionFormInput {
  contactedAt: string;
  channel: InteractionChannel;
  interactionType: InteractionType;
  summary: string;
  clientResponse: string;
  interestLevel: InterestLevel;
  needsIdentified: string;
  objections: string;
  nextAction: string;
  nextFollowUpDate: string;
  stageAfter: FunnelStage | '';
  meetingDate?: string;
}

export interface DuplicateMatch {
  reason: 'telefone' | 'email' | 'empresa' | 'nome';
  value: string;
  leads: Lead[];
}

export interface StageDefinition {
  id: FunnelStage;
  order: number;
  label: string;
  shortLabel: string;
  category: 'prospeccao' | 'qualificacao' | 'negociacao' | 'ganho' | 'perdido';
}

export const FUNNEL_STAGES: StageDefinition[] = [
  {
    id: 'novo_lead',
    order: 1,
    label: 'Novo lead – ainda não entrei em contato',
    shortLabel: 'Novo lead',
    category: 'prospeccao',
  },
  {
    id: 'primeiro_contato',
    order: 2,
    label: 'Primeiro contato realizado',
    shortLabel: '1º contato',
    category: 'prospeccao',
  },
  {
    id: 'aguardando_retorno',
    order: 3,
    label: 'Aguardando retorno',
    shortLabel: 'Aguardando retorno',
    category: 'prospeccao',
  },
  {
    id: 'contato_estabelecido',
    order: 4,
    label: 'Contato estabelecido',
    shortLabel: 'Contato estabelecido',
    category: 'qualificacao',
  },
  {
    id: 'reuniao_agendada',
    order: 5,
    label: 'Reunião agendada',
    shortLabel: 'Reunião agendada',
    category: 'qualificacao',
  },
  {
    id: 'reuniao_realizada',
    order: 6,
    label: 'Reunião realizada',
    shortLabel: 'Reunião realizada',
    category: 'qualificacao',
  },
  {
    id: 'proposta_enviada',
    order: 7,
    label: 'Proposta enviada',
    shortLabel: 'Proposta enviada',
    category: 'negociacao',
  },
  {
    id: 'em_negociacao',
    order: 8,
    label: 'Em negociação',
    shortLabel: 'Em negociação',
    category: 'negociacao',
  },
  {
    id: 'venda_fechada',
    order: 9,
    label: 'Venda fechada',
    shortLabel: 'Venda fechada',
    category: 'ganho',
  },
  {
    id: 'perdido',
    order: 10,
    label: 'Perdido / Sem interesse',
    shortLabel: 'Perdido',
    category: 'perdido',
  },
];

export const STAGE_MAP: Record<FunnelStage, StageDefinition> = FUNNEL_STAGES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<FunnelStage, StageDefinition>
);

export const POTENTIAL_OPTIONS: { value: BusinessPotential; label: string }[] = [
  { value: '', label: 'Não definido' },
  { value: 'baixo', label: 'Baixo' },
  { value: 'medio', label: 'Médio' },
  { value: 'alto', label: 'Alto' },
];

export const INTEREST_OPTIONS: { value: InterestLevel; label: string }[] = [
  { value: '', label: 'Não avaliado' },
  { value: 'frio', label: 'Frio' },
  { value: 'morno', label: 'Morno' },
  { value: 'quente', label: 'Quente' },
  { value: 'muito_quente', label: 'Muito quente' },
];

export const CHANNEL_OPTIONS: { value: InteractionChannel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'outro', label: 'Outro' },
];

export const INTERACTION_TYPE_OPTIONS: { value: InteractionType; label: string }[] = [
  { value: 'primeiro_contato', label: 'Primeiro contato' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'reuniao', label: 'Reunião comercial' },
  { value: 'apresentacao_proposta', label: 'Apresentação de proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'pos_venda', label: 'Pós-venda / Onboarding' },
  { value: 'outro', label: 'Outro' },
];

// Synchronized verbatim with firebase-blueprint.json maxLength constraints
export const FIELD_LIMITS = {
  fullName: 160,
  company: 200,
  phone: 40,
  email: 254,
  city: 120,
  segment: 300,
  source: 160,
  entryDate: 20,
  ownerName: 120,
  notes: 4000,
  meetingDate: 40,
  nextAction: 500,
  nextFollowUpDate: 20,
  lastContactAt: 40,
  lastInteractionSummary: 500,
  interactionSummary: 3000,
  clientResponse: 3000,
  needsIdentified: 2000,
  objections: 2000,
} as const;
