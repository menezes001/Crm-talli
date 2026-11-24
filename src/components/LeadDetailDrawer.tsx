import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  MessageSquarePlus,
  Phone,
  Trash2,
  X,
} from 'lucide-react';
import {
  CHANNEL_OPTIONS,
  FIELD_LIMITS,
  FUNNEL_STAGES,
  INTERACTION_TYPE_OPTIONS,
  INTEREST_OPTIONS,
  POTENTIAL_OPTIONS,
  STAGE_MAP,
  type BusinessPotential,
  type FunnelStage,
  type Interaction,
  type InterestLevel,
  type Lead,
  type LeadFormInput,
} from '../types/crm';
import { subscribeInteractions } from '../lib/crmService';
import {
  findPotentialDuplicatesForInput,
  formatDateBR,
  formatDateTimeBR,
  getInterestLabel,
  getWhatsAppUrl,
} from '../lib/crmUtils';

interface LeadDetailDrawerProps {
  uid: string;
  lead: Lead;
  allLeads: Lead[];
  onClose: () => void;
  onSaveDetails: (leadId: string, input: LeadFormInput) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onOpenLogInteraction: (lead: Lead) => void;
}

export function LeadDetailDrawer({
  uid,
  lead,
  allLeads,
  onClose,
  onSaveDetails,
  onDeleteLead,
  onOpenLogInteraction,
}: LeadDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'cadastro' | 'historico'>('cadastro');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(lead.fullName);
  const [company, setCompany] = useState(lead.company);
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email);
  const [city, setCity] = useState(lead.city);
  const [segment, setSegment] = useState(lead.segment);
  const [source, setSource] = useState(lead.source);
  const [entryDate, setEntryDate] = useState(lead.entryDate);
  const [ownerName, setOwnerName] = useState(lead.ownerName);
  const [stage, setStage] = useState<FunnelStage>(lead.stage);
  const [potential, setPotential] = useState<BusinessPotential>(lead.potential);
  const [estimatedValueStr, setEstimatedValueStr] = useState(
    lead.estimatedValue !== null ? String(lead.estimatedValue) : ''
  );
  const [interestLevel, setInterestLevel] = useState<InterestLevel>(lead.interestLevel);
  const [meetingDate, setMeetingDate] = useState(lead.meetingDate);
  const [nextAction, setNextAction] = useState(lead.nextAction);
  const [nextFollowUpDate, setNextFollowUpDate] = useState(lead.nextFollowUpDate);
  const [notes, setNotes] = useState(lead.notes);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setFullName(lead.fullName);
    setCompany(lead.company);
    setPhone(lead.phone);
    setEmail(lead.email);
    setCity(lead.city);
    setSegment(lead.segment);
    setSource(lead.source);
    setEntryDate(lead.entryDate);
    setOwnerName(lead.ownerName);
    setStage(lead.stage);
    setPotential(lead.potential);
    setEstimatedValueStr(lead.estimatedValue !== null ? String(lead.estimatedValue) : '');
    setInterestLevel(lead.interestLevel);
    setMeetingDate(lead.meetingDate);
    setNextAction(lead.nextAction);
    setNextFollowUpDate(lead.nextFollowUpDate);
    setNotes(lead.notes);
    setConfirmDelete(false);
  }, [lead]);

  useEffect(() => {
    setLoadingHistory(true);
    setHistoryError(null);
    const unsub = subscribeInteractions(
      uid,
      lead.id,
      (items) => {
        setInteractions(items);
        setLoadingHistory(false);
      },
      (err) => {
        setHistoryError(err.message);
        setLoadingHistory(false);
      }
    );
    return () => unsub();
  }, [uid, lead.id]);

  const duplicateWarnings = useMemo(
    () =>
      findPotentialDuplicatesForInput(
        allLeads,
        { fullName, company, phone, email },
        lead.id
      ),
    [allLeads, fullName, company, phone, email, lead.id]
  );

  const waUrl = getWhatsAppUrl(phone, {
    fullName,
    company,
    importedFromCaioSheet: lead.importedFromCaioSheet,
  });

  const currentStageIndex = FUNNEL_STAGES.findIndex((s) => s.id === stage);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      setErrorMsg('O nome da empresa não pode ficar vazio.');
      return;
    }

    const parsedValue =
      estimatedValueStr.trim() === ''
        ? null
        : Number(estimatedValueStr.replace(/\./g, '').replace(',', '.'));

    if (parsedValue !== null && (Number.isNaN(parsedValue) || parsedValue < 0)) {
      setErrorMsg('Informe um valor estimado numérico válido.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await onSaveDetails(lead.id, {
        fullName: fullName.trim() || 'A confirmar',
        company: company.trim(),
        phone,
        email,
        city,
        segment,
        source,
        entryDate,
        ownerName,
        stage,
        potential,
        estimatedValue: parsedValue,
        notes,
        meetingDate,
        interestLevel,
        nextAction,
        nextFollowUpDate,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteLead(lead.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível excluir o contato.');
      setDeleting(false);
    }
  };

  const getChannelLabel = (val: Interaction['channel']) =>
    CHANNEL_OPTIONS.find((c) => c.value === val)?.label ?? val;

  const getTypeLabel = (val: Interaction['interactionType']) =>
    INTERACTION_TYPE_OPTIONS.find((t) => t.value === val)?.label ?? val;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-[#12241D]/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-drawer-title"
    >
      <div className="flex-1" onClick={onClose} />

      <div className="w-full max-w-2xl bg-[#F4F1EA] h-full border-l border-[#22392F] flex flex-col overflow-hidden shadow-2xl">
        {/* Drawer Header — Talli Floresta #12241D */}
        <div className="px-6 py-5 bg-[#12241D] text-[#F4F1EA] space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-[#F4F1EA]/60">
                {lead.source}
                {lead.importedFromCaioSheet ? ' · PLANILHA ORIGINAL' : ''}
              </p>
              <h2
                id="lead-drawer-title"
                className="text-xl font-semibold text-[#F4F1EA] truncate mt-0.5"
              >
                {lead.company}
              </h2>
              <p className="text-sm text-[#F4F1EA]/75 truncate">
                {lead.fullName}
                {lead.phone ? ` · ${lead.phone}` : ' · Aguardando número'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar ficha do lead"
              className="p-1.5 text-[#F4F1EA]/65 hover:text-[#F4F1EA] rounded-md hover:bg-[#22392F] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive 10-Stage Visual Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#F4F1EA]/80">
                ETAPA {String(currentStageIndex + 1).padStart(2, '0')}/10 ·{' '}
                {STAGE_MAP[stage]?.label}
              </span>
            </div>
            <div className="grid grid-cols-10 gap-1" role="group" aria-label="Progresso do funil">
              {FUNNEL_STAGES.map((step, idx) => {
                const isLost = stage === 'perdido';
                const isActive = step.id === stage;
                const isPassed = !isLost && idx < currentStageIndex;
                let barColor = 'bg-[#22392F] hover:bg-[#315244]';
                if (isActive) {
                  barColor =
                    step.id === 'perdido'
                      ? 'bg-[#C93B2B]'
                      : step.id === 'venda_fechada'
                        ? 'bg-[#2EA063]'
                        : 'bg-[#FF5A1F]';
                } else if (isPassed) {
                  barColor = 'bg-[#F4F1EA]/75 hover:bg-[#F4F1EA]';
                }

                return (
                  <button
                    key={step.id}
                    type="button"
                    title={`${step.order}. ${step.label}`}
                    onClick={() => setStage(step.id)}
                    className={`h-2 rounded-xs transition-colors cursor-pointer ${barColor}`}
                    aria-label={`Selecionar etapa ${step.label}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Tabs + Primary Action Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="inline-flex items-center p-0.5 bg-[#22392F] rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('cadastro')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'cadastro'
                    ? 'bg-[#F4F1EA] text-[#12241D]'
                    : 'text-[#F4F1EA]/75 hover:text-[#F4F1EA]'
                }`}
              >
                Cadastro do lead
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('historico')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'historico'
                    ? 'bg-[#F4F1EA] text-[#12241D]'
                    : 'text-[#F4F1EA]/75 hover:text-[#F4F1EA]'
                }`}
              >
                Histórico ({interactions.length || lead.interactionCount})
              </button>
            </div>

            <div className="flex items-center gap-2">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F4F1EA] bg-[#22392F] rounded-lg hover:bg-[#2c473b] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#4ADE80]" />
                  WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={() => onOpenLogInteraction(lead)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] transition-colors cursor-pointer"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                Nova interação
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'cadastro' ? (
            <form onSubmit={handleSave} className="space-y-5">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-[#FFD9C7]/70 border border-[#FF5A1F]/40 text-xs text-[#12241D]">
                  {errorMsg}
                </div>
              )}

              {duplicateWarnings.length > 0 && (
                <div className="p-3 rounded-lg bg-[#FFF1BF] border border-[#FFD23F] text-xs text-[#12241D] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#8A6100] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Atenção a possível duplicidade:</span>{' '}
                    {duplicateWarnings
                      .map((w) => `${w.lead.company} (${w.reasons.join(', ')})`)
                      .join(' · ')}
                  </div>
                </div>
              )}

              {/* Quick Summary of Last Interaction */}
              {lead.lastContactAt && (
                <div className="p-4 rounded-xl bg-white border border-[#E2DDD2] flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-[#12241D]/55">
                      ÚLTIMA INTERAÇÃO · {formatDateTimeBR(lead.lastContactAt)}
                    </p>
                    <p className="text-xs text-[#12241D] mt-1 leading-relaxed">
                      {lead.lastInteractionSummary}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('historico')}
                    className="text-xs font-semibold text-[#C43E0F] hover:text-[#FF5A1F] shrink-0 cursor-pointer"
                  >
                    Ver tudo
                  </button>
                </div>
              )}

              {/* Block 1: Contact Identity */}
              <div className="bg-white border border-[#E2DDD2] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#12241D]/55">
                  01 · Dados de contato
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={FIELD_LIMITS.fullName}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Empresa
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={FIELD_LIMITS.company}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.phone}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Preencher quando obtido"
                      className="w-full px-3 py-2 text-sm font-mono bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      E-mail
                    </label>
                    <input
                      type="email"
                      maxLength={FIELD_LIMITS.email}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@empresa.com.br"
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Cidade
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.city}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: Campinas - SP"
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#EFECE4]">
                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Origem do contato
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.source}
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Data de entrada
                    </label>
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Responsável
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.ownerName}
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Quem atende"
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>
                </div>
              </div>

              {/* Block 2: Commercial Qualification */}
              <div className="bg-white border border-[#E2DDD2] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#12241D]/55">
                  02 · Oportunidade e qualificação
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Etapa atual do funil
                    </label>
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value as FunnelStage)}
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    >
                      {FUNNEL_STAGES.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {String(opt.order).padStart(2, '0')}. {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Segmento
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.segment}
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Potencial de negócio
                    </label>
                    <select
                      value={potential}
                      onChange={(e) => setPotential(e.target.value as BusinessPotential)}
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    >
                      {POTENTIAL_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Valor estimado (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={estimatedValueStr}
                      onChange={(e) => setEstimatedValueStr(e.target.value)}
                      placeholder="Ex: 4500"
                      className="w-full px-3 py-2 text-sm font-mono bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Nível de interesse
                    </label>
                    <select
                      value={interestLevel}
                      onChange={(e) => setInterestLevel(e.target.value as InterestLevel)}
                      className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    >
                      {INTEREST_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Block 3: Next Step & Notes */}
              <div className="bg-white border border-[#E2DDD2] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#12241D]/55">
                  03 · Próximo passo e observações
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Data do próximo follow-up
                    </label>
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                      Data da reunião
                    </label>
                    <input
                      type="datetime-local"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                    Próxima ação necessária
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.nextAction}
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    placeholder="Ex: Solicitar WhatsApp ao Caio ou enviar apresentação comercial"
                    className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:bg-white focus:outline-none focus:border-[#12241D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                    Observações gerais
                  </label>
                  <textarea
                    rows={4}
                    maxLength={FIELD_LIMITS.notes}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F4F1EA]/50 border border-[#E2DDD2] rounded-lg text-[#12241D] focus:bg-white focus:outline-none focus:border-[#12241D]"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#12241D]/45 hover:text-[#C93B2B] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir lead
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#C93B2B] font-medium">
                        Confirmar exclusão?
                      </span>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => void handleDelete()}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-[#C93B2B] rounded hover:bg-[#a82f21] cursor-pointer"
                      >
                        {deleting ? 'Excluindo...' : 'Sim, excluir'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1 text-xs text-[#12241D]/70 hover:text-[#12241D] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {savedNotice && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D6F42]">
                      <Check className="w-3.5 h-3.5" />
                      Salvo
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Salvando...' : 'Salvar cadastro'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#12241D]">
                    Linha do tempo de relacionamento
                  </h3>
                  <p className="text-xs text-[#12241D]/60 mt-0.5">
                    Histórico permanente. Cada novo contato é adicionado preservando todos os anteriores.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLogInteraction(lead)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  Registrar contato
                </button>
              </div>

              {loadingHistory ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-24 bg-white border border-[#E2DDD2] rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : historyError ? (
                <div className="p-4 rounded-lg bg-[#FFD9C7]/70 border border-[#FF5A1F]/40 text-xs text-[#12241D]">
                  Erro ao carregar histórico: {historyError}
                </div>
              ) : interactions.length === 0 ? (
                <div className="bg-white border border-dashed border-[#D5CFC2] rounded-xl p-10 text-center">
                  <p className="text-sm font-semibold text-[#12241D]">
                    Nenhuma interação registrada ainda
                  </p>
                  <p className="text-xs text-[#12241D]/60 mt-1 max-w-sm mx-auto">
                    Ao realizar o primeiro contato por WhatsApp, ligação, e-mail ou reunião,
                    registre aqui o resumo, a resposta do cliente e o próximo passo.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenLogInteraction(lead)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] cursor-pointer"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    Registrar primeiro contato
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {interactions.map((item, idx) => (
                    <article
                      key={item.id}
                      className="border border-[#E2DDD2] rounded-xl p-5 bg-white space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EFECE4]">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className="font-mono tabular-nums font-semibold text-[#12241D]">
                            {formatDateTimeBR(item.contactedAt)}
                          </span>
                          <span aria-hidden="true" className="text-[#12241D]/30">
                            ·
                          </span>
                          <span className="font-semibold text-[#C43E0F]">
                            {getChannelLabel(item.channel)}
                          </span>
                          <span aria-hidden="true" className="text-[#12241D]/30">
                            ·
                          </span>
                          <span className="text-[#12241D]/70">
                            {getTypeLabel(item.interactionType)}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-[#12241D]/45">
                          #{interactions.length - idx}
                        </span>
                      </div>

                      <div className="space-y-2.5 text-xs leading-relaxed">
                        <div>
                          <p className="font-semibold text-[#12241D]/60 mb-0.5">
                            Resumo da conversa
                          </p>
                          <p className="text-[#12241D] whitespace-pre-wrap">{item.summary}</p>
                        </div>

                        {item.clientResponse && (
                          <div>
                            <p className="font-semibold text-[#12241D]/60 mb-0.5">
                              Resposta do cliente
                            </p>
                            <p className="text-[#12241D]/85 whitespace-pre-wrap">
                              {item.clientResponse}
                            </p>
                          </div>
                        )}

                        {item.needsIdentified && (
                          <div>
                            <p className="font-semibold text-[#12241D]/60 mb-0.5">
                              Necessidades / problemas identificados
                            </p>
                            <p className="text-[#12241D]/85 whitespace-pre-wrap">
                              {item.needsIdentified}
                            </p>
                          </div>
                        )}

                        {item.objections && (
                          <div>
                            <p className="font-semibold text-[#12241D]/60 mb-0.5">
                              Objeções apresentadas
                            </p>
                            <p className="text-[#12241D]/85 whitespace-pre-wrap">
                              {item.objections}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-[#EFECE4] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#12241D]/60">
                        {item.interestLevel && (
                          <span>
                            Interesse:{' '}
                            <strong className="font-semibold text-[#12241D]">
                              {getInterestLabel(item.interestLevel)}
                            </strong>
                          </span>
                        )}
                        {item.stageAfter && (
                          <span>
                            Etapa:{' '}
                            <strong className="font-semibold text-[#12241D]">
                              {STAGE_MAP[item.stageAfter]?.shortLabel}
                            </strong>
                          </span>
                        )}
                        {item.nextFollowUpDate && (
                          <span className="font-mono tabular-nums">
                            Próximo follow-up: {formatDateBR(item.nextFollowUpDate)}
                          </span>
                        )}
                        {item.nextAction && (
                          <span className="w-full text-[#12241D] font-medium mt-0.5">
                            Próxima ação: {item.nextAction}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
