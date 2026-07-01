import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';

interface LoginProps {
  lang?: "ru" | "en" | "kg";
}

const Login: React.FC<LoginProps> = ({ lang = "ru" }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(lang === 'ru' ? 'Ошибка входа. Проверьте почту и пароль.' : lang === 'kg' ? 'Кирүү катасы. Электрондук почтаны жана сырсөздү текшериңиз.' : 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-display font-black text-slate-900 uppercase tracking-tight">
          {lang === 'ru' ? 'Вход в аккаунт' : lang === 'kg' ? 'Аккаунтка кирүү' : 'Applicant Login'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          {lang === 'ru' ? 'Или ' : lang === 'kg' ? 'Же ' : 'Or '}
          <button onClick={() => navigate('/register')} className="font-bold text-[#9F7AEA] hover:text-[#805AD5] transition-colors underline decoration-2 underline-offset-4">
            {lang === 'ru' ? 'создайте новую заявку' : lang === 'kg' ? 'жаңы тиркеме түзүңүз' : 'start a new application'}
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
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border-2 border-slate-200 rounded-none shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-[#9F7AEA] sm:text-sm font-medium transition-colors bg-slate-50 focus:bg-white"
                  placeholder={lang === 'ru' ? 'Введите пароль' : lang === 'kg' ? 'Сырсөздү киргизиңиз' : 'Enter your password'}
                />
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
          </form>
          
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-[#EDE9FE] rounded-full opacity-50 z-0 blur-xl"></div>
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-[#F3E8FF] rounded-full opacity-50 z-0 blur-xl"></div>
        </div>
      </div>
    </div>
  );
};

export default Login;
