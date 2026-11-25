import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  BellRing,
  Check,
  Kanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { auth } from './lib/firebase';
import {
  createLead,
  deleteLead,
  ensureWorkspaceAndSeed,
  logInteraction,
  restoreMissingCaioContacts,
  subscribeLeads,
  updateLeadDetails,
  updateLeadStage,
} from './lib/crmService';
import {
  computeDashboardMetrics,
  getTodayISO,
  normalizePhoneDigits,
  normalizeText,
} from './lib/crmUtils';
import {
  STAGE_MAP,
  type FunnelStage,
  type InteractionFormInput,
  type Lead,
  type LeadFormInput,
  type ViewSection,
} from './types/crm';
import { TalliWordmark } from './components/TalliBrand';
import { AuthGate } from './components/AuthGate';
import { DashboardView } from './components/DashboardView';
import { ContactsView } from './components/ContactsView';
import { FunnelView } from './components/FunnelView';
import { FollowUpsView } from './components/FollowUpsView';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';
import { LogInteractionModal } from './components/LogInteractionModal';
import { NewLeadModal } from './components/NewLeadModal';
import { PasswordModal } from './components/PasswordModal';

const NAV_ITEMS: { id: ViewSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'contatos', label: 'Contatos', icon: Users },
  { id: 'funil', label: 'Funil de Vendas', icon: Kanban },
  { id: 'followups', label: 'Follow-ups', icon: BellRing },
];

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [initializingWorkspace, setInitializingWorkspace] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [activeView, setActiveView] = useState<ViewSection>('dashboard');
  const [stageFilter, setStageFilter] = useState<FunnelStage | 'all'>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [interactionTargetLeadId, setInteractionTargetLeadId] = useState<string | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Intuitive global quick-jump search in the top bar
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setLeads([]);
        setLoadingLeads(false);
        setSelectedLeadId(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    let unsubLeads: (() => void) | null = null;
    let cancelled = false;

    const bootWorkspace = async () => {
      setInitializingWorkspace(true);
      setLoadingLeads(true);
      try {
        const { migratedCount } = await ensureWorkspaceAndSeed(user);
        if (cancelled) return;
        setInitializingWorkspace(false);
        if (migratedCount > 0) {
          showToast(`${migratedCount} contato(s) anterior(es) sincronizados na base compartilhada.`);
        }

        unsubLeads = subscribeLeads(
          user.uid,
          (items) => {
            if (!cancelled) {
              setLeads(items);
              setLoadingLeads(false);
            }
          },
          (err) => {
            if (!cancelled) {
              setFatalError(err);
            }
          }
        );
      } catch (err) {
        if (!cancelled) {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    void bootWorkspace();

    return () => {
      cancelled = true;
      if (unsubLeads) unsubLeads();
    };
  }, [authReady, user]);

  const metrics = useMemo(() => computeDashboardMetrics(leads, getTodayISO()), [leads]);

  const quickSearchResults = useMemo(() => {
    const qNorm = normalizeText(globalQuery);
    const qDigits = normalizePhoneDigits(globalQuery);
    if (!qNorm && !qDigits) return [];

    return leads
      .filter((lead) => {
        const matchName = normalizeText(lead.fullName).includes(qNorm);
        const matchCompany = normalizeText(lead.company).includes(qNorm);
        const matchPhone =
          qDigits.length > 0 && normalizePhoneDigits(lead.phone).includes(qDigits);
        return matchName || matchCompany || matchPhone;
      })
      .slice(0, 6);
  }, [leads, globalQuery]);

  const selectedLead = useMemo(
    () => (selectedLeadId ? leads.find((l) => l.id === selectedLeadId) ?? null : null),
    [leads, selectedLeadId]
  );

  const interactionTargetLead = useMemo(
    () =>
      interactionTargetLeadId
        ? leads.find((l) => l.id === interactionTargetLeadId) ?? null
        : null,
    [leads, interactionTargetLeadId]
  );

  const urgentFollowUpsCount = metrics.overdueFollowUpsCount + metrics.todayFollowUpsCount;

  const handleNavigateToStage = (stage: FunnelStage) => {
    setStageFilter(stage);
    setActiveView('contatos');
  };

  const handleStageChange = async (leadId: string, stage: FunnelStage) => {
    if (!user) return;
    await updateLeadStage(user.uid, leadId, stage);
    showToast(`Etapa atualizada para "${STAGE_MAP[stage]?.shortLabel}".`);
  };

  const handleSaveDetails = async (leadId: string, input: LeadFormInput) => {
    if (!user) return;
    await updateLeadDetails(user.uid, leadId, input);
    showToast('Cadastro do lead salvo.');
  };

  const handleCreateLead = async (input: LeadFormInput) => {
    if (!user) return;
    const newId = await createLead(user.uid, input);
    showToast('Novo contato cadastrado com sucesso.');
    setSelectedLeadId(newId);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!user) return;
    await deleteLead(user.uid, leadId);
    setSelectedLeadId(null);
    showToast('Contato removido da base.');
  };

  const handleLogInteraction = async (lead: Lead, input: InteractionFormInput) => {
    if (!user) return;
    await logInteraction(user.uid, lead, input);
    showToast('Interação registrada no histórico.');
  };

  const handleRestoreMissingCaio = async (): Promise<number> => {
    if (!user) return 0;
    const restored = await restoreMissingCaioContacts(user.uid, leads);
    if (restored > 0) {
      showToast(`${restored} contato(s) original(is) restaurado(s).`);
    }
    return restored;
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#12241D] flex flex-col items-center justify-center gap-4">
        <TalliWordmark variant="light" className="h-7 w-auto" />
        <p className="text-xs font-mono text-[#F4F1EA]/60">Carregando workspace...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const currentNavLabel =
    NAV_ITEMS.find((item) => item.id === activeView)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#12241D] flex">
      {/* Desktop Sidebar — Talli Floresta #12241D */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#12241D] text-[#F4F1EA] border-r border-[#22392F] z-30">
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#22392F]">
          <TalliWordmark variant="light" className="h-5 w-auto" />
          <span className="text-[10px] font-mono tracking-wider text-[#F4F1EA]/50 uppercase">
            CRM
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveView(item.id);
                  if (item.id !== 'contatos') setStageFilter('all');
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#22392F] text-[#F4F1EA]'
                    : 'text-[#F4F1EA]/70 hover:bg-[#22392F]/55 hover:text-[#F4F1EA]'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#FF5A1F]' : 'text-[#F4F1EA]/45'
                    }`}
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                </span>

                {item.id === 'contatos' && (
                  <span className="text-xs font-mono tabular-nums text-[#F4F1EA]/55">
                    {metrics.totalLeads}
                  </span>
                )}
                {item.id === 'followups' && urgentFollowUpsCount > 0 && (
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#FF5A1F]">
                    {urgentFollowUpsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quiet Sidebar Summary & Account Footer */}
        <div className="p-4 border-t border-[#22392F] space-y-3.5">
          <div className="bg-[#22392F]/65 rounded-lg p-3 space-y-1.5">
            <p className="text-[11px] font-mono text-[#F4F1EA]/60">
              BASE COMPARTILHADA · TALLI
            </p>
            <div className="flex items-baseline justify-between text-xs font-mono tabular-nums">
              <span className="text-[#F4F1EA]">
                {metrics.contactedCount}/{metrics.totalLeads} contatados
              </span>
              <span className="text-[#FFD23F]">{metrics.wonCount} fechadas</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#22392F] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#F4F1EA] truncate">
                {user.displayName || 'Equipe Comercial'}
              </p>
              <p className="text-[11px] font-mono text-[#F4F1EA]/45 truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                title="Definir ou alterar senha"
                aria-label="Definir ou alterar senha"
                className="p-1.5 text-[#F4F1EA]/55 hover:text-[#F4F1EA] hover:bg-[#22392F] rounded-md transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                title="Sair da conta"
                aria-label="Sair da conta"
                className="p-1.5 text-[#F4F1EA]/55 hover:text-[#F4F1EA] hover:bg-[#22392F] rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-[#12241D] text-[#F4F1EA] border-r border-[#22392F] h-full flex flex-col">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#22392F]">
              <TalliWordmark variant="light" className="h-5 w-auto" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="p-1.5 text-[#F4F1EA]/70 hover:text-[#F4F1EA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-[#22392F] text-[#F4F1EA]'
                        : 'text-[#F4F1EA]/70 hover:bg-[#22392F]/55'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-[#FF5A1F]' : 'text-[#F4F1EA]/50'
                        }`}
                      />
                      {item.label}
                    </span>
                    {item.id === 'followups' && urgentFollowUpsCount > 0 && (
                      <span className="text-xs font-mono tabular-nums text-[#FF5A1F] font-semibold">
                        {urgentFollowUpsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-[#22392F] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#F4F1EA] truncate">
                  {user.displayName || 'Equipe Comercial'}
                </p>
                <p className="text-[11px] font-mono text-[#F4F1EA]/45 truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowPasswordModal(true);
                  }}
                  className="p-1.5 text-[#F4F1EA]/60 hover:text-[#F4F1EA]"
                  aria-label="Definir ou alterar senha"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void signOut(auth)}
                  className="p-1.5 text-[#F4F1EA]/60 hover:text-[#F4F1EA]"
                  aria-label="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div
            className="flex-1 bg-[#12241D]/45"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar: Breadcrumb + Instant Global Lead Search + 1 Primary Talli Laranja CTA */}
        <header className="sticky top-0 z-20 h-14 sm:h-16 bg-white/95 backdrop-blur-xs border-b border-[#E2DDD2] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              className="lg:hidden p-1.5 -ml-1.5 text-[#12241D] hover:bg-[#F4F1EA] rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm truncate">
              <span className="hidden sm:inline font-mono text-xs text-[#12241D]/45 whitespace-nowrap">
                talli
              </span>
              <span className="hidden sm:inline text-[#12241D]/25" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-[#12241D] truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Global Instant Lead Search */}
            <div ref={searchContainerRef} className="relative hidden md:block w-64 lg:w-72">
              <Search className="w-3.5 h-3.5 text-[#12241D]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Buscar empresa, nome ou telefone..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F4F1EA] border border-[#E2DDD2] rounded-lg text-[#12241D] placeholder:text-[#12241D]/45 focus:bg-white focus:outline-none focus:border-[#12241D] transition-colors"
              />

              {searchFocused && globalQuery.trim().length > 0 && (
                <div className="absolute right-0 mt-1.5 w-80 bg-white border border-[#E2DDD2] rounded-xl shadow-lg overflow-hidden z-50">
                  {quickSearchResults.length === 0 ? (
                    <div className="p-4 text-xs text-[#12241D]/60 text-center">
                      Nenhum contato encontrado para &ldquo;{globalQuery}&rdquo;.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EFECE4]">
                      {quickSearchResults.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            setGlobalQuery('');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#F4F1EA] transition-colors cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-[#12241D] truncate">
                            {lead.company}
                          </p>
                          <p className="text-[11px] text-[#12241D]/60 truncate mt-0.5">
                            {lead.fullName} · {STAGE_MAP[lead.stage]?.shortLabel}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowNewLeadModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12241D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Novo contato
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1440px] w-full mx-auto">
          {initializingWorkspace || loadingLeads ? (
            <div className="space-y-6">
              <div className="h-9 w-64 bg-[#E2DDD2]/80 rounded animate-pulse" />
              <div className="h-32 bg-[#12241D]/15 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 bg-white border border-[#E2DDD2] rounded-xl animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeView === 'dashboard' && (
                <DashboardView
                  leads={leads}
                  onSelectLead={(lead) => setSelectedLeadId(lead.id)}
                  onLogInteraction={(lead) => setInteractionTargetLeadId(lead.id)}
                  onNavigateToStage={handleNavigateToStage}
                  onNavigateToFollowUps={() => setActiveView('followups')}
                  onOpenNewLead={() => setShowNewLeadModal(true)}
                />
              )}

              {activeView === 'contatos' && (
                <ContactsView
                  leads={leads}
                  initialStageFilter={stageFilter}
                  onStageFilterChange={setStageFilter}
                  onSelectLead={(lead) => setSelectedLeadId(lead.id)}
                  onLogInteraction={(lead) => setInteractionTargetLeadId(lead.id)}
                  onChangeStage={handleStageChange}
                  onOpenNewLead={() => setShowNewLeadModal(true)}
                  onRestoreMissingCaio={handleRestoreMissingCaio}
                />
              )}

              {activeView === 'funil' && (
                <FunnelView
                  leads={leads}
                  onSelectLead={(lead) => setSelectedLeadId(lead.id)}
                  onLogInteraction={(lead) => setInteractionTargetLeadId(lead.id)}
                  onChangeStage={handleStageChange}
                />
              )}

              {activeView === 'followups' && (
                <FollowUpsView
                  leads={leads}
                  onSelectLead={(lead) => setSelectedLeadId(lead.id)}
                  onLogInteraction={(lead) => setInteractionTargetLeadId(lead.id)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          uid={user.uid}
          lead={selectedLead}
          allLeads={leads}
          onClose={() => setSelectedLeadId(null)}
          onSaveDetails={handleSaveDetails}
          onDeleteLead={handleDeleteLead}
          onOpenLogInteraction={(lead) => setInteractionTargetLeadId(lead.id)}
        />
      )}

      {/* Log Interaction Modal */}
      {interactionTargetLead && (
        <LogInteractionModal
          lead={interactionTargetLead}
          onClose={() => setInteractionTargetLeadId(null)}
          onSubmit={handleLogInteraction}
        />
      )}

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <NewLeadModal
          existingLeads={leads}
          defaultOwnerName={user.displayName || ''}
          onClose={() => setShowNewLeadModal(false)}
          onCreate={handleCreateLead}
        />
      )}

      {/* Password Setup / Update Modal */}
      {showPasswordModal && (
        <PasswordModal
          user={user}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={(msg) => showToast(msg)}
        />
      )}

      {/* Talli Floresta Toast Confirmation */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-[#12241D] text-[#F4F1EA] border border-[#22392F] text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg inline-flex items-center gap-2"
        >
          <Check className="w-3.5 h-3.5 text-[#FF5A1F]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
