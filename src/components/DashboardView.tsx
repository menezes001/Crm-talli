import { useMemo } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  MessageSquarePlus,
  Phone,
  Plus,
} from 'lucide-react';
import {
  FUNNEL_STAGES,
  STAGE_MAP,
  type FunnelStage,
  type Lead,
} from '../types/crm';
import {
  computeDashboardMetrics,
  daysBetweenISO,
  formatCurrencyBRL,
  formatDateBR,
  getFollowUpUrgency,
  getInterestLabel,
  getTodayISO,
  getWhatsAppUrl,
  isClosedStage,
  normalizePhoneDigits,
} from '../lib/crmUtils';

interface DashboardViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onLogInteraction: (lead: Lead) => void;
  onNavigateToStage: (stage: FunnelStage) => void;
  onNavigateToFollowUps: () => void;
  onOpenNewLead: () => void;
}

export function DashboardView({
  leads,
  onSelectLead,
  onLogInteraction,
  onNavigateToStage,
  onNavigateToFollowUps,
  onOpenNewLead,
}: DashboardViewProps) {
  const todayISO = getTodayISO();
  const metrics = useMemo(() => computeDashboardMetrics(leads, todayISO), [leads, todayISO]);

  // Intuitive priority queue: Overdue -> Today -> Ready for 1st contact (phone filled) -> Active without follow-up -> Waiting for phone
  const priorityQueue = useMemo(() => {
    return leads
      .filter((l) => !isClosedStage(l.stage))
      .map((lead) => {
        const urgency = getFollowUpUrgency(lead, todayISO);
        const hasPhone = normalizePhoneDigits(lead.phone).length >= 8;
        let score = 40;
        let statusLabel = 'Em acompanhamento';
        let squareColor = 'bg-[#22392F]';
        let textTone = 'text-[#12241D]/70';

        if (urgency === 'atrasado') {
          const overdueDays = Math.abs(daysBetweenISO(lead.nextFollowUpDate, todayISO));
          score = 120 + overdueDays;
          statusLabel = `Follow-up atrasado (${overdueDays}d)`;
          squareColor = 'bg-[#C93B2B]';
          textTone = 'text-[#C93B2B] font-medium';
        } else if (urgency === 'hoje') {
          score = 100;
          statusLabel = 'Follow-up para hoje';
          squareColor = 'bg-[#FF5A1F]';
          textTone = 'text-[#C43E0F] font-medium';
        } else if (lead.stage === 'novo_lead' && hasPhone) {
          score = 88;
          statusLabel = 'Pronto para 1º contato (WhatsApp)';
          squareColor = 'bg-[#FF5A1F]';
          textTone = 'text-[#12241D] font-medium';
        } else if (!lead.nextFollowUpDate && lead.stage !== 'novo_lead') {
          score = 70;
          statusLabel = 'Sem próximo follow-up agendado';
          squareColor = 'bg-[#FFD23F]';
          textTone = 'text-[#7C5A00] font-medium';
        } else if (lead.stage === 'novo_lead' && !hasPhone) {
          score = 45;
          statusLabel = 'Aguardando telefone para iniciar';
          squareColor = 'bg-[#FFD23F]';
          textTone = 'text-[#12241D]/70';
        } else {
          score = 30;
          statusLabel = `Retorno agendado · ${formatDateBR(lead.nextFollowUpDate)}`;
          squareColor = 'bg-[#22392F]';
          textTone = 'text-[#12241D]/70';
        }

        return { lead, score, statusLabel, squareColor, textTone, hasPhone };
      })
      .sort((a, b) => b.score - a.score);
  }, [leads, todayISO]);

  const topLead = priorityQueue[0]?.lead ?? null;
  const readyForFirstContactCount = useMemo(
    () =>
      leads.filter(
        (l) => l.stage === 'novo_lead' && normalizePhoneDigits(l.phone).length >= 8
      ).length,
    [leads]
  );

  // Macro commercial phases so the 10-stage funnel is immediately scannable
  const macroPhases = useMemo(() => {
    const prospeccao =
      metrics.stageCounts.novo_lead +
      metrics.stageCounts.primeiro_contato +
      metrics.stageCounts.aguardando_retorno;
    const qualificacao =
      metrics.stageCounts.contato_estabelecido +
      metrics.stageCounts.reuniao_agendada +
      metrics.stageCounts.reuniao_realizada;
    const negociacao =
      metrics.stageCounts.proposta_enviada + metrics.stageCounts.em_negociacao;
    const fechamento = metrics.stageCounts.venda_fechada;

    return [
      {
        index: '01',
        name: 'Prospecção',
        detail: 'Novo lead, 1º contato e retorno',
        count: prospeccao,
        targetStage: 'novo_lead' as FunnelStage,
      },
      {
        index: '02',
        name: 'Qualificação e Reunião',
        detail: 'Contato ativo e reuniões',
        count: qualificacao,
        targetStage: 'reuniao_agendada' as FunnelStage,
      },
      {
        index: '03',
        name: 'Proposta e Negociação',
        detail: 'Propostas enviadas e ajustes',
        count: negociacao,
        targetStage: 'proposta_enviada' as FunnelStage,
      },
      {
        index: '04',
        name: 'Vendas Fechadas',
        detail: `${metrics.conversionRate.toFixed(1)}% de conversão`,
        count: fechamento,
        targetStage: 'venda_fechada' as FunnelStage,
      },
    ];
  }, [metrics]);

  const maxStageCount = Math.max(
    1,
    ...FUNNEL_STAGES.map((s) => metrics.stageCounts[s.id] || 0)
  );

  const phoneReadyPct =
    metrics.totalLeads > 0 ? Math.round((metrics.withPhoneCount / metrics.totalLeads) * 100) : 0;

  // Dynamic plain-language Daily Focus summary
  const dailySummary = useMemo(() => {
    if (metrics.overdueFollowUpsCount > 0) {
      return `Você tem ${metrics.overdueFollowUpsCount} follow-up(s) atrasado(s) e ${metrics.todayFollowUpsCount} para hoje.`;
    }
    if (metrics.todayFollowUpsCount > 0) {
      return `Você tem ${metrics.todayFollowUpsCount} follow-up(s) agendado(s) para hoje.`;
    }
    if (readyForFirstContactCount > 0) {
      return `${readyForFirstContactCount} contato(s) das indicações já têm WhatsApp preenchido e estão prontos para o primeiro contato agora.`;
    }
    if (metrics.withoutPhoneCount > 0) {
      return `${metrics.withoutPhoneCount} contato(s) ainda aguardam número de telefone para iniciar a prospecção.`;
    }
    return 'Todas as oportunidades estão organizadas e acompanhadas no funil.';
  }, [metrics, readyForFirstContactCount]);

  return (
    <div className="space-y-7">
      {/* Editorial Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono tracking-wider text-[#12241D]/55 uppercase">
            Visão Comercial
          </p>
          <h1 className="text-3xl font-light tracking-tight text-[#12241D] mt-0.5">
            Dashboard <em className="italic font-light">comercial</em>
          </h1>
        </div>
        <p className="text-xs font-mono tabular-nums text-[#12241D]/60">
          {metrics.caioImportedCount} indicações do Caio · {metrics.totalLeads} contatos na base
        </p>
      </div>

      {/* Intuitive Daily Focus Banner (Floresta #12241D + Laranja #FF5A1F CTA) */}
      <section className="bg-[#12241D] text-[#F4F1EA] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono text-[#F4F1EA]/70">
            <span className="w-2 h-2 bg-[#FF5A1F] inline-block shrink-0" aria-hidden="true" />
            <span>FOCO IMEDIATO DO DIA</span>
          </div>
          <p className="text-xl sm:text-2xl font-light tracking-tight leading-snug text-[#F4F1EA]">
            {dailySummary}
          </p>
          {topLead && (
            <p className="text-xs text-[#F4F1EA]/65">
              Próximo sugerido:{' '}
              <strong className="font-semibold text-[#F4F1EA]">{topLead.company}</strong> (
              {topLead.fullName}) — {STAGE_MAP[topLead.stage]?.shortLabel}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {topLead && (
            <button
              type="button"
              onClick={() => onLogInteraction(topLead)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Contatar {topLead.company}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateToFollowUps}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#F4F1EA] bg-[#22392F] rounded-lg hover:bg-[#2c473b] transition-colors whitespace-nowrap cursor-pointer"
          >
            Ver agenda de follow-ups
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Primary KPI Grid (4 Financial & Conversion Numbers) */}
      <section aria-label="Indicadores financeiros e de volume">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-[#E2DDD2] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E2DDD2]">
          <div className="p-5">
            <p className="text-xs font-medium text-[#12241D]/60">Total de contatos</p>
            <p className="text-3xl font-light text-[#12241D] font-mono tabular-nums mt-2">
              {metrics.totalLeads}
            </p>
            <p className="text-xs text-[#12241D]/55 mt-2">
              {metrics.withPhoneCount} com telefone · {metrics.withoutPhoneCount} aguardando
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-[#12241D]/60">Pipeline comercial ativo</p>
            <p className="text-3xl font-light text-[#12241D] font-mono tabular-nums mt-2">
              {formatCurrencyBRL(metrics.pipelineValue)}
            </p>
            <p className="text-xs text-[#12241D]/55 mt-2">
              {metrics.totalLeads - metrics.wonCount - metrics.lostCount} oportunidades abertas
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-[#12241D]/60">Valor total vendido</p>
            <p className="text-3xl font-light text-[#1D6F42] font-mono tabular-nums mt-2">
              {formatCurrencyBRL(metrics.wonValue)}
            </p>
            <p className="text-xs text-[#12241D]/55 mt-2">
              {metrics.wonCount} {metrics.wonCount === 1 ? 'venda fechada' : 'vendas fechadas'}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-[#12241D]/60">Taxa de conversão</p>
            <p className="text-3xl font-light text-[#12241D] font-mono tabular-nums mt-2">
              {metrics.conversionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-[#12241D]/55 mt-2">
              {metrics.wonCount} ganhas · {metrics.lostCount} perdidas
            </p>
          </div>
        </div>
      </section>

      {/* Priority Queue First — Immediate Operational Action */}
      <section className="bg-white border border-[#E2DDD2] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2DDD2] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#12241D]">
              Quem contatar agora
            </h2>
            <p className="text-xs text-[#12241D]/60 mt-0.5">
              Ordem automática de prioridade: follow-ups vencidos, contatos com WhatsApp disponível e oportunidades ativas.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToFollowUps}
            className="text-xs font-semibold text-[#12241D] hover:text-[#FF5A1F] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors self-start sm:self-auto"
          >
            Abrir central de follow-ups
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {priorityQueue.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-[#12241D]/70">
              Nenhuma oportunidade em aberto no momento.
            </p>
            <button
              type="button"
              onClick={onOpenNewLead}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar novo contato
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#EFECE4]">
            {priorityQueue.slice(0, 7).map(({ lead, statusLabel, squareColor, textTone }) => {
              const waUrl = getWhatsAppUrl(lead.phone, lead);
              return (
                <div
                  key={lead.id}
                  className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F4F1EA]/55 transition-colors"
                >
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => onSelectLead(lead)}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-[#12241D]">
                        {lead.company}
                      </span>
                      <span className="text-xs text-[#12241D]/35" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-sm text-[#12241D]/75">{lead.fullName}</span>
                      {lead.phone && (
                        <>
                          <span className="text-xs text-[#12241D]/35" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-mono tabular-nums text-[#12241D]/65">
                            {lead.phone}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs mt-1.5">
                      <span className={`inline-flex items-center gap-1.5 ${textTone}`}>
                        <span
                          className={`w-2 h-2 inline-block shrink-0 ${squareColor}`}
                          aria-hidden="true"
                        />
                        {statusLabel}
                      </span>
                      <span className="text-[#12241D]/25" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-[#12241D]/60">
                        {STAGE_MAP[lead.stage]?.shortLabel}
                      </span>
                      {lead.interestLevel && (
                        <>
                          <span className="text-[#12241D]/25" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-[#12241D]/60">
                            {getInterestLabel(lead.interestLevel)}
                          </span>
                        </>
                      )}
                    </div>

                    {(lead.nextAction || lead.notes) && (
                      <p className="text-xs text-[#12241D]/55 mt-1 truncate max-w-2xl">
                        {lead.nextAction
                          ? `Próxima ação: ${lead.nextAction}`
                          : `Contexto: ${lead.notes}`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#12241D] bg-[#F4F1EA] border border-[#D8D2C5] rounded-lg hover:border-[#12241D] transition-colors whitespace-nowrap"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#1D6F42]" />
                        WhatsApp
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectLead(lead)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#12241D]/75 bg-white border border-[#E2DDD2] rounded-lg hover:border-[#12241D] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Completar telefone
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onLogInteraction(lead)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#F4F1EA] bg-[#12241D] rounded-lg hover:bg-[#22392F] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      Registrar contato
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Intuitive 4-Phase Journey Overview + Operational Counters */}
      <section aria-label="Resumo das fases do funil" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {macroPhases.map((phase) => (
            <button
              key={phase.index}
              type="button"
              onClick={() => onNavigateToStage(phase.targetStage)}
              className="text-left bg-white border border-[#E2DDD2] rounded-xl p-4 hover:border-[#12241D] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs font-mono text-[#12241D]/45">
                <span>FASE {phase.index}</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#FF5A1F]" />
              </div>
              <p className="text-2xl font-light font-mono tabular-nums text-[#12241D] mt-2">
                {phase.count}
              </p>
              <p className="text-sm font-semibold text-[#12241D] mt-1">{phase.name}</p>
              <p className="text-xs text-[#12241D]/55 mt-0.5">{phase.detail}</p>
            </button>
          ))}
        </div>

        {/* Exact 7 Operational Indicators Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {[
            { label: 'Não contatados', value: metrics.notContactedCount, stage: 'novo_lead' as FunnelStage },
            { label: 'Contatos realizados', value: metrics.contactedCount, stage: 'primeiro_contato' as FunnelStage },
            { label: 'Reuniões agendadas', value: metrics.meetingsScheduledCount, stage: 'reuniao_agendada' as FunnelStage },
            { label: 'Propostas enviadas', value: metrics.proposalsSentCount, stage: 'proposta_enviada' as FunnelStage },
            { label: 'Em negociação', value: metrics.negotiationsCount, stage: 'em_negociacao' as FunnelStage },
            { label: 'Vendas fechadas', value: metrics.wonCount, stage: 'venda_fechada' as FunnelStage },
            { label: 'Perdidos', value: metrics.lostCount, stage: 'perdido' as FunnelStage },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => onNavigateToStage(stat.stage)}
              className="text-left bg-[#F4F1EA]/70 border border-[#E2DDD2] rounded-lg px-3.5 py-3 hover:bg-white hover:border-[#12241D] transition-colors cursor-pointer"
            >
              <p className="text-[11px] text-[#12241D]/60 truncate">{stat.label}</p>
              <p className="text-lg font-medium text-[#12241D] font-mono tabular-nums mt-1">
                {stat.value}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Minimalist Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 10-Stage Detailed Funnel Chart */}
        <div className="lg:col-span-8 bg-white border border-[#E2DDD2] rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-[#12241D]">
                Distribuição detalhada por etapa
              </h2>
              <p className="text-xs text-[#12241D]/55 mt-0.5">
                Clique em qualquer etapa para abrir a lista filtrada de contatos.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#12241D]/50">
              {metrics.totalLeads} leads
            </span>
          </div>

          <div className="space-y-2.5">
            {FUNNEL_STAGES.map((stage) => {
              const count = metrics.stageCounts[stage.id] || 0;
              const value = metrics.stageValues[stage.id] || 0;
              const pct = Math.round((count / maxStageCount) * 100);
              const barColor =
                stage.id === 'venda_fechada'
                  ? 'bg-[#1D6F42]'
                  : stage.id === 'perdido'
                    ? 'bg-[#C9C3B6]'
                    : stage.id === 'novo_lead' && count > 0
                      ? 'bg-[#FF5A1F]'
                      : count > 0
                        ? 'bg-[#12241D]'
                        : 'bg-[#EFECE4]';

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => onNavigateToStage(stage.id)}
                  className="w-full text-left group py-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1 gap-3">
                    <span className="text-[#12241D]/80 group-hover:text-[#12241D] truncate">
                      <span className="font-mono text-[#12241D]/40 mr-2 tabular-nums">
                        {String(stage.order).padStart(2, '0')}
                      </span>
                      {stage.label}
                    </span>
                    <span className="font-mono tabular-nums text-[#12241D]/65 shrink-0">
                      <strong className="text-[#12241D] font-semibold">{count}</strong>
                      {value > 0 && (
                        <span className="text-[#12241D]/45 ml-2">
                          · {formatCurrencyBRL(value)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#F4F1EA] rounded-xs overflow-hidden">
                    <div
                      className={`h-full rounded-xs transition-all duration-200 ${barColor}`}
                      style={{ width: `${count === 0 ? 0 : Math.max(pct, 4)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact Readiness & Interest Distribution */}
        <div className="lg:col-span-4 bg-white border border-[#E2DDD2] rounded-xl p-6 flex flex-col justify-between gap-6">
          <div>
            <h2 className="text-base font-semibold text-[#12241D]">
              Prontidão de contato
            </h2>
            <p className="text-xs text-[#12241D]/55 mt-0.5">
              Contatos com WhatsApp preenchido vs. aguardando número.
            </p>

            <div className="mt-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-3xl font-light text-[#12241D] font-mono tabular-nums">
                  {phoneReadyPct}%
                </span>
                <span className="text-xs font-mono tabular-nums text-[#12241D]/60">
                  {metrics.withPhoneCount}/{metrics.totalLeads} prontos
                </span>
              </div>
              <div className="h-2.5 w-full bg-[#F4F1EA] rounded-xs overflow-hidden">
                <div
                  className="bg-[#12241D] h-full transition-all duration-200"
                  style={{ width: `${phoneReadyPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[#12241D]/60 mt-2">
                <span>Com telefone: {metrics.withPhoneCount}</span>
                <span>Aguardando: {metrics.withoutPhoneCount}</span>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-[#EFECE4]">
            <h3 className="text-sm font-semibold text-[#12241D]">
              Termômetro de interesse
            </h3>
            <p className="text-xs text-[#12241D]/55 mt-0.5 mb-4">
              Atualizado automaticamente a cada interação registrada.
            </p>
            <div className="space-y-3">
              {[
                { key: 'muito_quente' as const, label: 'Muito quente', barClass: 'bg-[#FF5A1F]' },
                { key: 'quente' as const, label: 'Quente', barClass: 'bg-[#12241D]' },
                { key: 'morno' as const, label: 'Morno', barClass: 'bg-[#22392F]/70' },
                { key: 'frio' as const, label: 'Frio', barClass: 'bg-[#A6A095]' },
                { key: '' as const, label: 'Não avaliado', barClass: 'bg-[#DCD6CA]' },
              ].map((row) => {
                const count = metrics.interestCounts[row.key] || 0;
                const pct =
                  metrics.totalLeads > 0 ? Math.round((count / metrics.totalLeads) * 100) : 0;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#12241D]/75">{row.label}</span>
                      <span className="font-mono tabular-nums text-[#12241D]">
                        {count}{' '}
                        <span className="text-[#12241D]/45">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#F4F1EA] rounded-xs overflow-hidden">
                      <div
                        className={`h-full rounded-xs ${row.barClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
