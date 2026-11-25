import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  UserPlus,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, googleProvider } from '../lib/firebase';
import { TalliSymbol, TalliWordmark } from './TalliBrand';

type AuthMode = 'login' | 'register' | 'reset';

interface AuthFeedback {
  type: 'error' | 'success';
  title: string;
  detail: string;
  code?: string;
  showEnableProviderLink?: boolean;
  showAuthorizedDomainHelp?: boolean;
  offerCreateAccount?: boolean;
  offerResetPassword?: boolean;
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.29a12 12 0 0 0 0 10.8l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.6l4 3.1c.94-2.84 3.59-4.95 6.71-4.95z"
      />
    </svg>
  );
}

function mapAuthError(err: unknown, mode: AuthMode | 'google'): AuthFeedback {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const rawMessage =
    err instanceof Error && err.message ? err.message : '';

  if (code === 'auth/unauthorized-domain') {
    const hostname =
      typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
    return {
      type: 'error',
      title: 'Domínio ainda não autorizado para login com Google',
      detail: `Adicione "${hostname}" em Firebase Console → Authentication → Settings → Authorized domains para liberar o login com Google neste endereço.`,
      code,
      showAuthorizedDomainHelp: true,
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      type: 'error',
      title: 'Pop-up bloqueado pelo navegador',
      detail: 'Permita pop-ups para este site e tente novamente, ou entre com e-mail e senha.',
      code,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      type: 'error',
      title: 'E-mail e Senha ainda não ativados no Firebase',
      detail:
        'Ative o provedor "E-mail/senha" em Firebase Console → Authentication → Sign-in method para criar ou entrar com senha.',
      code,
      showEnableProviderLink: true,
    };
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return {
      type: 'error',
      title: 'E-mail ou senha não reconhecidos',
      detail:
        mode === 'login'
          ? 'Se for seu primeiro acesso, crie a conta abaixo. Se já entrou antes com Google, entre com Google ou envie o link para definir sua senha.'
          : 'Não foi possível localizar uma conta com este e-mail.',
      code,
      offerCreateAccount: mode === 'login',
      offerResetPassword: mode === 'login',
    };
  }

  if (code === 'auth/email-already-in-use') {
    return {
      type: 'error',
      title: 'Este e-mail já possui conta cadastrada',
      detail:
        'Entre usando "Entrar com Google" abaixo ou clique em enviar link para definir uma senha para este e-mail.',
      code,
      offerResetPassword: true,
    };
  }

  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') {
    return {
      type: 'error',
      title: 'Senha não aceita pela política de segurança',
      detail: 'Use pelo menos 6 caracteres (se o Firebase exigir, inclua letra maiúscula e número).',
      code,
    };
  }

  if (code === 'auth/invalid-email') {
    return {
      type: 'error',
      title: 'E-mail inválido',
      detail: 'Verifique se o endereço de e-mail foi digitado corretamente (sem espaços).',
      code,
    };
  }

  if (code === 'auth/too-many-requests') {
    return {
      type: 'error',
      title: 'Muitas tentativas em sequência',
      detail: 'Aguarde alguns minutos, entre com Google ou redefina sua senha.',
      code,
      offerResetPassword: true,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      type: 'error',
      title: 'Falha de conexão',
      detail: 'Verifique sua internet e tente novamente.',
      code,
    };
  }

  return {
    type: 'error',
    title: 'Não foi possível concluir o acesso',
    detail: rawMessage || 'Verifique seus dados e tente novamente.',
    code: code || undefined,
  };
}

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);

  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const providersConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;
  const domainsConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFeedback(null);
  };

  const handleCopyHost = async () => {
    if (!currentHost) return;
    try {
      await navigator.clipboard.writeText(currentHost);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // ignore clipboard errors on restricted contexts
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setFeedback(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setFeedback(mapAuthError(err, 'google'));
      }
      setGoogleLoading(false);
    }
  };

  const handleQuickCreateAccount = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || password.length < 6) {
      switchMode('register');
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
    } catch (err) {
      setFeedback(mapAuthError(err, 'register'));
      setLoading(false);
    }
  };

  const handleQuickSendReset = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      switchMode('reset');
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setFeedback({
        type: 'success',
        title: 'Link enviado para o seu e-mail',
        detail: `Abra a mensagem enviada para ${cleanEmail} (verifique também o Spam), defina sua senha e volte aqui para entrar.`,
      });
    } catch (err) {
      setFeedback(mapAuthError(err, 'reset'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFeedback({
        type: 'error',
        title: 'Informe um e-mail válido',
        detail: 'Digite o seu endereço de e-mail para continuar.',
      });
      return;
    }

    if (mode !== 'reset' && password.length < 6) {
      setFeedback({
        type: 'error',
        title: 'Senha muito curta',
        detail: 'A senha precisa ter pelo menos 6 caracteres.',
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
      } else {
        await sendPasswordResetEmail(auth, cleanEmail);
        setFeedback({
          type: 'success',
          title: 'Link enviado para o seu e-mail',
          detail: `Abra a mensagem enviada para ${cleanEmail} (verifique também o Spam), defina sua senha e volte aqui para entrar.`,
        });
        setLoading(false);
      }
    } catch (err) {
      setFeedback(mapAuthError(err, mode));
      setLoading(false);
    }
  };

  const isBusy = loading || googleLoading;

  return (
    <div className="min-h-screen bg-[#12241D] text-[#F4F1EA] flex flex-col p-5 md:p-10">
      {/* Top Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center">
        <TalliWordmark variant="light" className="h-6 w-auto" />
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center py-6 lg:py-10">
        <div className="lg:col-span-7">
          <h1 className="text-2xl sm:text-4xl lg:text-[3.25rem] font-light tracking-tight text-[#F4F1EA] leading-[1.12] [text-wrap:balance] max-w-xl">
            Gestão comercial com{' '}
            <em className="italic font-light text-[#FF5A1F]">clareza</em> do primeiro contato
            ao fechamento.
          </h1>
        </div>

        {/* Email & Password + Google Card in Linho */}
        <div className="lg:col-span-5">
          <div className="bg-[#F4F1EA] text-[#12241D] rounded-xl p-6 sm:p-7 border border-[#22392F]">
            <div className="flex items-center justify-between mb-5">
              <TalliSymbol variant="dark" dotColor="#FF5A1F" className="h-8 w-8" />
              <h2 className="text-lg font-semibold tracking-tight text-[#12241D]">
                {mode === 'login'
                  ? 'Entrar'
                  : mode === 'register'
                    ? 'Criar acesso'
                    : 'Definir senha'}
              </h2>
            </div>

            {/* Mode Switcher */}
            {mode !== 'reset' && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#E7E2D7] rounded-lg">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#12241D] text-[#F4F1EA]'
                      : 'text-[#12241D]/70 hover:text-[#12241D]'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#12241D] text-[#F4F1EA]'
                      : 'text-[#12241D]/70 hover:text-[#12241D]'
                  }`}
                >
                  Criar acesso
                </button>
              </div>
            )}

            {/* Error / Success Feedback with Direct Recovery Actions */}
            {feedback && (
              <div
                className={`mt-4 p-3.5 rounded-lg text-xs leading-relaxed space-y-2 border ${
                  feedback.type === 'success'
                    ? 'bg-[#E7F4EC] border-[#1D6F42]/35 text-[#12241D]'
                    : 'bg-[#FFD9C7]/65 border-[#FF5A1F]/40 text-[#12241D]'
                }`}
              >
                <p className="font-semibold flex items-center gap-1.5">
                  {feedback.type === 'success' && (
                    <Check className="w-3.5 h-3.5 text-[#1D6F42] shrink-0" />
                  )}
                  <span>{feedback.title}</span>
                </p>
                <p className="text-[#12241D]/85">{feedback.detail}</p>

                {feedback.code && (
                  <p className="font-mono text-[11px] text-[#12241D]/60">
                    Código: {feedback.code}
                  </p>
                )}

                {(feedback.offerCreateAccount || feedback.offerResetPassword) && (
                  <div className="pt-1 flex flex-col gap-1.5">
                    {feedback.offerCreateAccount && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleQuickCreateAccount()}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#12241D] text-[#F4F1EA] rounded-md hover:bg-[#22392F] transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Criar acesso com este e-mail e senha
                      </button>
                    )}
                    {feedback.offerResetPassword && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleQuickSendReset()}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white text-[#12241D] border border-[#12241D]/20 rounded-md hover:bg-[#F4F1EA] transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Enviar link para definir senha no e-mail
                      </button>
                    )}
                  </div>
                )}

                {feedback.showEnableProviderLink && (
                  <a
                    href={providersConsoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#12241D] underline underline-offset-2 hover:text-[#C43E0F] pt-0.5"
                  >
                    Ativar E-mail/senha no Firebase Console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {feedback.showAuthorizedDomainHelp && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    {currentHost && (
                      <button
                        type="button"
                        onClick={() => void handleCopyHost()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono bg-white border border-[#12241D]/20 rounded-md hover:bg-[#F4F1EA] cursor-pointer"
                      >
                        {copiedDomain ? (
                          <Check className="w-3 h-3 text-[#1D6F42]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedDomain ? 'Domínio copiado' : currentHost}
                      </button>
                    )}
                    <a
                      href={domainsConsoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#12241D] underline underline-offset-2 hover:text-[#C43E0F]"
                    >
                      Autorizar no Firebase
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-semibold text-[#12241D] mb-1.5"
                  >
                    Nome
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D2C5] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-[#12241D] mb-1.5"
                >
                  E-mail
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@tallimarketing.com.br"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D2C5] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
                />
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-semibold text-[#12241D]"
                    >
                      Senha
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-[11px] font-medium text-[#12241D]/65 hover:text-[#C43E0F] cursor-pointer"
                      >
                        Esqueci / definir senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete={
                        mode === 'register' ? 'new-password' : 'current-password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-[#D8D2C5] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#12241D]/45 hover:text-[#12241D] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="w-full inline-flex items-center justify-between px-5 py-3 text-sm font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12241D] transition-colors disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Processando...'
                    : mode === 'login'
                      ? 'Entrar'
                      : mode === 'register'
                        ? 'Criar acesso'
                        : 'Enviar link'}
                </span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full text-center text-xs font-medium text-[#12241D]/70 hover:text-[#12241D] cursor-pointer"
                >
                  Voltar
                </button>
              )}
            </form>

            {/* Google Sign-In Option */}
            <div className="mt-4">
              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-[#D8D2C5] w-full" />
                <span className="bg-[#F4F1EA] px-3 text-[11px] font-medium text-[#12241D]/50 shrink-0">
                  ou
                </span>
                <div className="border-t border-[#D8D2C5] w-full" />
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleGoogleSignIn()}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 text-sm font-semibold text-[#12241D] bg-white border border-[#D8D2C5] rounded-lg hover:bg-[#EFECE4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12241D] transition-colors disabled:opacity-60 cursor-pointer"
              >
                <GoogleIcon />
                <span>{googleLoading ? 'Conectando...' : 'Entrar com Google'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
