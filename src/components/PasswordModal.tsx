import { useState, type FormEvent } from 'react';
import {
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  type User,
} from 'firebase/auth';
import { Check, Eye, EyeOff, KeyRound, X } from 'lucide-react';

interface PasswordModalProps {
  user: User;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function PasswordModal({ user, onClose, onSuccess }: PasswordModalProps) {
  const hasPasswordProvider = user.providerData.some(
    (provider) => provider.providerId === 'password'
  );

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não conferem.');
      return;
    }

    setSaving(true);
    try {
      if (hasPasswordProvider) {
        await updatePassword(user, newPassword);
        onSuccess('Senha atualizada com sucesso.');
      } else if (user.email) {
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        await linkWithCredential(user, credential);
        onSuccess('Senha vinculada à sua conta. Agora você pode entrar com e-mail e senha.');
      } else {
        setError('Sua conta não possui um e-mail associado.');
        setSaving(false);
        return;
      }
      onClose();
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'auth/requires-recent-login') {
        setError('Por segurança, saia e entre novamente antes de alterar ou definir a senha.');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Ative o provedor E-mail/senha no Firebase Console para vincular uma senha.');
      } else if (code === 'auth/weak-password') {
        setError('Escolha uma senha mais forte (mínimo 6 caracteres).');
      } else {
        setError(`Não foi possível salvar a senha${code ? ` (${code})` : ''}.`);
      }
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#12241D]/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#F4F1EA] text-[#12241D] rounded-xl border border-[#22392F] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-[#FF5A1F]" />
            <h2 className="text-base font-semibold text-[#12241D]">
              {hasPasswordProvider ? 'Alterar senha de acesso' : 'Definir senha de acesso'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 text-[#12241D]/55 hover:text-[#12241D] rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#12241D]/70 leading-relaxed mb-4">
          {hasPasswordProvider
            ? `Atualize a senha usada para entrar com ${user.email}.`
            : `Defina uma senha para ${user.email} e passe a entrar também com e-mail e senha, mantendo todos os seus dados.`}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#FFD9C7]/70 border border-[#FF5A1F]/40 text-xs text-[#12241D]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          <div>
            <label
              htmlFor="modal-new-password"
              className="block text-xs font-semibold text-[#12241D] mb-1"
            >
              Nova senha
            </label>
            <div className="relative">
              <input
                id="modal-new-password"
                type={showPassword ? 'text' : 'password'}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-[#D8D2C5] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#12241D]/45 hover:text-[#12241D] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="modal-confirm-password"
              className="block text-xs font-semibold text-[#12241D] mb-1"
            >
              Confirmar senha
            </label>
            <input
              id="modal-confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D2C5] rounded-lg text-[#12241D] placeholder:text-[#12241D]/40 focus:outline-none focus:border-[#12241D]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#12241D]/70 hover:text-[#12241D] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#12241D] bg-[#FF5A1F] rounded-lg hover:bg-[#e84f18] transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : 'Salvar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
