import {
  FUNNEL_STAGES,
  type DuplicateMatch,
  type FunnelStage,
  type InterestLevel,
  type Lead,
  type LeadFormInput,
} from '../types/crm';

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNowLocalDateTimeInput(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function getWhatsAppUrl(
  phone: string,
  lead?: Pick<Lead, 'fullName' | 'company' | 'importedFromCaioSheet'>
): string | null {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 8) return null;
  const normalized = digits.startsWith('55') ? digits : `55${digits}`;
  if (!lead) return `https://wa.me/${normalized}`;

  const firstName =
    lead.fullName && lead.fullName.toLowerCase() !== 'a confirmar'
      ? lead.fullName.split(' ')[0]
      : '';
  const greeting = firstName ? `Olá ${firstName}, tudo bem?` : 'Olá, tudo bem?';
  const body = lead.importedFromCaioSheet
    ? `${greeting} Aqui é da Talli Marketing. O Caio Pelisson nos indicou o contato da ${lead.company} e gostaria de apresentar como ajudamos marcas de arquitetura e decoração a vender mais.`
    : `${greeting} Aqui é da Talli Marketing, falando com o pessoal da ${lead.company}.`;

  return `https://wa.me/${normalized}?text=${encodeURIComponent(body)}`;
}

export function getNextStage(stage: FunnelStage): FunnelStage | null {
  const idx = FUNNEL_STAGES.findIndex((s) => s.id === stage);
  if (idx < 0 || idx >= FUNNEL_STAGES.length - 2) return null; // Stop before 'perdido'
  return FUNNEL_STAGES[idx + 1].id;
}

export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeBR(dateTimeStr: string): string {
  if (!dateTimeStr) return '—';
  const datePart = formatDateBR(dateTimeStr.slice(0, 10));
  if (dateTimeStr.length >= 16 && dateTimeStr.includes('T')) {
    return `${datePart} às ${dateTimeStr.slice(11, 16)}`;
  }
  return datePart;
}

export function daysBetweenISO(fromDateISO: string, toDateISO: string): number {
  const from = new Date(`${fromDateISO.slice(0, 10)}T00:00:00`);
  const to = new Date(`${toDateISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function isClosedStage(stage: FunnelStage): boolean {
  return stage === 'venda_fechada' || stage === 'perdido';
}

export type FollowUpUrgency = 'atrasado' | 'hoje' | 'agendado' | 'sem_data';

export function getFollowUpUrgency(lead: Lead, todayISO = getTodayISO()): FollowUpUrgency {
  if (isClosedStage(lead.stage) || !lead.nextFollowUpDate) {
    return 'sem_data';
  }
  const target = lead.nextFollowUpDate.slice(0, 10);
  if (target < todayISO) return 'atrasado';
  if (target === todayISO) return 'hoje';
  return 'agendado';
}

export function getDaysWithoutInteraction(lead: Lead, todayISO = getTodayISO()): number {
  const reference = lead.lastContactAt ? lead.lastContactAt.slice(0, 10) : lead.entryDate;
  if (!reference) return 0;
  return Math.max(0, daysBetweenISO(reference, todayISO));
}

export function getInterestLabel(level: InterestLevel): string {
  switch (level) {
    case 'muito_quente':
      return 'Muito quente';
    case 'quente':
      return 'Quente';
    case 'morno':
      return 'Morno';
    case 'frio':
      return 'Frio';
    default:
      return 'Não avaliado';
  }
}

export function getPotentialLabel(potential: Lead['potential']): string {
  switch (potential) {
    case 'alto':
      return 'Alto';
    case 'medio':
      return 'Médio';
    case 'baixo':
      return 'Baixo';
    default:
      return 'Não definido';
  }
}

export function detectDuplicates(leads: Lead[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const byPhone = new Map<string, Lead[]>();
  const byEmail = new Map<string, Lead[]>();
  const byCompany = new Map<string, Lead[]>();
  const byName = new Map<string, Lead[]>();

  for (const lead of leads) {
    const phoneDigits = normalizePhoneDigits(lead.phone);
    if (phoneDigits.length >= 8) {
      const list = byPhone.get(phoneDigits) ?? [];
      list.push(lead);
      byPhone.set(phoneDigits, list);
    }

    const emailNorm = lead.email.trim().toLowerCase();
    if (emailNorm.length >= 5) {
      const list = byEmail.get(emailNorm) ?? [];
      list.push(lead);
      byEmail.set(emailNorm, list);
    }

    const companyNorm = normalizeText(lead.company);
    if (companyNorm.length >= 3) {
      const list = byCompany.get(companyNorm) ?? [];
      list.push(lead);
      byCompany.set(companyNorm, list);
    }

    const nameNorm = normalizeText(lead.fullName);
    if (nameNorm.length >= 3 && nameNorm !== 'a confirmar' && nameNorm !== 'pendente') {
      const list = byName.get(nameNorm) ?? [];
      list.push(lead);
      byName.set(nameNorm, list);
    }
  }

  for (const [val, list] of byPhone.entries()) {
    if (list.length > 1) matches.push({ reason: 'telefone', value: val, leads: list });
  }
  for (const [val, list] of byEmail.entries()) {
    if (list.length > 1) matches.push({ reason: 'email', value: val, leads: list });
  }
  for (const [val, list] of byCompany.entries()) {
    if (list.length > 1) matches.push({ reason: 'empresa', value: list[0].company, leads: list });
  }
  for (const [val, list] of byName.entries()) {
    if (list.length > 1) matches.push({ reason: 'nome', value: list[0].fullName, leads: list });
  }

  return matches;
}

export function findPotentialDuplicatesForInput(
  leads: Lead[],
  input: Pick<LeadFormInput, 'fullName' | 'company' | 'phone' | 'email'>,
  excludeLeadId?: string
): { lead: Lead; reasons: string[] }[] {
  const inputPhone = normalizePhoneDigits(input.phone);
  const inputEmail = input.email.trim().toLowerCase();
  const inputCompany = normalizeText(input.company);
  const inputName = normalizeText(input.fullName);

  const flagged: { lead: Lead; reasons: string[] }[] = [];

  for (const lead of leads) {
    if (excludeLeadId && lead.id === excludeLeadId) continue;
    const reasons: string[] = [];

    const existingPhone = normalizePhoneDigits(lead.phone);
    if (inputPhone.length >= 8 && existingPhone && inputPhone === existingPhone) {
      reasons.push('mesmo telefone');
    }
    const existingEmail = lead.email.trim().toLowerCase();
    if (inputEmail.length >= 5 && existingEmail && inputEmail === existingEmail) {
      reasons.push('mesmo e-mail');
    }
    const existingCompany = normalizeText(lead.company);
    if (inputCompany.length >= 3 && existingCompany && inputCompany === existingCompany) {
      reasons.push('mesma empresa');
    }
    const existingName = normalizeText(lead.fullName);
    if (
      inputName.length >= 3 &&
      inputName !== 'a confirmar' &&
      existingName &&
      inputName === existingName
    ) {
      reasons.push('mesmo nome');
    }

    if (reasons.length > 0) {
      flagged.push({ lead, reasons });
    }
  }

  return flagged;
}

export interface DashboardMetrics {
  totalLeads: number;
  caioImportedCount: number;
  withPhoneCount: number;
  withoutPhoneCount: number;
  notContactedCount: number;
  contactedCount: number;
  meetingsScheduledCount: number;
  proposalsSentCount: number;
  negotiationsCount: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
  pipelineValue: number;
  wonValue: number;
  overdueFollowUpsCount: number;
  todayFollowUpsCount: number;
  stageCounts: Record<FunnelStage, number>;
  stageValues: Record<FunnelStage, number>;
  interestCounts: Record<InterestLevel, number>;
}

export function computeDashboardMetrics(leads: Lead[], todayISO = getTodayISO()): DashboardMetrics {
  const stageCounts = FUNNEL_STAGES.reduce(
    (acc, s) => {
      acc[s.id] = 0;
      return acc;
    },
    {} as Record<FunnelStage, number>
  );

  const stageValues = FUNNEL_STAGES.reduce(
    (acc, s) => {
      acc[s.id] = 0;
      return acc;
    },
    {} as Record<FunnelStage, number>
  );

  const interestCounts: Record<InterestLevel, number> = {
    muito_quente: 0,
    quente: 0,
    morno: 0,
    frio: 0,
    '': 0,
  };

  let caioImportedCount = 0;
  let withPhoneCount = 0;
  let withoutPhoneCount = 0;
  let notContactedCount = 0;
  let contactedCount = 0;
  let meetingsScheduledCount = 0;
  let proposalsSentCount = 0;
  let negotiationsCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  let pipelineValue = 0;
  let wonValue = 0;
  let overdueFollowUpsCount = 0;
  let todayFollowUpsCount = 0;

  for (const lead of leads) {
    stageCounts[lead.stage] = (stageCounts[lead.stage] || 0) + 1;
    const val = typeof lead.estimatedValue === 'number' && lead.estimatedValue > 0 ? lead.estimatedValue : 0;
    stageValues[lead.stage] = (stageValues[lead.stage] || 0) + val;

    interestCounts[lead.interestLevel] = (interestCounts[lead.interestLevel] || 0) + 1;

    if (lead.importedFromCaioSheet) caioImportedCount++;
    if (normalizePhoneDigits(lead.phone).length >= 8) {
      withPhoneCount++;
    } else {
      withoutPhoneCount++;
    }

    if (lead.stage === 'novo_lead' && lead.interactionCount === 0) {
      notContactedCount++;
    } else {
      contactedCount++;
    }

    if (lead.stage === 'reuniao_agendada') meetingsScheduledCount++;
    if (lead.stage === 'proposta_enviada') proposalsSentCount++;
    if (lead.stage === 'em_negociacao') negotiationsCount++;
    if (lead.stage === 'venda_fechada') {
      wonCount++;
      wonValue += val;
    } else if (lead.stage === 'perdido') {
      lostCount++;
    } else {
      pipelineValue += val;
    }

    const urgency = getFollowUpUrgency(lead, todayISO);
    if (urgency === 'atrasado') overdueFollowUpsCount++;
    if (urgency === 'hoje') todayFollowUpsCount++;
  }

  const totalLeads = leads.length;
  const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;

  return {
    totalLeads,
    caioImportedCount,
    withPhoneCount,
    withoutPhoneCount,
    notContactedCount,
    contactedCount,
    meetingsScheduledCount,
    proposalsSentCount,
    negotiationsCount,
    wonCount,
    lostCount,
    conversionRate,
    pipelineValue,
    wonValue,
    overdueFollowUpsCount,
    todayFollowUpsCount,
    stageCounts,
    stageValues,
    interestCounts,
  };
}

export function exportLeadsToCsv(leads: Lead[]): void {
  const headers = [
    'Nome Completo',
    'Empresa',
    'Telefone / WhatsApp',
    'E-mail',
    'Cidade',
    'Segmento',
    'Origem',
    'Data de Entrada',
    'Responsável',
    'Etapa do Funil',
    'Potencial',
    'Valor Estimado (R$)',
    'Nível de Interesse',
    'Data da Reunião',
    'Último Contato',
    'Próxima Ação',
    'Próximo Follow-up',
    'Interações Registradas',
    'Observações',
  ];

  const escapeCsv = (val: string | number | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes('"') || str.includes(';') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = leads.map((lead) => [
    lead.fullName,
    lead.company,
    lead.phone,
    lead.email,
    lead.city,
    lead.segment,
    lead.source,
    lead.entryDate,
    lead.ownerName,
    FUNNEL_STAGES.find((s) => s.id === lead.stage)?.label ?? lead.stage,
    getPotentialLabel(lead.potential),
    lead.estimatedValue ?? '',
    getInterestLabel(lead.interestLevel),
    lead.meetingDate,
    lead.lastContactAt,
    lead.nextAction,
    lead.nextFollowUpDate,
    lead.interactionCount,
    lead.notes,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `talli-crm-contatos-${getTodayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
