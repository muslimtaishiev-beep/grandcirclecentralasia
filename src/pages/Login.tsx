import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  sendPasswordResetEmail,
  confirmPasswordReset
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Key, X, Check } from 'lucide-react';

interface LoginProps {
  lang?: "ru" | "en" | "kg";
}

const Login: React.FC<LoginProps> = ({ lang = "ru" }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Password Reset Confirmation (from email link) State
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (mode === 'resetPassword' && oobCode) {
      setIsConfirmModalOpen(true);
    }
  }, [mode, oobCode]);

  const redirectUserByRole = async (userRecord?: any) => {
    const loggedUser = userRecord || auth.currentUser;
    const userEmail = (loggedUser?.email || email || "").toLowerCase();

    if (userEmail.endsWith("@studyfreeforum.com") || userEmail === "admin@studyfreeforum.com") {
      window.location.href = "/super-admin";
      return;
    }

    try {
      const idToken = await loggedUser?.getIdToken();
      if (!idToken) {
        window.location.href = "/dashboard";
        return;
      }
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await res.json();

      if (data.user?.globalRole === "superadmin") {
        window.location.href = "/super-admin";
      } else if (data.memberships && data.memberships.length > 0) {
        const firstOrgSlug = data.memberships[0].tenantId || "org_future_leaders";
        window.location.href = `/workspace/${firstOrgSlug}`;
      } else {
        window.location.href = "/dashboard";
      }
    } catch (e) {
      window.location.href = "/dashboard";
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await redirectUserByRole(cred.user);
    } catch (err: any) {
      console.error("[Login Error]:", err);
      setError(err.message || (lang === 'ru' ? 'Ошибка входа. Проверьте почту и пароль.' : 'Failed to sign in. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await redirectUserByRole(cred.user);
    } catch (err: any) {
      console.error("[Google Login Error]:", err);
      setError(err.message || (lang === 'ru' ? 'Ошибка входа через Google. Проверьте Authorized Domains в Firebase.' : 'Google sign-in error. Check Authorized Domains in Firebase.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);

    try {
      auth.languageCode = lang === 'kg' ? 'ru' : lang;
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true
      };
      await sendPasswordResetEmail(auth, resetEmail, actionCodeSettings);
      setResetSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setResetError(lang === 'ru' ? 'Пользователь с такой почтой не найден в системе.' : 'User with this email not found.');
      } else {
        setResetError(err.message || (lang === 'ru' ? 'Ошибка при отправке письма сброса пароля.' : 'Failed to send password reset email.'));
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode || !newPassword) return;
    setConfirmLoading(true);
    setConfirmError('');
    setConfirmSuccess(false);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setConfirmSuccess(true);
      setTimeout(() => {
        setIsConfirmModalOpen(false);
        navigate('/login');
      }, 2500);
    } catch (err: any) {
      if (err.code === 'auth/invalid-action-code' || err.code === 'auth/expired-action-code') {
        setConfirmError(lang === 'ru' ? 'Ссылка для сброса пароля устарела или уже была использована. Запросите сброс пароля заново.' : 'Reset code is invalid or expired. Please request a new link.');
      } else {
        setConfirmError(err.message || (lang === 'ru' ? 'Ошибка при сохранении нового пароля.' : 'Failed to reset password.'));
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-display font-black text-slate-900 uppercase tracking-tight">
          {lang === 'ru' ? 'Вход участника' : lang === 'kg' ? 'Катышуучунун кирүүсү' : 'Participant Login'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          {lang === 'ru' ? 'Или ' : lang === 'kg' ? 'Же ' : 'Or '}
          <button onClick={() => navigate('/register')} className="font-bold text-[#9F7AEA] hover:text-[#805AD5] transition-colors underline decoration-2 underline-offset-4 cursor-pointer">
            {lang === 'ru' ? 'активируйте аккаунт для просмотра результатов' : lang === 'kg' ? 'жыйынтыктарды көрүү үчүн аккаунтту активдештириңиз' : 'activate your account to check results'}
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-xl sm:px-10 border border-slate-100 relative overflow-hidden">
          
          <form className="space-y-6 relative z-10" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
                {lang === 'ru' ? 'Электронная почта' : lang === 'kg' ? 'Электрондук почта' : 'Email address'}
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border-2 border-slate-200 rounded-none shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-[#9F7AEA] sm:text-sm font-medium transition-colors bg-slate-50 focus:bg-white"
                  placeholder={lang === 'ru' ? 'Введите ваш email' : lang === 'kg' ? 'Электрондук почтаңызды киргизиңиз' : 'Enter your email'}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                  {lang === 'ru' ? 'Пароль' : lang === 'kg' ? 'Сырсөз' : 'Password'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setIsResetModalOpen(true);
                  }}
                  className="text-xs font-semibold text-[#9F7AEA] hover:text-[#805ad5] transition-colors cursor-pointer"
                >
                  {lang === 'ru' ? 'Забыли пароль?' : lang === 'kg' ? 'Сырсөздү унуттуңузбу?' : 'Forgot password?'}
                </button>
              </div>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border-2 border-slate-200 rounded-none shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-[#9F7AEA] sm:text-sm font-medium transition-colors bg-slate-50 focus:bg-white pr-10"
                  placeholder={lang === 'ru' ? 'Введите пароль' : lang === 'kg' ? 'Сырсөздү киргизиңиз' : 'Enter your password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-4 border-2 border-slate-900 text-sm font-bold rounded-none text-white bg-slate-900 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {lang === 'ru' ? 'Вход...' : lang === 'kg' ? 'Кирүү...' : 'Signing in...'}
                  </span>
                ) : (
                  <span className="flex items-center">
                    {lang === 'ru' ? 'Войти' : lang === 'kg' ? 'Кирүү' : 'Sign in'}
                  </span>
                )}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{lang === 'ru' ? 'Войти через Google' : lang === 'kg' ? 'Google аркылуу кирүү' : 'Sign in with Google'}</span>
              </button>
            </div>
          </form>
          
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-[#EDE9FE] rounded-full opacity-50 z-0 blur-xl"></div>
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-[#F3E8FF] rounded-full opacity-50 z-0 blur-xl"></div>
        </div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-fade-in">
            <button
              onClick={() => {
                setIsResetModalOpen(false);
                setResetSuccess(false);
                setResetError('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#9F7AEA]/10 flex items-center justify-center text-[#9F7AEA]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {lang === 'ru' ? 'Восстановление пароля' : 'Password Reset'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ru' ? 'Мы отправим ссылку для сброса на вашу почту' : 'We will send a reset link to your email'}
                </p>
              </div>
            </div>

            {resetSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span>{lang === 'ru' ? 'Письмо успешно отправлено!' : 'Reset link sent!'}</span>
                </div>
                <p className="text-xs text-emerald-700">
                  {lang === 'ru' 
                    ? `Мы отправили письмо с инструкциями по восстановлению на ${resetEmail}. Проверьте папку "Входящие" и "Спам".`
                    : `We sent instructions to ${resetEmail}. Check your inbox and spam folder.`}
                </p>
                <button
                  onClick={() => setIsResetModalOpen(false)}
                  className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  {lang === 'ru' ? 'Понятно, закрыть' : 'Got it, close'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {resetError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                    {resetError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {lang === 'ru' ? 'Ваш Email' : 'Your Email'}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#9F7AEA] bg-slate-50 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 bg-slate-900 hover:bg-[#9F7AEA] text-white font-bold text-xs uppercase tracking-widest rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {resetLoading ? (lang === 'ru' ? 'Отправка...' : 'Sending...') : (lang === 'ru' ? 'Отправить ссылку для сброса' : 'Send Reset Link')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIRM NEW PASSWORD MODAL ── */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#9F7AEA]/10 flex items-center justify-center text-[#9F7AEA]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {lang === 'ru' ? 'Создание нового пароля' : 'Set New Password'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ru' ? 'Введите ваш новый пароль для входа' : 'Enter your new password below'}
                </p>
              </div>
            </div>

            {confirmSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span>{lang === 'ru' ? 'Пароль успешно изменен!' : 'Password changed!'}</span>
                </div>
                <p className="text-xs text-emerald-700">
                  {lang === 'ru' 
                    ? 'Ваш новый пароль сохранен. Сейчас вы будете перенаправлены на форму входа.'
                    : 'Your new password is saved. Redirecting to login...'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                {confirmError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                    {confirmError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {lang === 'ru' ? 'Новый пароль' : 'New Password'}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#9F7AEA] bg-slate-50 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={confirmLoading}
                  className="w-full py-3 bg-slate-900 hover:bg-[#9F7AEA] text-white font-bold text-xs uppercase tracking-widest rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {confirmLoading ? (lang === 'ru' ? 'Сохранение...' : 'Saving...') : (lang === 'ru' ? 'Сохранить новый пароль' : 'Save New Password')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
