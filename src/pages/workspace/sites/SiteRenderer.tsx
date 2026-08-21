import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { triggerAutomation } from '../../../lib/useAutomations';
import { CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react';
import { SiteBlock } from './SiteBuilder';

export default function SiteRenderer() {
  const { siteId } = useParams();
  const [blocks, setBlocks] = useState<SiteBlock[]>([]);
  const [siteTitle, setSiteTitle] = useState('Лендинг');
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    const docRef = doc(db, 'sites', siteId);
    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.blocks) setBlocks(data.blocks);
        if (data.title) setSiteTitle(data.title);
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [siteId]);

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !siteId) return;

    setSubmitting(true);
    try {
      // 1. Create Lead in CRM Contacts
      await addDoc(collection(db, 'crm_contacts'), {
        tenantId: siteId,
        name,
        phone,
        source: 'Официальный Сайт',
        tags: ['Сайт', 'Лид'],
        createdAt: serverTimestamp()
      });

      // 2. Create Deal in CRM Deals
      await addDoc(collection(db, 'crm_deals'), {
        tenantId: siteId,
        title: `Лид с сайта: ${name}`,
        contactName: name,
        phone,
        stage: 'Новая заявка',
        amount: 0,
        createdAt: serverTimestamp()
      });

      // 3. Trigger Automation (If-This-Then-That rule)
      await triggerAutomation(siteId, 'NEW_CONTACT', {
        contactName: name,
        title: `Новая заявка: ${name}`
      });

      setSubmitted(true);
      setName('');
      setPhone('');
    } catch (err) {
      console.error('Failed to submit lead:', err);
      alert('Ошибка при отправке заявки');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Сайт не найден</h1>
        <p className="text-slate-400 text-sm">Сайт не существует или еще не был опубликован</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <title>{siteTitle}</title>

      <div className="max-w-5xl mx-auto border-x border-slate-800/60 min-h-screen">
        {blocks.map((block) => (
          <section key={block.id} className="p-8 sm:p-16 border-b border-slate-800/60 last:border-b-0">
            
            {/* HERO BLOCK */}
            {block.type === 'hero' && (
              <div className="text-center py-12 sm:py-20 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> Официальный ресурс
                </div>
                <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
                  {block.title}
                </h1>
                <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
                  {block.subtitle}
                </p>
                {block.buttonText && (
                  <a 
                    href="#lead-form" 
                    className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/30 hover:scale-105 transition-transform"
                  >
                    {block.buttonText}
                  </a>
                )}
              </div>
            )}

            {/* FEATURES BLOCK */}
            {block.type === 'features' && (
              <div className="py-8">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-white mb-12">
                  {block.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {block.items?.map((item, idx) => (
                    <div key={idx} className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl hover:border-indigo-500/40 transition">
                      <h3 className="text-lg font-bold text-indigo-400 mb-2">{item.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TEXT BLOCK */}
            {block.type === 'text' && (
              <div className="max-w-3xl mx-auto text-center py-6">
                <h2 className="text-2xl font-bold text-white mb-3">{block.title}</h2>
                <p className="text-slate-400 leading-relaxed">{block.subtitle}</p>
              </div>
            )}

            {/* CRM LEAD FORM BLOCK */}
            {block.type === 'form' && (
              <div id="lead-form" className="max-w-md mx-auto py-8">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>

                  <h2 className="text-2xl font-bold text-white text-center mb-2">{block.title}</h2>
                  <p className="text-xs text-slate-400 text-center mb-6">{block.subtitle}</p>

                  {submitted ? (
                    <div className="text-center py-8 space-y-3">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                      <h3 className="text-lg font-bold text-white">Заявка принята!</h3>
                      <p className="text-xs text-slate-400">Наш менеджер свяжется с вами в самое ближайшее время.</p>
                      <button 
                        onClick={() => setSubmitted(false)}
                        className="text-xs text-indigo-400 underline mt-2"
                      >
                        Отправить еще одну заявку
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitLead} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Ваше Имя</label>
                        <input 
                          type="text" 
                          required
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Иван Иванов"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Номер телефона</label>
                        <input 
                          type="tel" 
                          required
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+996 (555) 000-000"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Отправить заявку
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* FOOTER BLOCK */}
            {block.type === 'footer' && (
              <footer className="text-center py-6 text-xs text-slate-500">
                <p className="font-semibold text-slate-400">{block.title}</p>
                <p className="mt-1">{block.subtitle}</p>
              </footer>
            )}

          </section>
        ))}
      </div>
    </div>
  );
}
