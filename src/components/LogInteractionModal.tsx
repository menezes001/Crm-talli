import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
  CHANNEL_OPTIONS,
  FIELD_LIMITS,
  FUNNEL_STAGES,
  INTERACTION_TYPE_OPTIONS,
  INTEREST_OPTIONS,
  type FunnelStage,
  type InteractionChannel,
  type InteractionFormInput,
  type InteractionType,
  type InterestLevel,
  type Lead,
} from '../types/crm';
import { getNowLocalDateTimeInput } from '../lib/crmUtils';

interface LogInteractionModalProps {
  lead: Lead;
  onClose: () => void;
  onSubmit: (lead: Lead, input: InteractionFormInput) => Promise<void>;
}

function addDaysISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function LogInteractionModal({
  lead,
  onClose,
  onSubmit,
}: LogInteractionModalProps) {
  const defaultStageAfter: FunnelStage =
    lead.stage === 'novo_lead' ? 'primeiro_contato' : lead.stage;

  const [contactedAt, setContactedAt] = useState(getNowLocalDateTimeInput());
  const [channel, setChannel] = useState<InteractionChannel>('whatsapp');
  const [interactionType, setInteractionType] = useState<InteractionType>(
    lead.interactionCount === 0 ? 'primeiro_contato' : 'follow_up'
  );
  const [summary, setSummary] = useState('');
  const [clientResponse, setClientResponse] = useState('');
  const [interestLevel, setInterestLevel] = useState<InterestLevel>(lead.interestLevel);
  const [needsIdentified, setNeedsIdentified] = useState('');
  const [objections, setObjections] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [stageAfter, setStageAfter] = useState<FunnelStage | ''>(defaultStageAfter);
  const [meetingDate, setMeetingDate] = useState(lead.meetingDate);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setErrorMsg('Preencha o resumo de como foi a conversa.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit(lead, {
        contactedAt,
        channel,
        interactionType,
        summary,
        clientResponse,
        interestLevel,
        needsIdentified,
        objections,
        nextAction,
        nextFollowUpDate,
        stageAfter,
        meetingDate: stageAfter === 'reuniao_agendada' ? meetingDate : undefined,
      });
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao registrar interação. Tente novamente.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#12241D]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-interaction-title"
    >
      <div className="bg-white border border-[#E2DDD2] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header — Talli Floresta */}
        <div className="px-6 py-4 bg-[#12241D] text-[#F4F1EA] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="log-interaction-title"
              className="text-base font-semibold text-[#F4F1EA] truncate"
            >
              Registrar interação · {lead.company}
            </h2>
            <p className="text-xs text-[#F4F1EA]/70 mt-0.5 truncate">
              {lead.fullName}
              {lead.phone ? ` · ${lead.phone}` : ''} · Salvo no histórico permanente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 text-[#F4F1EA]/65 hover:text-[#F4F1EA] rounded-md hover:bg-[#22392F] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 bg-[#F4F1EA]/40">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#FFD9C7]/70 border border-[#FF5A1F]/40 text-xs text-[#12241D]">
              {errorMsg}
            </div>
          )}

          {/* Row 1: Date/time, Channel, Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Data e horário *
              </label>
              <input
                type="datetime-local"
                required
                value={contactedAt}
                onChange={(e) => setContactedAt(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Canal utilizado *
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as InteractionChannel)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              >
                {CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Tipo de interação *
              </label>
              <select
                value={interactionType}
                onChange={(e) => setInteractionType(e.target.value as InteractionType)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              >
                {INTERACTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
              Resumo de como foi a conversa *
            </label>
            <textarea
              required
              rows={3}
              maxLength={FIELD_LIMITS.interactionSummary}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Descreva os principais pontos abordados no contato..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
            />
          </div>

          {/* Client Response */}
          <div>
            <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
              O que o potencial cliente respondeu
            </label>
            <textarea
              rows={2}
              maxLength={FIELD_LIMITS.clientResponse}
              value={clientResponse}
              onChange={(e) => setClientResponse(e.target.value)}
              placeholder="Registro fiel do retorno, comentários ou abertura do cliente..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
            />
          </div>

          {/* Needs & Objections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Necessidades / problemas identificados
              </label>
              <textarea
                rows={2}
                maxLength={FIELD_LIMITS.needsIdentified}
                value={needsIdentified}
                onChange={(e) => setNeedsIdentified(e.target.value)}
                placeholder="Ex: Precisa gerar mais orçamentos qualificados..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Objeções apresentadas
              </label>
              <textarea
                rows={2}
                maxLength={FIELD_LIMITS.objections}
                value={objections}
                onChange={(e) => setObjections(e.target.value)}
                placeholder="Ex: Já tem agência atual, momento financeiro..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
              />
            </div>
          </div>

          {/* Interest & Stage Transition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#E2DDD2]">
            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Nível de interesse demonstrado
              </label>
              <select
                value={interestLevel}
                onChange={(e) => setInterestLevel(e.target.value as InterestLevel)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              >
                {INTEREST_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Atualizar etapa do funil para
              </label>
              <select
                value={stageAfter}
                onChange={(e) => setStageAfter(e.target.value as FunnelStage)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              >
                {FUNNEL_STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {String(stage.order).padStart(2, '0')}. {stage.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {stageAfter === 'reuniao_agendada' && (
            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Data / horário da reunião agendada
              </label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 text-xs font-mono bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              />
            </div>
          )}

          {/* Next Action & Quick Follow-up Date Presets */}
          <div className="space-y-3 pt-3 border-t border-[#E2DDD2]">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                  Próxima ação necessária
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.nextAction}
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="Ex: Enviar apresentação e confirmar horário"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                  Data do próximo follow-up
                </label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono text-[#12241D]/50 mr-1">
                Atalhos de retorno:
              </span>
              {[
                { label: 'Amanhã', days: 1 },
                { label: '+3 dias', days: 3 },
                { label: '+7 dias', days: 7 },
                { label: '+15 dias', days: 15 },
              ].map((preset) => {
                const target = addDaysISO(preset.days);
                const selected = nextFollowUpDate === target;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setNextFollowUpDate(target)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#12241D] text-[#F4F1EA] border-[#12241D]'
                        : 'bg-white text-[#12241D]/75 border-[#E2DDD2] hover:border-[#12241D]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#E2DDD2] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#12241D] bg-white border border-[#E2DDD2] rounded-lg hover:border-[#12241D] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Salvando...' : 'Salvar interação no histórico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
