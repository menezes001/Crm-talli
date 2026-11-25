import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { ArrowRight, Check, ExternalLink, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from '../lib/firebase';
import { TalliSymbol, TalliWordmark } from './TalliBrand';

type AuthMode = 'login' | 'register' | 'reset';

interface AuthFeedback {
  type: 'error' | 'success';
  title: string;
  detail: string;
  code?: string;
  showEnableProviderLink?: boolean;
}

function mapEmailAuthError(err: unknown, mode: AuthMode): AuthFeedback {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  if (code === 'auth/operation-not-allowed') {
    return {
      type: 'error',
      title: 'Login por E-mail e Senha ainda não ativado no Firebase',
      detail:
        'Ative o provedor "E-mail/senha" em Firebase Console → Authentication → Sign-in method para liberar o acesso com login e senha.',
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
      title: 'E-mail ou senha incorretos',
      detail:
        mode === 'login'
          ? 'Verifique suas credenciais. Se for o seu primeiro acesso com este e-mail, use a aba "Criar acesso".'
          : 'Não foi possível localizar uma conta com este e-mail.',
      code,
    };
  }

  if (code === 'auth/email-already-in-use') {
    return {
      type: 'error',
      title: 'Este e-mail já está cadastrado',
      detail: 'Volte para a aba "Entrar" e acesse com sua senha.',
      code,
    };
  }

  if (code === 'auth/weak-password') {
    return {
      type: 'error',
      title: 'Senha muito curta',
      detail: 'Escolha uma senha com pelo menos 6 caracteres.',
      code,
    };
  }

  if (code === 'auth/invalid-email') {
    return {
      type: 'error',
      title: 'E-mail inválido',
      detail: 'Digite um endereço de e-mail válido (ex: voce@tallimarketing.com.br).',
      code,
    };
  }

  if (code === 'auth/too-many-requests') {
    return {
      type: 'error',
      title: 'Muitas tentativas em sequência',
      detail: 'Aguarde alguns minutos antes de tentar novamente ou redefina sua senha.',
      code,
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
    detail: 'Verifique seus dados e tente novamente.',
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
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);

  const providersConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFeedback(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFeedback({
        type: 'error',
        title: 'Informe seu e-mail',
        detail: 'Digite o e-mail de acesso para continuar.',
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
          title: 'E-mail de recuperação enviado',
          detail: `Enviamos as instruções de redefinição de senha para ${cleanEmail}.`,
        });
        setLoading(false);
      }
    } catch (err) {
      setFeedback(mapEmailAuthError(err, mode));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#12241D] text-[#F4F1EA] flex flex-col justify-between p-6 md:p-10">
      {/* Top Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
        <TalliWordmark variant="light" className="h-6 w-auto" />
        <span className="text-xs font-mono tracking-wide text-[#F4F1EA]/65">
          CRM COMERCIAL · TALLI MARKETING
        </span>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-10">
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-mono tracking-wider text-[#F4F1EA]/70">
            Marketing 360 para arquitetura e decoração
          </p>

          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-[#F4F1EA] leading-[1.12] [text-wrap:balance]">
            Gestão comercial com{' '}
            <em className="italic font-light text-[#FF5A1F]">clareza</em> do primeiro contato
            ao fechamento.
          </h1>

          <p className="text-base font-normal text-[#F4F1EA]/75 leading-relaxed max-w-xl">
            Centralize oportunidades, acompanhe cada etapa do funil de vendas, registre o
            histórico completo de interações e mantenha todos os follow-ups sob controle em
            tempo real.
          </p>

          <div className="pt-6 border-t border-[#22392F] grid grid-cols-3 gap-6 max-w-lg">
            <div>
              <p className="text-3xl font-light text-[#F4F1EA] font-mono tabular-nums">10</p>
              <p className="text-xs text-[#F4F1EA]/60 mt-1">Etapas no funil</p>
            </div>
            <div>
              <p className="text-3xl font-light text-[#F4F1EA] font-mono tabular-nums">360°</p>
              <p className="text-xs text-[#F4F1EA]/60 mt-1">Histórico completo</p>
            </div>
            <div>
              <p className="text-3xl font-light text-[#F4F1EA] font-mono tabular-nums">100%</p>
              <p className="text-xs text-[#F4F1EA]/60 mt-1">Dados em nuvem</p>
            </div>
          </div>
        </div>

        {/* Email & Password Card in Linho */}
        <div className="lg:col-span-5">
          <div className="bg-[#F4F1EA] text-[#12241D] rounded-xl p-7 border border-[#22392F]">
            <div className="flex items-center justify-between mb-5">
              <TalliSymbol variant="dark" dotColor="#FF5A1F" className="h-8 w-8" />
              <span className="text-[11px] font-mono text-[#12241D]/60">
                ACESSO RESTRITO
              </span>
            </div>

            <h2 className="text-xl font-semibold tracking-tight text-[#12241D]">
              {mode === 'login'
                ? 'Entrar no CRM'
                : mode === 'register'
                  ? 'Criar acesso comercial'
                  : 'Recuperar senha'}
            </h2>
            <p className="text-xs text-[#12241D]/65 mt-1 leading-relaxed">
              {mode === 'login'
                ? 'Informe seu e-mail e senha para acessar o painel comercial.'
                : mode === 'register'
                  ? 'Cadastre seu e-mail e defina sua senha de acesso ao workspace.'
                  : 'Informe seu e-mail cadastrado para receber o link de redefinição.'}
            </p>

            {/* Mode Switcher */}
            {mode !== 'reset' && (
              <div className="mt-5 grid grid-cols-2 gap-1 p-1 bg-[#E7E2D7] rounded-lg">
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

            {/* Error / Success Feedback */}
            {feedback && (
              <div
                className={`mt-4 p-3.5 rounded-lg text-xs leading-relaxed space-y-1.5 border ${
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
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                  required
                  autoComplete="email"
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
                        Esqueci a senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
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
                disabled={loading}
                className="w-full inline-flex items-center justify-between px-5 py-3 text-sm font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12241D] transition-colors disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Processando...'
                    : mode === 'login'
                      ? 'Entrar no CRM'
                      : mode === 'register'
                        ? 'Criar acesso e entrar'
                        : 'Enviar link de recuperação'}
                </span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full text-center text-xs font-medium text-[#12241D]/70 hover:text-[#12241D] cursor-pointer"
                >
                  Voltar para o login
                </button>
              )}
            </form>

            <div className="mt-5 pt-4 border-t border-[#E2DDD2] flex items-start gap-2.5 text-xs text-[#12241D]/65">
              <ShieldCheck className="w-4 h-4 text-[#22392F] shrink-0 mt-0.5" />
              <span>
                Autenticação protegida com dados salvos em nuvem e isolados no seu workspace.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-xs font-mono text-[#F4F1EA]/45 flex flex-wrap items-center justify-between gap-2 border-t border-[#22392F] pt-4">
        <span>talli marketing · arquitetura e decoração</span>
        <span>Workspace comercial privado</span>
      </footer>
    </div>
  );
}
