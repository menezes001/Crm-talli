import { useMemo, useState } from 'react';
import { MessageSquarePlus, Phone, PhoneOff } from 'lucide-react';
import { STAGE_MAP, type Lead } from '../types/crm';
import {
  daysBetweenISO,
  formatDateBR,
  formatDateTimeBR,
  getDaysWithoutInteraction,
  getFollowUpUrgency,
  getTodayISO,
  getWhatsAppUrl,
  isClosedStage,
  normalizePhoneDigits,
} from '../lib/crmUtils';

type FollowUpBucket = 'todos' | 'atrasados' | 'hoje' | 'proximos' | 'sem_interacao' | 'atencao';

interface FollowUpsViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onLogInteraction: (lead: Lead) => void;
}

export function FollowUpsView({
  leads,
  onSelectLead,
  onLogInteraction,
}: FollowUpsViewProps) {
  const [activeBucket, setActiveBucket] = useState<FollowUpBucket>('todos');
  const todayISO = getTodayISO();

  const buckets = useMemo(() => {
    const openLeads = leads.filter((l) => !isClosedStage(l.stage));

    const atrasados = openLeads
      .filter((l) => getFollowUpUrgency(l, todayISO) === 'atrasado')
      .sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate));

    const hoje = openLeads
      .filter((l) => getFollowUpUrgency(l, todayISO) === 'hoje')
      .sort((a, b) => a.company.localeCompare(b.company, 'pt-BR'));

    const proximos = openLeads
      .filter((l) => getFollowUpUrgency(l, todayISO) === 'agendado')
      .sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate));

    const semInteracao = openLeads
      .filter((l) => {
        const days = getDaysWithoutInteraction(l, todayISO);
        return (l.interactionCount === 0 && l.stage === 'novo_lead') || days >= 5;
      })
      .sort(
        (a, b) =>
          getDaysWithoutInteraction(b, todayISO) - getDaysWithoutInteraction(a, todayISO)
      );

    const atencao = openLeads.filter((l) => {
      const missingPhone = normalizePhoneDigits(l.phone).length < 8;
      const missingFollowUp = l.stage !== 'novo_lead' && !l.nextFollowUpDate;
      const hotWithoutAction =
        (l.interestLevel === 'quente' || l.interestLevel === 'muito_quente') &&
        !l.nextAction;
      return missingPhone || missingFollowUp || hotWithoutAction;
    });

    return { atrasados, hoje, proximos, semInteracao, atencao };
  }, [leads, todayISO]);

  const sections = [
    {
      id: 'atrasados' as const,
      title: 'Follow-ups atrasados',
      description: 'Retornos vencidos que precisam de contato imediato.',
      items: buckets.atrasados,
      emptyText: 'Nenhum follow-up atrasado. Tudo em dia.',
      squareClass: 'bg-[#C93B2B]',
      countTone: 'text-[#C93B2B]',
    },
    {
      id: 'hoje' as const,
      title: 'Follow-ups para hoje',
      description: `Compromissos comerciais agendados para ${formatDateBR(todayISO)}.`,
      items: buckets.hoje,
      emptyText: 'Nenhum follow-up agendado especificamente para hoje.',
      squareClass: 'bg-[#FF5A1F]',
      countTone: 'text-[#C43E0F]',
    },
    {
      id: 'proximos' as const,
      title: 'Próximos contatos agendados',
      description: 'Agenda futura ordenada por data para manter previsibilidade.',
      items: buckets.proximos,
      emptyText: 'Nenhum follow-up futuro agendado. Defina datas ao registrar interações.',
      squareClass: 'bg-[#22392F]',
      countTone: 'text-[#12241D]',
    },
    {
      id: 'sem_interacao' as const,
      title: 'Leads sem interação recente',
      description: 'Leads ainda não contatados ou sem registro de conversa há 5 dias ou mais.',
      items: buckets.semInteracao,
      emptyText: 'Todos os leads ativos tiveram interação recente.',
      squareClass: 'bg-[#12241D]',
      countTone: 'text-[#12241D]',
    },
    {
      id: 'atencao' as const,
      title: 'Oportunidades que precisam de atenção',
      description: 'Contatos aguardando telefone ou oportunidades abertas sem próximo passo definido.',
      items: buckets.atencao,
      emptyText: 'Todas as oportunidades estão completas e com acompanhamento ativo.',
      squareClass: 'bg-[#FFD23F]',
      countTone: 'text-[#7C5A00]',
    },
  ];

  const visibleSections =
    activeBucket === 'todos' ? sections : sections.filter((s) => s.id === activeBucket);

  const renderLeadRow = (lead: Lead, sectionId: Exclude<FollowUpBucket, 'todos'>) => {
    const waUrl = getWhatsAppUrl(lead.phone, lead);
    const hasPhone = normalizePhoneDigits(lead.phone).length >= 8;
    const daysIdle = getDaysWithoutInteraction(lead, todayISO);

    let statusText = '';
    let statusClass = 'text-[#12241D]/65';
    let squareClass = 'bg-[#22392F]';

    if (sectionId === 'atrasados') {
      const overdue = Math.abs(daysBetweenISO(lead.nextFollowUpDate, todayISO));
      statusText = `Atrasado há ${overdue} ${overdue === 1 ? 'dia' : 'dias'} (${formatDateBR(lead.nextFollowUpDate)})`;
      statusClass = 'text-[#C93B2B] font-semibold';
      squareClass = 'bg-[#C93B2B]';
    } else if (sectionId === 'hoje') {
      statusText = `Agendado para hoje (${formatDateBR(lead.nextFollowUpDate)})`;
      statusClass = 'text-[#C43E0F] font-semibold';
      squareClass = 'bg-[#FF5A1F]';
    } else if (sectionId === 'proximos') {
      const inDays = daysBetweenISO(todayISO, lead.nextFollowUpDate);
      statusText = `Em ${inDays} ${inDays === 1 ? 'dia' : 'dias'} (${formatDateBR(lead.nextFollowUpDate)})`;
      statusClass = 'text-[#12241D] font-medium';
      squareClass = 'bg-[#22392F]';
    } else if (sectionId === 'sem_interacao') {
      statusText =
        lead.interactionCount === 0
          ? hasPhone
            ? 'Nunca contatado · WhatsApp pronto para iniciar'
            : 'Nunca contatado · Aguardando telefone'
          : `Sem interação há ${daysIdle} dias (última em ${formatDateTimeBR(lead.lastContactAt)})`;
      statusClass =
        hasPhone && lead.interactionCount === 0
          ? 'text-[#C43E0F] font-semibold'
          : 'text-[#12241D]/70';
      squareClass = hasPhone && lead.interactionCount === 0 ? 'bg-[#FF5A1F]' : 'bg-[#FFD23F]';
    } else {
      const reasons: string[] = [];
      if (!hasPhone) reasons.push('Aguardando número de telefone');
      if (lead.stage !== 'novo_lead' && !lead.nextFollowUpDate)
        reasons.push('Sem data de próximo follow-up');
      if (
        (lead.interestLevel === 'quente' || lead.interestLevel === 'muito_quente') &&
        !lead.nextAction
      )
        reasons.push('Lead quente sem próxima ação');
      statusText = reasons.join(' · ');
      statusClass = 'text-[#7C5A00] font-medium';
      squareClass = 'bg-[#FFD23F]';
    }

    return (
      <div
        key={`${sectionId}-${lead.id}`}
        className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#F4F1EA]/55 transition-colors"
      >
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => onSelectLead(lead)}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-[#12241D]">{lead.company}</span>
            <span aria-hidden="true" className="text-[#12241D]/30 text-xs">
              ·
            </span>
            <span className="text-sm text-[#12241D]/75">{lead.fullName}</span>
            <span aria-hidden="true" className="text-[#12241D]/30 text-xs">
              ·
            </span>
            <span className="text-xs text-[#12241D]/55">
              {STAGE_MAP[lead.stage]?.shortLabel}
            </span>
          </div>

          <p className={`text-xs mt-1.5 inline-flex items-center gap-1.5 ${statusClass}`}>
            <span className={`w-1.5 h-1.5 inline-block shrink-0 ${squareClass}`} aria-hidden="true" />
            {statusText}
          </p>

          {(lead.nextAction || lead.lastInteractionSummary || lead.notes) && (
            <p className="text-xs text-[#12241D]/55 mt-1 line-clamp-1">
              {lead.nextAction
                ? `Próxima ação: ${lead.nextAction}`
                : lead.lastInteractionSummary
                  ? `Último contato: ${lead.lastInteractionSummary}`
                  : `Observação: ${lead.notes}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#12241D] bg-[#F4F1EA] border border-[#D8D2C5] rounded-lg hover:border-[#12241D] transition-colors whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5 text-[#1D6F42]" />
              WhatsApp
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onSelectLead(lead)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#12241D]/75 bg-white border border-[#E2DDD2] rounded-lg hover:border-[#12241D] transition-colors whitespace-nowrap cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5 text-[#12241D]/45" />
              Adicionar telefone
            </button>
          )}

          <button
            type="button"
            onClick={() => onLogInteraction(lead)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#F4F1EA] bg-[#12241D] rounded-lg hover:bg-[#22392F] transition-colors whitespace-nowrap cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Registrar contato
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono tracking-wider text-[#12241D]/55 uppercase">
            Ritmo Comercial
          </p>
          <h1 className="text-3xl font-light tracking-tight text-[#12241D] mt-0.5">
            Gestão de <em className="italic font-light">follow-ups</em>
          </h1>
          <p className="text-xs text-[#12241D]/60 mt-1">
            Clique em qualquer cartão de status abaixo para focar em uma fila específica.
          </p>
        </div>

        {activeBucket !== 'todos' && (
          <button
            type="button"
            onClick={() => setActiveBucket('todos')}
            className="text-xs font-semibold text-[#C43E0F] hover:text-[#FF5A1F] cursor-pointer self-start sm:self-auto"
          >
            Mostrar todas as filas
          </button>
        )}
      </div>

      {/* Intuitive 5-Card Interactive Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {sections.map((section) => {
          const isSelected = activeBucket === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() =>
                setActiveBucket(isSelected ? 'todos' : section.id)
              }
              className={`text-left rounded-xl p-4 border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#12241D] text-[#F4F1EA] border-[#12241D]'
                  : 'bg-white text-[#12241D] border-[#E2DDD2] hover:border-[#12241D]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`w-2 h-2 inline-block shrink-0 ${section.squareClass}`}
                  aria-hidden="true"
                />
                <span
                  className={`text-2xl font-light font-mono tabular-nums ${
                    isSelected ? 'text-[#F4F1EA]' : section.countTone
                  }`}
                >
                  {section.items.length}
                </span>
              </div>
              <p
                className={`text-xs font-semibold mt-2.5 leading-snug ${
                  isSelected ? 'text-[#F4F1EA]' : 'text-[#12241D]'
                }`}
              >
                {section.title}
              </p>
            </button>
          );
        })}
      </div>

      {/* Follow-up Sections */}
      <div className="space-y-5">
        {visibleSections.map((section) => (
          <section
            key={section.id}
            className="bg-white border border-[#E2DDD2] rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-[#E2DDD2] flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#12241D] flex items-center gap-2">
                  <span
                    className={`w-2 h-2 inline-block shrink-0 ${section.squareClass}`}
                    aria-hidden="true"
                  />
                  <span>{section.title}</span>
                  <span
                    className={`text-xs font-mono tabular-nums ${section.countTone}`}
                  >
                    ({section.items.length})
                  </span>
                </h2>
                <p className="text-xs text-[#12241D]/55 mt-0.5">{section.description}</p>
              </div>
            </div>

            {section.items.length === 0 ? (
              <div className="px-6 py-8 text-center text-xs text-[#12241D]/55">
                {section.emptyText}
              </div>
            ) : (
              <div className="divide-y divide-[#EFECE4]">
                {section.items.map((lead) => renderLeadRow(lead, section.id))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
