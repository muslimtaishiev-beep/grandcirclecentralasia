import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { allowedStudents } from '../data/allowedStudents';
import emailjs from '@emailjs/browser';
import { motion } from 'framer-motion';

interface SignupProps {
  lang?: "ru" | "en" | "kg";
}

const Signup: React.FC<SignupProps> = ({ lang = "ru" }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Code verification
  const [generatedCode, setGeneratedCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');

  // Step 1: Check whitelist and capture password
  const checkNameAndProceed = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError(lang === 'ru' ? 'Пароль должен содержать минимум 6 символов.' : lang === 'kg' ? 'Сырсөз кеминде 6 белгиден турушу керек.' : 'Password must be at least 6 characters.');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
    const isAllowed = allowedStudents.includes(fullName);

    if (!isAllowed) {
      setError(lang === 'ru' ? 'К сожалению, ваше имя не найдено в списке подтвержденных участников. Пожалуйста, проверьте правильность написания или обратитесь в поддержку.' : lang === 'kg' ? 'Кечиресиз, сиздин атыңыз тастыкталган катышуучулардын тизмесинен табылган жок. Сураныч, туура жазылганын текшериңиз же колдоо кызматына кайрылыңыз.' : 'Sorry, your name was not found in the approved list. Please check the spelling or contact support.');
      return;
    }

    setStep(2);
  };

  // Step 2: Send Email Verification
  const sendVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(lang === 'ru' ? 'Email не может быть пустым.' : lang === 'kg' ? 'Email бош болуусу мүмкүн эмес.' : 'Email cannot be empty.');
      setLoading(false);
      return;
    }

    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);

      const payload = {
        to_email: cleanEmail,
        email: cleanEmail,
        user_email: cleanEmail,
        verification_code: code,
        message: code
      };
      
      console.log("Отправляем в EmailJS:", payload);

      await emailjs.send(
        'service_60qlgjo',
        'template_805rchp',
        payload,
        'Dhb9rtN7cxRWsLZPg'
      );

      setStep(3);
    } catch (err: any) {
      console.error("Ошибка EmailJS:", err);
      setError(`Не удалось отправить письмо: ${err.text || err.message || 'неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify and Create Account
  const finalizeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (enteredCode !== generatedCode) {
      setError('Неверный код подтверждения.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const fullName = `${firstName.trim().toLowerCase()} ${lastName.trim().toLowerCase()}`;
      const reverseFullName = `${lastName.trim().toLowerCase()} ${firstName.trim().toLowerCase()}`;
      
      // Fetch pre-set decision if any
      let preSetDecision = 'pending';
      try {
        const decisionDoc = await getDoc(doc(db, 'decisions', fullName));
        if (decisionDoc.exists() && decisionDoc.data().decisionStatus && decisionDoc.data().decisionStatus !== 'pending') {
          preSetDecision = decisionDoc.data().decisionStatus;
        } else {
          const reverseDoc = await getDoc(doc(db, 'decisions', reverseFullName));
          if (reverseDoc.exists() && reverseDoc.data().decisionStatus && reverseDoc.data().decisionStatus !== 'pending') {
            preSetDecision = reverseDoc.data().decisionStatus;
          }
        }
      } catch (err) {
        console.error("Failed to fetch pre-set decision", err);
      }
      
      // Save user to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        decisionStatus: preSetDecision,
        createdAt: new Date().toISOString()
      });

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации. Возможно этот Email уже используется.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-white border border-slate-200 shadow-sm p-8"
      >
        <h2 className="text-3xl font-display mb-2 text-slate-900 uppercase tracking-tight">
          {lang === 'ru' ? 'Активация аккаунта' : lang === 'kg' ? 'Аккаунтту активдештирүү' : 'Account Activation'}
        </h2>
        
        <div className="flex space-x-2 mb-6">
          <div className={`h-1 flex-1 ${step >= 1 ? 'bg-red-600' : 'bg-slate-200'}`}></div>
          <div className={`h-1 flex-1 ${step >= 2 ? 'bg-red-600' : 'bg-slate-200'}`}></div>
          <div className={`h-1 flex-1 ${step >= 3 ? 'bg-red-600' : 'bg-slate-200'}`}></div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={checkNameAndProceed} className="space-y-6">
            <p className="text-slate-500 text-sm mb-4">Пожалуйста, введите ваше Имя, Фамилию и придумайте пароль для входа.</p>
            
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">First Name (Имя)</label>
              <input 
                type="text" 
                required
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 border border-slate-800 focus:border-red-600 focus:outline-none transition-colors"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Last Name (Фамилия)</label>
              <input 
                type="text" 
                required
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 border border-slate-800 focus:border-red-600 focus:outline-none transition-colors"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Create Password (Пароль)</label>
              <input 
                type="password" 
                required
                minLength={6}
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 border border-slate-800 focus:border-red-600 focus:outline-none transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 mt-4 uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Next Step
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={sendVerificationCode} className="space-y-6">
            <p className="text-slate-500 text-sm mb-4">Отлично, <strong>{firstName}</strong>! Теперь введите ваш Email и номер телефона, чтобы получить код подтверждения.</p>
            
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 border border-slate-800 focus:border-red-600 focus:outline-none transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Phone Number</label>
              <input 
                type="tel" 
                required
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 border border-slate-800 focus:border-red-600 focus:outline-none transition-colors"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || !email}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 mt-4 uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
            <button 
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-slate-500 text-sm py-2 hover:text-slate-900 font-semibold"
            >
              ← Back
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={finalizeRegistration} className="space-y-6">
            <p className="text-slate-500 text-sm mb-4">6-значный код отправлен на <strong>{email}</strong>.</p>
            
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Verification Code</label>
              <input 
                type="text" 
                required
                maxLength={6}
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 border border-slate-800 focus:border-red-600 focus:outline-none transition-colors text-center text-2xl tracking-widest font-mono"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || enteredCode.length !== 6}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 mt-4 uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Finish Setup'}
            </button>
            
            <button 
              type="button"
              onClick={() => setStep(2)}
              className="w-full text-slate-500 text-sm py-2 hover:text-slate-900 font-semibold"
            >
              ← Back
            </button>
          </form>
        )}

        {step === 1 && (
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">
              Already setup?{' '}
              <Link to="/login" className="text-red-600 hover:text-red-500 hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Signup;
