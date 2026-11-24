import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  MessageSquarePlus,
  Phone,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  FUNNEL_STAGES,
  INTEREST_OPTIONS,
  type FunnelStage,
  type InterestLevel,
  type Lead,
} from '../types/crm';
import {
  detectDuplicates,
  exportLeadsToCsv,
  formatCurrencyBRL,
  formatDateBR,
  getFollowUpUrgency,
  getInterestLabel,
  getTodayISO,
  getWhatsAppUrl,
  normalizePhoneDigits,
  normalizeText,
} from '../lib/crmUtils';

type SortOption =
  | 'default'
  | 'next_followup'
  | 'last_contact'
  | 'entry_date'
  | 'estimated_value'
  | 'company';

type ReadinessFilter = 'all' | 'with_phone' | 'without_phone' | 'caio_only';

interface ContactsViewProps {
  leads: Lead[];
  initialStageFilter: FunnelStage | 'all';
  onStageFilterChange: (stage: FunnelStage | 'all') => void;
  onSelectLead: (lead: Lead) => void;
  onLogInteraction: (lead: Lead) => void;
  onChangeStage: (leadId: string, stage: FunnelStage) => Promise<void>;
  onOpenNewLead: () => void;
  onRestoreMissingCaio: () => Promise<number>;
}

export function ContactsView({
  leads,
  initialStageFilter,
  onStageFilterChange,
  onSelectLead,
  onLogInteraction,
  onChangeStage,
  onOpenNewLead,
  onRestoreMissingCaio,
}: ContactsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [interestFilter, setInterestFilter] = useState<InterestLevel | 'all'>('all');
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const todayISO = getTodayISO();
  const duplicates = useMemo(() => detectDuplicates(leads), [leads]);

  const missingCaioCount = useMemo(() => {
    const ids = new Set(leads.map((l) => l.id));
    let missing = 0;
    for (let i = 1; i <= 7; i++) {
      if (!ids.has(`caio-lead-${i}`)) missing++;
    }
    return missing;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const queryNorm = normalizeText(searchTerm);
    const queryDigits = normalizePhoneDigits(searchTerm);

    const list = leads.filter((lead) => {
      if (initialStageFilter !== 'all' && lead.stage !== initialStageFilter) {
        return false;
      }
      if (interestFilter !== 'all' && lead.interestLevel !== interestFilter) {
        return false;
      }
      if (readinessFilter === 'with_phone' && normalizePhoneDigits(lead.phone).length < 8) {
        return false;
      }
      if (readinessFilter === 'without_phone' && normalizePhoneDigits(lead.phone).length >= 8) {
        return false;
      }
      if (readinessFilter === 'caio_only' && !lead.importedFromCaioSheet) {
        return false;
      }

      if (queryNorm || queryDigits) {
        const matchName = normalizeText(lead.fullName).includes(queryNorm);
        const matchCompany = normalizeText(lead.company).includes(queryNorm);
        const matchNotes = normalizeText(lead.notes).includes(queryNorm);
        const matchPhone =
          queryDigits.length > 0 && normalizePhoneDigits(lead.phone).includes(queryDigits);
        const matchPhoneRaw = lead.phone.toLowerCase().includes(searchTerm.trim().toLowerCase());
        if (!matchName && !matchCompany && !matchNotes && !matchPhone && !matchPhoneRaw) {
          return false;
        }
      }

      return true;
    });

    const sorted = [...list];
    if (sortBy === 'next_followup') {
      sorted.sort((a, b) => {
        if (!a.nextFollowUpDate && !b.nextFollowUpDate) return 0;
        if (!a.nextFollowUpDate) return 1;
        if (!b.nextFollowUpDate) return -1;
        return a.nextFollowUpDate.localeCompare(b.nextFollowUpDate);
      });
    } else if (sortBy === 'last_contact') {
      sorted.sort((a, b) => {
        if (!a.lastContactAt && !b.lastContactAt) return 0;
        if (!a.lastContactAt) return 1;
        if (!b.lastContactAt) return -1;
        return b.lastContactAt.localeCompare(a.lastContactAt);
      });
    } else if (sortBy === 'entry_date') {
      sorted.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
    } else if (sortBy === 'estimated_value') {
      sorted.sort((a, b) => (b.estimatedValue ?? -1) - (a.estimatedValue ?? -1));
    } else if (sortBy === 'company') {
      sorted.sort((a, b) => a.company.localeCompare(b.company, 'pt-BR'));
    }

    return sorted;
  }, [leads, searchTerm, initialStageFilter, interestFilter, readinessFilter, sortBy]);

  const handleInlineStageChange = async (leadId: string, newStage: FunnelStage) => {
    setUpdatingStageId(leadId);
    try {
      await onChangeStage(leadId, newStage);
    } finally {
      setUpdatingStageId(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await onRestoreMissingCaio();
    } finally {
      setRestoring(false);
    }
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    initialStageFilter !== 'all' ||
    interestFilter !== 'all' ||
    readinessFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono tracking-wider text-[#12241D]/55 uppercase">
            Prospecção e Relacionamento
          </p>
          <h1 className="text-3xl font-light tracking-tight text-[#12241D] mt-0.5">
            Base de <em className="italic font-light">contatos</em>
          </h1>
          <p className="text-xs font-mono tabular-nums text-[#12241D]/60 mt-1">
            {filteredLeads.length} de {leads.length} contatos exibidos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {missingCaioCount > 0 && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={restoring}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#12241D] bg-white border border-[#E2DDD2] rounded-lg hover:border-[#12241D] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {restoring
                ? 'Restaurando...'
                : `Restaurar ${missingCaioCount} da planilha`}
            </button>
          )}
          <button
            type="button"
            onClick={() => exportLeadsToCsv(filteredLeads)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#12241D] bg-white border border-[#E2DDD2] rounded-lg hover:border-[#12241D] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Duplicate Detection Status Bar */}
      {duplicates.length > 0 ? (
        <div className="bg-[#FFF1BF]/80 border border-[#FFD23F] rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-[#12241D]">
          <AlertCircle className="w-4 h-4 text-[#8A6100] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">
              {duplicates.length}{' '}
              {duplicates.length === 1
                ? 'possível duplicidade detectada'
                : 'possíveis duplicidades detectadas'}
              :
            </span>{' '}
            {duplicates
              .map(
                (d) =>
                  `${d.reason} "${d.value}" (${d.leads.map((l) => l.company).join(', ')})`
              )
              .join(' · ')}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-[#12241D]/60 px-1">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1D6F42] shrink-0" />
            Auditoria de duplicidades: base íntegra, nenhuma duplicidade encontrada.
          </span>
          <span className="hidden sm:inline font-mono tabular-nums text-[#12241D]/45">
            Planilha Caio Pelisson · 7 originais
          </span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-[#E2DDD2] rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#12241D]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por empresa, nome, telefone ou observação..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#F4F1EA]/70 border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/45 focus:bg-white focus:outline-none focus:border-[#12241D] transition-colors"
            />
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filtrar por etapa do funil"
              value={initialStageFilter}
              onChange={(e) => onStageFilterChange(e.target.value as FunnelStage | 'all')}
              className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/70 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D] transition-colors"
            >
              <option value="all">Todas as 10 etapas</option>
              {FUNNEL_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {String(stage.order).padStart(2, '0')}. {stage.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filtrar por nível de interesse"
              value={interestFilter}
              onChange={(e) => setInterestFilter(e.target.value as InterestLevel | 'all')}
              className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/70 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D] transition-colors"
            >
              <option value="all">Todos os interesses</option>
              {INTEREST_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Ordenar contatos"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/70 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D] transition-colors"
            >
              <option value="default">Ordem padrão</option>
              <option value="next_followup">Próximo follow-up</option>
              <option value="last_contact">Último contato</option>
              <option value="entry_date">Data de entrada</option>
              <option value="estimated_value">Maior valor estimado</option>
              <option value="company">Empresa (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Segmented Readiness Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="inline-flex items-center gap-1 p-1 bg-[#F4F1EA] rounded-lg overflow-x-auto max-w-full">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'with_phone', label: 'Com telefone' },
                { id: 'without_phone', label: 'Aguardando número' },
                { id: 'caio_only', label: 'Indicações do Caio' },
              ] as { id: ReadinessFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setReadinessFilter(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  readinessFilter === tab.id
                    ? 'bg-[#12241D] text-[#F4F1EA]'
                    : 'text-[#12241D]/70 hover:text-[#12241D]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                onStageFilterChange('all');
                setInterestFilter('all');
                setReadinessFilter('all');
              }}
              className="text-xs font-semibold text-[#C43E0F] hover:text-[#FF5A1F] cursor-pointer whitespace-nowrap"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white border border-[#E2DDD2] rounded-xl overflow-hidden">
        {filteredLeads.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-[#12241D]">
              Nenhum contato encontrado com os filtros atuais.
            </p>
            <p className="text-xs text-[#12241D]/60 mt-1">
              Limpe os filtros ou cadastre um novo contato na operação comercial.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    onStageFilterChange('all');
                    setInterestFilter('all');
                    setReadinessFilter('all');
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-[#12241D] bg-white border border-[#E2DDD2] rounded-lg hover:border-[#12241D] cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
              <button
                type="button"
                onClick={onOpenNewLead}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo contato
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD2] bg-[#F4F1EA]/65 text-[11px] font-mono uppercase tracking-wider text-[#12241D]/60">
                    <th className="py-3 pl-5 pr-3">Empresa / Contato</th>
                    <th className="py-3 px-3">Telefone / WhatsApp</th>
                    <th className="py-3 px-3">Etapa do funil</th>
                    <th className="py-3 px-3">Interesse / Histórico</th>
                    <th className="py-3 px-3">Próximo follow-up</th>
                    <th className="py-3 px-3 text-right">Valor est.</th>
                    <th className="py-3 pl-3 pr-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE4] text-sm">
                  {filteredLeads.map((lead) => {
                    const urgency = getFollowUpUrgency(lead, todayISO);
                    const waUrl = getWhatsAppUrl(lead.phone, lead);
                    const hasPhone = normalizePhoneDigits(lead.phone).length >= 8;

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-[#F4F1EA]/55 transition-colors group"
                      >
                        <td
                          className="py-3.5 pl-5 pr-3 cursor-pointer max-w-[280px]"
                          onClick={() => onSelectLead(lead)}
                        >
                          <p className="font-semibold text-[#12241D] truncate group-hover:text-[#C43E0F] transition-colors">
                            {lead.company}
                          </p>
                          <p className="text-xs text-[#12241D]/70 truncate mt-0.5">
                            {lead.fullName}
                            {lead.importedFromCaioSheet && (
                              <>
                                <span aria-hidden="true" className="mx-1.5 text-[#12241D]/30">
                                  ·
                                </span>
                                <span>Indicação Caio</span>
                              </>
                            )}
                          </p>
                          {(lead.lastInteractionSummary || lead.segment) && (
                            <p className="text-xs text-[#12241D]/45 truncate mt-0.5">
                              {lead.lastInteractionSummary || lead.segment}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {hasPhone ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-[#12241D]">
                                <span className="w-1.5 h-1.5 bg-[#1D6F42] inline-block" aria-hidden="true" />
                                {lead.phone}
                              </span>
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir WhatsApp com mensagem pronta"
                                  className="text-[#1D6F42] hover:bg-[#E7F4EC] p-1 rounded transition-colors"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#12241D]/55">
                              <span className="w-1.5 h-1.5 bg-[#FFD23F] inline-block" aria-hidden="true" />
                              Aguardando número
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <select
                            aria-label={`Etapa de ${lead.company}`}
                            value={lead.stage}
                            disabled={updatingStageId === lead.id}
                            onChange={(e) =>
                              void handleInlineStageChange(
                                lead.id,
                                e.target.value as FunnelStage
                              )
                            }
                            className="max-w-[205px] w-full text-xs bg-white border border-[#E2DDD2] rounded-lg px-2.5 py-1.5 text-[#12241D] hover:border-[#12241D] focus:outline-none focus:border-[#12241D] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {FUNNEL_STAGES.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {String(stage.order).padStart(2, '0')}. {stage.shortLabel}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-xs text-[#12241D]/75">
                          <span>{getInterestLabel(lead.interestLevel)}</span>
                          <span className="block text-[11px] text-[#12241D]/45 font-mono tabular-nums mt-0.5">
                            {lead.interactionCount}{' '}
                            {lead.interactionCount === 1 ? 'interação' : 'interações'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {lead.nextFollowUpDate ? (
                            <div>
                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-mono tabular-nums ${
                                  urgency === 'atrasado'
                                    ? 'text-[#C93B2B] font-semibold'
                                    : urgency === 'hoje'
                                      ? 'text-[#C43E0F] font-semibold'
                                      : 'text-[#12241D]/75'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 inline-block ${
                                    urgency === 'atrasado'
                                      ? 'bg-[#C93B2B]'
                                      : urgency === 'hoje'
                                        ? 'bg-[#FF5A1F]'
                                        : 'bg-[#22392F]'
                                  }`}
                                  aria-hidden="true"
                                />
                                {formatDateBR(lead.nextFollowUpDate)}
                              </span>
                              {urgency === 'atrasado' && (
                                <span className="block text-[11px] text-[#C93B2B]">Atrasado</span>
                              )}
                              {urgency === 'hoje' && (
                                <span className="block text-[11px] text-[#C43E0F]">Para hoje</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-[#12241D]/35">—</span>
                          )}
                          {lead.nextAction && (
                            <span className="block text-[11px] text-[#12241D]/55 truncate max-w-[165px] mt-0.5">
                              {lead.nextAction}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right whitespace-nowrap text-xs font-mono tabular-nums text-[#12241D]">
                          {formatCurrencyBRL(lead.estimatedValue)}
                        </td>

                        <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onLogInteraction(lead)}
                              title="Registrar nova interação"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F4F1EA] bg-[#12241D] rounded-lg hover:bg-[#22392F] transition-colors cursor-pointer"
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                              Contato
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectLead(lead)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-[#12241D] hover:text-[#FF5A1F] transition-colors cursor-pointer"
                            >
                              Abrir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="lg:hidden divide-y divide-[#EFECE4]">
              {filteredLeads.map((lead) => {
                const urgency = getFollowUpUrgency(lead, todayISO);
                const waUrl = getWhatsAppUrl(lead.phone, lead);
                return (
                  <div key={lead.id} className="p-4 space-y-3">
                    <div
                      className="cursor-pointer"
                      onClick={() => onSelectLead(lead)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#12241D] truncate">
                            {lead.company}
                          </p>
                          <p className="text-xs text-[#12241D]/70 mt-0.5">
                            {lead.fullName}
                            {lead.importedFromCaioSheet && ' · Indicação Caio'}
                          </p>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-[#12241D] shrink-0">
                          {formatCurrencyBRL(lead.estimatedValue)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#12241D]/60 mt-2">
                        <span className="font-mono tabular-nums">
                          {lead.phone || 'Aguardando número'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{getInterestLabel(lead.interestLevel)}</span>
                        {lead.nextFollowUpDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                urgency === 'atrasado'
                                  ? 'text-[#C93B2B] font-semibold'
                                  : urgency === 'hoje'
                                    ? 'text-[#C43E0F] font-semibold'
                                    : ''
                              }
                            >
                              Follow-up: {formatDateBR(lead.nextFollowUpDate)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <select
                        aria-label={`Etapa de ${lead.company}`}
                        value={lead.stage}
                        onChange={(e) =>
                          void handleInlineStageChange(lead.id, e.target.value as FunnelStage)
                        }
                        className="flex-1 text-xs bg-[#F4F1EA] border border-[#E2DDD2] rounded-lg px-2.5 py-2 text-[#12241D]"
                      >
                        {FUNNEL_STAGES.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {String(stage.order).padStart(2, '0')}. {stage.shortLabel}
                          </option>
                        ))}
                      </select>

                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 border border-[#E2DDD2] rounded-lg text-[#1D6F42] bg-white"
                          aria-label="WhatsApp"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => onLogInteraction(lead)}
                        className="px-3.5 py-2 text-xs font-bold text-[#F4F1EA] bg-[#12241D] rounded-lg whitespace-nowrap"
                      >
                        Contato
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
