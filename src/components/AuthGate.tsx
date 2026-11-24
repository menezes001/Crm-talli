import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { TalliSymbol, TalliWordmark } from './TalliBrand';

export function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar com o Google.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('Login cancelado. Clique novamente para entrar na sua conta.');
      } else {
        setErrorMsg(
          'Não foi possível iniciar sessão agora. Verifique se pop-ups estão permitidos e tente novamente.'
        );
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#12241D] text-[#F4F1EA] flex flex-col justify-between p-6 md:p-10">
      {/* Top Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
        <TalliWordmark variant="light" className="h-6 w-auto" />
        <span className="text-xs font-mono tracking-wide text-[#F4F1EA]/65">
          CRM COMERCIAL · INDICAÇÕES CAIO PELISSON
        </span>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-12">
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-mono tracking-wider text-[#F4F1EA]/70">
            Marketing 360 para arquitetura e decoração
          </p>

          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-[#F4F1EA] leading-[1.12] [text-wrap:balance]">
            Cada indicação acompanhada com{' '}
            <em className="italic font-light text-[#FF5A1F]">clareza</em> até o fechamento.
          </h1>

          <p className="text-base font-normal text-[#F4F1EA]/75 leading-relaxed max-w-xl">
            Os 7 contatos originais da planilha do Caio Pelisson estão prontos para importação
            fiel na sua base privada, com funil de 10 etapas, histórico permanente de conversas e
            controle diário de follow-ups.
          </p>

          <div className="pt-6 border-t border-[#22392F] grid grid-cols-3 gap-6 max-w-lg">
            <div>
              <p className="text-3xl font-light text-[#F4F1EA] font-mono tabular-nums">07</p>
              <p className="text-xs text-[#F4F1EA]/60 mt-1">Contatos da planilha</p>
            </div>
            <div>
              <p className="text-3xl font-light text-[#F4F1EA] font-mono tabular-nums">02</p>
              <p className="text-xs text-[#F4F1EA]/60 mt-1">WhatsApps prontos</p>
            </div>
            <div>
              <p className="text-3xl font-light text-[#F4F1EA] font-mono tabular-nums">10</p>
              <p className="text-xs text-[#F4F1EA]/60 mt-1">Etapas do funil</p>
            </div>
          </div>
        </div>

        {/* Sign-in Panel in Linho */}
        <div className="lg:col-span-5">
          <div className="bg-[#F4F1EA] text-[#12241D] rounded-xl p-7 border border-[#22392F]">
            <div className="flex items-center justify-between mb-5">
              <TalliSymbol variant="dark" dotColor="#FF5A1F" className="h-8 w-8" />
              <span className="text-[11px] font-mono text-[#12241D]/60">
                ACESSO PRIVADO
              </span>
            </div>

            <h2 className="text-xl font-semibold tracking-tight text-[#12241D]">
              Acessar workspace comercial
            </h2>
            <p className="text-sm text-[#12241D]/70 mt-1.5 leading-relaxed">
              Entre com sua conta Google para manter todos os leads, negociações e interações
              sincronizados em tempo real na nuvem.
            </p>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-lg bg-[#FFD9C7]/60 border border-[#FF5A1F]/40 text-xs text-[#12241D] leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-between px-5 py-3 text-sm font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12241D] transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span>{loading ? 'Conectando...' : 'Entrar com Google'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="mt-5 pt-4 border-t border-[#E2DDD2] flex items-start gap-2.5 text-xs text-[#12241D]/65">
              <ShieldCheck className="w-4 h-4 text-[#22392F] shrink-0 mt-0.5" />
              <span>
                Seus dados comerciais ficam isolados no seu workspace autenticado e preservados ao
                atualizar ou fechar o navegador.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-xs font-mono text-[#F4F1EA]/45 flex flex-wrap items-center justify-between gap-2 border-t border-[#22392F] pt-4">
        <span>talli marketing · arquitetura e decoração</span>
        <span>Base preservada · Contatos_Indicados_Talli_Marketing</span>
      </footer>
    </div>
  );
}
