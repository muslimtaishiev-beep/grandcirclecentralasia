import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  lang?: "ru" | "en" | "kg";
}

const Login: React.FC<LoginProps> = ({ lang = "ru" }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(lang === 'ru' ? 'Ошибка входа. Проверьте почту и пароль.' : lang === 'kg' ? 'Кирүү катасы. Электрондук почтаны жана сырсөздү текшериңиз.' : 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || (lang === 'ru' ? 'Ошибка входа через Google. Проверьте Authorized Domains в Firebase.' : 'Google sign-in error. Check Authorized Domains in Firebase.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-display font-black text-slate-900 uppercase tracking-tight">
          {lang === 'ru' ? 'Вход участника' : lang === 'kg' ? 'Катышуучунун кирүүсү' : 'Participant Login'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          {lang === 'ru' ? 'Или ' : lang === 'kg' ? 'Же ' : 'Or '}
          <button onClick={() => navigate('/register')} className="font-bold text-[#9F7AEA] hover:text-[#805AD5] transition-colors underline decoration-2 underline-offset-4">
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
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
                {lang === 'ru' ? 'Пароль' : lang === 'kg' ? 'Сырсөз' : 'Password'}
              </label>
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
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
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
                className="w-full flex justify-center py-4 px-4 border-2 border-slate-900 text-sm font-bold rounded-none text-white bg-slate-900 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
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
    </div>
  );
};

export default Login;
