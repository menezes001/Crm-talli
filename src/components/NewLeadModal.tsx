import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { CAIO_REFERRAL_SOURCE } from '../data/caioSeedContacts';
import {
  FIELD_LIMITS,
  FUNNEL_STAGES,
  INTEREST_OPTIONS,
  POTENTIAL_OPTIONS,
  type BusinessPotential,
  type FunnelStage,
  type InterestLevel,
  type Lead,
  type LeadFormInput,
} from '../types/crm';
import { findPotentialDuplicatesForInput, getTodayISO } from '../lib/crmUtils';

interface NewLeadModalProps {
  existingLeads: Lead[];
  defaultOwnerName: string;
  onClose: () => void;
  onCreate: (input: LeadFormInput) => Promise<void>;
}

export function NewLeadModal({
  existingLeads,
  defaultOwnerName,
  onClose,
  onCreate,
}: NewLeadModalProps) {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [segment, setSegment] = useState('');
  const [source, setSource] = useState(CAIO_REFERRAL_SOURCE);
  const [entryDate, setEntryDate] = useState(getTodayISO());
  const [ownerName, setOwnerName] = useState(defaultOwnerName);
  const [stage, setStage] = useState<FunnelStage>('novo_lead');
  const [potential, setPotential] = useState<BusinessPotential>('');
  const [estimatedValueStr, setEstimatedValueStr] = useState('');
  const [interestLevel, setInterestLevel] = useState<InterestLevel>('');
  const [nextAction, setNextAction] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const duplicateWarnings = useMemo(
    () =>
      findPotentialDuplicatesForInput(existingLeads, {
        fullName,
        company,
        phone,
        email,
      }),
    [existingLeads, fullName, company, phone, email]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      setErrorMsg('Informe o nome da empresa.');
      return;
    }

    const parsedValue =
      estimatedValueStr.trim() === ''
        ? null
        : Number(estimatedValueStr.replace(/\./g, '').replace(',', '.'));

    if (parsedValue !== null && (Number.isNaN(parsedValue) || parsedValue < 0)) {
      setErrorMsg('Informe um valor estimado válido.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onCreate({
        fullName: fullName.trim() || 'A confirmar',
        company: company.trim(),
        phone,
        email,
        city,
        segment,
        source: source.trim() || CAIO_REFERRAL_SOURCE,
        entryDate,
        ownerName,
        stage,
        potential,
        estimatedValue: parsedValue,
        notes,
        meetingDate: '',
        interestLevel,
        nextAction,
        nextFollowUpDate,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao cadastrar contato.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#12241D]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-lead-title"
    >
      <div className="bg-white border border-[#E2DDD2] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-4 bg-[#12241D] text-[#F4F1EA] flex items-center justify-between gap-4">
          <div>
            <h2 id="new-lead-title" className="text-base font-semibold text-[#F4F1EA]">
              Novo contato comercial
            </h2>
            <p className="text-xs text-[#F4F1EA]/70 mt-0.5">
              Adicione uma nova indicação ou oportunidade com verificação automática de duplicidades.
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

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 bg-[#F4F1EA]/40">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#FFD9C7]/70 border border-[#FF5A1F]/40 text-xs text-[#12241D]">
              {errorMsg}
            </div>
          )}

          {duplicateWarnings.length > 0 && (
            <div className="p-3 rounded-lg bg-[#FFF1BF] border border-[#FFD23F] text-xs text-[#12241D] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#8A6100] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Possível contato duplicado na base:</p>
                <ul className="mt-1 space-y-0.5">
                  {duplicateWarnings.map(({ lead, reasons }) => (
                    <li key={lead.id}>
                      {lead.company} ({lead.fullName}) — {reasons.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Empresa *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.company}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Nome da empresa"
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Nome completo do contato
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.fullName}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: João Silva (ou A confirmar)"
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
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
                placeholder="+55 19 99999-9999"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
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
                placeholder="contato@empresa.com.br"
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
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
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Origem do contato
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.source}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
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
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
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
                placeholder="Quem atende o lead"
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Etapa inicial do funil
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as FunnelStage)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
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
                placeholder="Ex: Esquadrias, Vidros, Arquitetura..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
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
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
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
                placeholder="Ex: 3500"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Nível de interesse
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Próxima ação
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.nextAction}
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="Ex: Pedir telefone ao Caio ou enviar mensagem inicial"
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
                Próximo follow-up
              </label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#12241D] mb-1.5">
              Observações gerais
            </label>
            <textarea
              rows={3}
              maxLength={FIELD_LIMITS.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto da indicação, perfil da empresa, anotações..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#E2DDD2] rounded-lg text-[#12241D] focus:outline-none focus:border-[#12241D]"
            />
          </div>

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
              {submitting ? 'Cadastrando...' : 'Cadastrar contato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
