import { useEffect, useState } from 'react';
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, googleProvider } from '../lib/firebase';
import { TalliSymbol, TalliWordmark } from './TalliBrand';

interface AuthErrorState {
  title: string;
  detail: string;
  code?: string;
  showAuthorizeLink?: boolean;
  showRedirectFallback?: boolean;
}

function mapFirebaseAuthError(err: unknown): AuthErrorState {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (code === 'auth/unauthorized-domain') {
    return {
      title: `Domínio não autorizado no Firebase (${hostname})`,
      detail: `Adicione "${hostname}" em Firebase Console → Authentication → Settings → Authorized domains para liberar o login neste endereço.`,
      code,
      showAuthorizeLink: true,
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      title: 'Pop-up de login bloqueado pelo navegador',
      detail: isInIframe
        ? 'Permita pop-ups para este site nas configurações do navegador e clique novamente.'
        : 'Seu navegador bloqueou a janela de login. Você pode liberar pop-ups ou entrar por redirecionamento abaixo.',
      code,
      showRedirectFallback: !isInIframe,
    };
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      title: 'Login cancelado',
      detail: 'A janela de login foi fechada antes de concluir. Clique novamente para entrar.',
      code,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      title: 'Falha de conexão ao autenticar',
      detail:
        'Verifique sua conexão ou pause temporariamente extensões de bloqueio/VPN que possam estar interceptando o login do Google.',
      code,
    };
  }

  return {
    title: 'Não foi possível iniciar sessão agora',
    detail:
      'Verifique se o domínio atual está autorizado no Firebase Authentication e se pop-ups estão permitidos.',
    code: code || undefined,
    showAuthorizeLink: hostname !== '' && hostname !== 'localhost',
  };
}

export function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorState | null>(null);

  useEffect(() => {
    void getRedirectResult(auth).catch((err) => {
      setAuthError(mapFirebaseAuthError(err));
      setLoading(false);
    });
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      setLoading(false);
    }
  };

  const handleRedirectSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      setLoading(false);
    }
  };

  const authorizeDomainsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

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

            {authError && (
              <div className="mt-4 p-3.5 rounded-lg bg-[#FFD9C7]/60 border border-[#FF5A1F]/40 text-xs text-[#12241D] leading-relaxed space-y-2">
                <p className="font-semibold">{authError.title}</p>
                <p className="text-[#12241D]/85">{authError.detail}</p>
                {authError.code && (
                  <p className="font-mono text-[11px] text-[#12241D]/65">
                    Código: {authError.code}
                  </p>
                )}
                {authError.showAuthorizeLink && (
                  <a
                    href={authorizeDomainsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#12241D] underline underline-offset-2 hover:text-[#C43E0F]"
                  >
                    Abrir Domínios Autorizados no Firebase Console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {authError.showRedirectFallback && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => void handleRedirectSignIn()}
                      className="text-xs font-bold text-[#12241D] underline underline-offset-2 hover:text-[#C43E0F] cursor-pointer"
                    >
                      Entrar sem pop-up (redirecionamento) →
                    </button>
                  </div>
                )}
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
