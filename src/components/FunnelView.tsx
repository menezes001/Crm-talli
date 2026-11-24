import { useMemo, useRef, useState } from 'react';
import { ArrowRight, MessageSquarePlus, Phone, Search } from 'lucide-react';
import {
  FUNNEL_STAGES,
  INTEREST_OPTIONS,
  STAGE_MAP,
  type FunnelStage,
  type InterestLevel,
  type Lead,
} from '../types/crm';
import {
  formatCurrencyBRL,
  formatDateBR,
  getFollowUpUrgency,
  getInterestLabel,
  getNextStage,
  getTodayISO,
  getWhatsAppUrl,
  normalizePhoneDigits,
  normalizeText,
} from '../lib/crmUtils';

type PhaseFilter = 'todas' | 'prospeccao' | 'qualificacao' | 'negociacao' | 'fechamento' | 'com_leads';

interface FunnelViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onLogInteraction: (lead: Lead) => void;
  onChangeStage: (leadId: string, stage: FunnelStage) => Promise<void>;
}

export function FunnelView({
  leads,
  onSelectLead,
  onLogInteraction,
  onChangeStage,
}: FunnelViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [interestFilter, setInterestFilter] = useState<InterestLevel | 'all'>('all');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('todas');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<FunnelStage | null>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const todayISO = getTodayISO();

  const filteredLeads = useMemo(() => {
    const qNorm = normalizeText(searchTerm);
    const qDigits = normalizePhoneDigits(searchTerm);

    return leads.filter((lead) => {
      if (interestFilter !== 'all' && lead.interestLevel !== interestFilter) {
        return false;
      }
      if (qNorm || qDigits) {
        const matchName = normalizeText(lead.fullName).includes(qNorm);
        const matchCompany = normalizeText(lead.company).includes(qNorm);
        const matchPhone =
          qDigits.length > 0 && normalizePhoneDigits(lead.phone).includes(qDigits);
        if (!matchName && !matchCompany && !matchPhone) return false;
      }
      return true;
    });
  }, [leads, searchTerm, interestFilter]);

  const leadsByStage = useMemo(() => {
    const map = FUNNEL_STAGES.reduce(
      (acc, stage) => {
        acc[stage.id] = [];
        return acc;
      },
      {} as Record<FunnelStage, Lead[]>
    );
    for (const lead of filteredLeads) {
      map[lead.stage].push(lead);
    }
    return map;
  }, [filteredLeads]);

  const visibleStages = useMemo(() => {
    if (phaseFilter === 'todas') return FUNNEL_STAGES;
    if (phaseFilter === 'com_leads') {
      const nonEmpty = FUNNEL_STAGES.filter((s) => leadsByStage[s.id].length > 0);
      return nonEmpty.length > 0 ? nonEmpty : FUNNEL_STAGES;
    }
    if (phaseFilter === 'fechamento') {
      return FUNNEL_STAGES.filter((s) => s.category === 'ganho' || s.category === 'perdido');
    }
    return FUNNEL_STAGES.filter((s) => s.category === phaseFilter);
  }, [phaseFilter, leadsByStage]);

  const scrollToStage = (stageId: FunnelStage) => {
    setPhaseFilter('todas');
    setTimeout(() => {
      columnRefs.current[stageId]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }, 50);
  };

  const handleDrop = async (targetStage: FunnelStage) => {
    setDragOverStage(null);
    if (!draggedLeadId) return;
    const lead = leads.find((l) => l.id === draggedLeadId);
    setDraggedLeadId(null);
    if (!lead || lead.stage === targetStage) return;
    await onChangeStage(lead.id, targetStage);
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono tracking-wider text-[#12241D]/55 uppercase">
            Pipeline Comercial
          </p>
          <h1 className="text-3xl font-light tracking-tight text-[#12241D] mt-0.5">
            Funil de <em className="italic font-light">vendas</em>
          </h1>
          <p className="text-xs text-[#12241D]/60 mt-1">
            Arraste cartões, use &ldquo;Avançar&rdquo; em 1 clique ou filtre por fase para focar nas etapas desejadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#12241D]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar no funil..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/45 focus:outline-none focus:border-[#12241D] w-48"
            />
          </div>

          <select
            aria-label="Filtrar por interesse no funil"
            value={interestFilter}
            onChange={(e) => setInterestFilter(e.target.value as InterestLevel | 'all')}
            className="px-2.5 py-1.5 text-xs bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
          >
            <option value="all">Todos os interesses</option>
            {INTEREST_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Intuitive Macro-Phase Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2DDD2] rounded-lg overflow-x-auto max-w-full">
          {(
            [
              { id: 'todas', label: 'Todas (10)' },
              { id: 'com_leads', label: 'Apenas com leads' },
              { id: 'prospeccao', label: 'Prospecção (1–3)' },
              { id: 'qualificacao', label: 'Reuniões (4–6)' },
              { id: 'negociacao', label: 'Negociação (7–8)' },
              { id: 'fechamento', label: 'Resultado (9–10)' },
            ] as { id: PhaseFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPhaseFilter(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                phaseFilter === tab.id
                  ? 'bg-[#12241D] text-[#F4F1EA]'
                  : 'text-[#12241D]/70 hover:text-[#12241D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stage Quick-Jump Rail */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FUNNEL_STAGES.map((stage) => {
          const count = leadsByStage[stage.id].length;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => scrollToStage(stage.id)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
                count > 0
                  ? 'bg-white border-[#12241D]/25 text-[#12241D] hover:border-[#FF5A1F]'
                  : 'bg-[#F4F1EA]/70 border-[#E2DDD2] text-[#12241D]/45 hover:text-[#12241D]'
              }`}
            >
              <span className="font-mono text-[11px] opacity-55 tabular-nums">
                {String(stage.order).padStart(2, '0')}
              </span>
              <span>{stage.shortLabel}</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  count > 0 ? 'text-[#FF5A1F]' : 'text-[#12241D]/40'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Horizontal Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[540px]">
        {visibleStages.map((stage) => {
          const stageLeads = leadsByStage[stage.id];
          const stageTotalValue = stageLeads.reduce(
            (sum, l) => sum + (l.estimatedValue ?? 0),
            0
          );
          const isOver = dragOverStage === stage.id;

          return (
            <div
              key={stage.id}
              ref={(el) => {
                columnRefs.current[stage.id] = el;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverStage !== stage.id) setDragOverStage(stage.id);
              }}
              onDragLeave={() => {
                if (dragOverStage === stage.id) setDragOverStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleDrop(stage.id);
              }}
              className={`w-[308px] shrink-0 rounded-xl border transition-colors flex flex-col max-h-[calc(100vh-300px)] ${
                isOver
                  ? 'bg-[#FFD9C7]/35 border-[#FF5A1F]'
                  : 'bg-[#ECE7DC]/70 border-[#DFD9CC]'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-[#DFD9CC]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono tabular-nums text-[#12241D]/50">
                      ETAPA {String(stage.order).padStart(2, '0')}
                    </p>
                    <h2 className="text-xs font-semibold text-[#12241D] leading-snug mt-0.5">
                      {stage.label}
                    </h2>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#12241D] bg-white border border-[#E2DDD2] px-2 py-0.5 rounded-md shrink-0">
                    {stageLeads.length}
                  </span>
                </div>
                {stageTotalValue > 0 && (
                  <p className="text-[11px] font-mono tabular-nums text-[#12241D]/60 mt-1.5">
                    {formatCurrencyBRL(stageTotalValue)}
                  </p>
                )}
              </div>

              {/* Column Cards */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {stageLeads.length === 0 ? (
                  <div className="py-8 px-3 text-center text-xs text-[#12241D]/45 border border-dashed border-[#D5CFC2] rounded-lg">
                    Arraste um lead para esta etapa
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const urgency = getFollowUpUrgency(lead, todayISO);
                    const waUrl = getWhatsAppUrl(lead.phone, lead);
                    const nextStageId = getNextStage(lead.stage);

                    return (
                      <article
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggedLeadId(lead.id)}
                        onDragEnd={() => {
                          setDraggedLeadId(null);
                          setDragOverStage(null);
                        }}
                        className={`bg-white border border-[#E2DDD2] rounded-lg p-3.5 hover:border-[#12241D]/45 transition-colors cursor-grab active:cursor-grabbing ${
                          draggedLeadId === lead.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div
                          className="cursor-pointer"
                          onClick={() => onSelectLead(lead)}
                        >
                          <h3 className="text-sm font-semibold text-[#12241D] leading-snug hover:text-[#C43E0F] transition-colors">
                            {lead.company}
                          </h3>
                          <p className="text-xs text-[#12241D]/70 mt-0.5">{lead.fullName}</p>

                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[#12241D]/55 mt-2">
                            <span>
                              {lead.importedFromCaioSheet ? 'Indicação Caio' : lead.source}
                            </span>
                            {lead.estimatedValue !== null && lead.estimatedValue > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums text-[#12241D] font-semibold">
                                  {formatCurrencyBRL(lead.estimatedValue)}
                                </span>
                              </>
                            )}
                            {lead.interestLevel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{getInterestLabel(lead.interestLevel)}</span>
                              </>
                            )}
                          </div>

                          {lead.phone ? (
                            <p className="text-[11px] font-mono tabular-nums text-[#12241D]/70 mt-1.5 inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-[#1D6F42] inline-block" aria-hidden="true" />
                              {lead.phone}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[#12241D]/50 mt-1.5 inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-[#FFD23F] inline-block" aria-hidden="true" />
                              Aguardando número
                            </p>
                          )}

                          {lead.nextFollowUpDate && (
                            <p
                              className={`text-[11px] font-mono tabular-nums mt-2 ${
                                urgency === 'atrasado'
                                  ? 'text-[#C93B2B] font-semibold'
                                  : urgency === 'hoje'
                                    ? 'text-[#C43E0F] font-semibold'
                                    : 'text-[#12241D]/60'
                              }`}
                            >
                              {urgency === 'atrasado'
                                ? `Atrasado · ${formatDateBR(lead.nextFollowUpDate)}`
                                : urgency === 'hoje'
                                  ? `Hoje · ${formatDateBR(lead.nextFollowUpDate)}`
                                  : `Follow-up · ${formatDateBR(lead.nextFollowUpDate)}`}
                            </p>
                          )}

                          {lead.nextAction && (
                            <p className="text-[11px] text-[#12241D]/65 mt-1 line-clamp-2">
                              Próxima ação: {lead.nextAction}
                            </p>
                          )}
                        </div>

                        {/* Intuitive 1-Click Card Actions */}
                        <div className="mt-3 pt-2.5 border-t border-[#EFECE4] space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            {nextStageId ? (
                              <button
                                type="button"
                                onClick={() => void onChangeStage(lead.id, nextStageId)}
                                title={`Mover para ${STAGE_MAP[nextStageId]?.label}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#12241D] bg-[#F4F1EA] hover:bg-[#FF5A1F] rounded transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <span>Avançar</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono text-[#12241D]/45">
                                Etapa final
                              </span>
                            )}

                            <div className="flex items-center gap-1 shrink-0">
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir WhatsApp"
                                  className="p-1.5 text-[#1D6F42] hover:bg-[#E7F4EC] rounded transition-colors"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onLogInteraction(lead)}
                                title="Registrar interação"
                                className="p-1.5 text-[#12241D]/70 hover:text-[#12241D] hover:bg-[#F4F1EA] rounded transition-colors cursor-pointer"
                              >
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <select
                            aria-label={`Mover etapa de ${lead.company}`}
                            value={lead.stage}
                            onChange={(e) =>
                              void onChangeStage(lead.id, e.target.value as FunnelStage)
                            }
                            className="w-full text-[11px] bg-[#F4F1EA]/70 border border-[#E2DDD2] rounded px-2 py-1 text-[#12241D] focus:outline-none focus:border-[#12241D] cursor-pointer"
                          >
                            {FUNNEL_STAGES.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {String(opt.order).padStart(2, '0')}. {opt.shortLabel}
                              </option>
                            ))}
                          </select>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
