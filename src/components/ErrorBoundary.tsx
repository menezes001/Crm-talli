import React from 'react';
import { signOut } from 'firebase/auth';
import { AlertTriangle, LogOut, RotateCcw } from 'lucide-react';
import { auth } from '../lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'Ocorreu um erro inesperado na aplicação.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        readable = `Erro de sincronização (${parsed.operationType || 'operação'}): ${parsed.error}`;
      }
    } catch {
      // keep original message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F1EA] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-[#E2DDD2] rounded-xl p-6">
            <div className="flex items-center gap-3 text-[#C93B2B] mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-semibold text-[#12241D]">
                Não foi possível concluir a operação
              </h2>
            </div>
            <p className="text-sm text-[#12241D]/75 leading-relaxed mb-5 break-words">
              {this.state.message}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Recarregar CRM
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut(auth).catch(() => undefined);
                  window.location.reload();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#12241D] bg-[#F4F1EA] border border-[#D8D2C5] rounded-lg hover:bg-[#E7E2D7] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Voltar ao login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
