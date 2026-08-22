import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, Trash2, Save, Eye, Globe, ExternalLink, Copy, Check, 
  Layout, Type, Star, Send, ArrowUp, ArrowDown, Sparkles, Loader2 
} from 'lucide-react';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export interface SiteBlock {
  id: string;
  type: 'hero' | 'features' | 'text' | 'form' | 'footer';
  title: string;
  subtitle?: string;
  content?: string;
  buttonText?: string;
  items?: { title: string; desc: string }[];
}

export default function SiteBuilder() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  const navigate = useNavigate();

  const [siteId, setSiteId] = useState<string>(orgId || 'my-site');
  const [siteTitle, setSiteTitle] = useState('Официальный лендинг компании');
  const [blocks, setBlocks] = useState<SiteBlock[]>([
    {
      id: '1',
      type: 'hero',
      title: 'Добро пожаловать в нашу академию',
      subtitle: 'Лучшие образовательные программы и курсы от ведущих экспертов',
      buttonText: 'Записаться на курс'
    },
    {
      id: '2',
      type: 'features',
      title: 'Почему выбирают нас',
      items: [
        { title: 'Диплом стандарта', desc: 'Выдаем государственные и международные сертификаты' },
        { title: 'Практика 80%', desc: 'Обучение на реальных бизнес-кейсах и проектах' },
        { title: 'Онлайн и офлайн', desc: 'Удобный формат с поддержкой личного куратора' }
      ]
    },
    {
      id: '3',
      type: 'form',
      title: 'Оставить заявку на консультацию',
      subtitle: 'Заполните форму, и наш менеджер свяжется с вами в течение 15 минут'
    },
    {
      id: '4',
      type: 'footer',
      title: '© 2026 Все права защищены',
      subtitle: 'Образовательная платформа нового поколения'
    }
  ]);

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  useEffect(() => {
    if (!orgId) return;
    const docRef = doc(db, 'sites', orgId);
    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.blocks) setBlocks(data.blocks);
        if (data.title) setSiteTitle(data.title);
      }
    }).catch(console.error);
  }, [orgId]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'sites', orgId), {
        tenantId: orgId,
        title: siteTitle,
        blocks,
        updatedAt: serverTimestamp()
      });
      alert('Сайт успешно сохранен и опубликован!');
    } catch (e) {
      console.error(e);
      alert('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: SiteBlock['type']) => {
    const newBlock: SiteBlock = {
      id: Date.now().toString(),
      type,
      title: type === 'hero' ? 'Новый заголовок' : type === 'features' ? 'Наши преимущества' : type === 'form' ? 'Оставить заявку' : 'Текстовый блок',
      subtitle: 'Введите описание блока',
      items: type === 'features' ? [{ title: 'Фича 1', desc: 'Описание фичи 1' }] : undefined
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;
    setBlocks(newBlocks);
  };

  const updateBlock = (id: string, key: keyof SiteBlock, value: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, [key]: value } : b));
  };

  const publicUrl = `${window.location.origin}/site/${orgId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
      {/* Header */}
      <div className="h-14 bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-main)]">Конструктор сайтов</h1>
            <p className="text-xs text-[var(--text-muted)]">{activeTenant?.name}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1">
            <button 
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${activeTab === 'editor' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              Редактор
            </button>
            <button 
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${activeTab === 'preview' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              Предпросмотр
            </button>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Скопировано' : 'Ссылка'}
          </button>

          <a 
            href={`/site/${orgId}`} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Открыть
          </a>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Опубликовать
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      {activeTab === 'editor' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Block Palette */}
          <div className="w-64 bg-[var(--bg-surface)] border-r border-[var(--border-color)] p-4 flex flex-col gap-3 overflow-y-auto">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Добавить блок</h3>
            
            <button 
              onClick={() => addBlock('hero')} 
              className="flex items-center gap-3 p-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent)] hover:shadow-sm text-left transition group"
            >
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg group-hover:scale-110 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-[var(--text-main)]">Главный экран (Hero)</div>
                <div className="text-[10px] text-[var(--text-muted)]">Заголовок, подзаголовок, кнопка</div>
              </div>
            </button>

            <button 
              onClick={() => addBlock('features')} 
              className="flex items-center gap-3 p-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent)] hover:shadow-sm text-left transition group"
            >
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg group-hover:scale-110 transition-transform">
                <Star className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-[var(--text-main)]">Преимущества</div>
                <div className="text-[10px] text-[var(--text-muted)]">Сетка из фич и преимуществ</div>
              </div>
            </button>

            <button 
              onClick={() => addBlock('form')} 
              className="flex items-center gap-3 p-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent)] hover:shadow-sm text-left transition group"
            >
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg group-hover:scale-110 transition-transform">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-[var(--text-main)]">CRM-Форма Лидов</div>
                <div className="text-[10px] text-[var(--text-muted)]">Авто-создание лидов в CRM</div>
              </div>
            </button>

            <button 
              onClick={() => addBlock('text')} 
              className="flex items-center gap-3 p-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent)] hover:shadow-sm text-left transition group"
            >
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:scale-110 transition-transform">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-[var(--text-main)]">Текстовый блок</div>
                <div className="text-[10px] text-[var(--text-muted)]">Произвольный текст</div>
              </div>
            </button>
          </div>

          {/* Center Canvas List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto">
            <div className="mb-4">
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Название страницы (SEO Title)</label>
              <input 
                type="text" 
                value={siteTitle}
                onChange={e => setSiteTitle(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {blocks.map((block, idx) => (
              <div key={block.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm hover:border-[var(--accent)]/50 transition">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold uppercase rounded">
                      {block.type}
                    </span>
                    <span className="text-xs font-bold text-[var(--text-main)]">Блок #{idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-[var(--text-muted)] disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveBlock(idx, 'down')} disabled={idx === blocks.length - 1} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-[var(--text-muted)] disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeBlock(block.id)} className="p-1 hover:bg-red-500/10 text-red-500 rounded transition ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Заголовок</label>
                    <input 
                      type="text" 
                      value={block.title}
                      onChange={e => updateBlock(block.id, 'title', e.target.value)}
                      className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  {block.subtitle !== undefined && (
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Подзаголовок</label>
                      <input 
                        type="text" 
                        value={block.subtitle}
                        onChange={e => updateBlock(block.id, 'subtitle', e.target.value)}
                        className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  )}

                  {block.type === 'hero' && (
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Текст Кнопки</label>
                      <input 
                        type="text" 
                        value={block.buttonText || ''}
                        onChange={e => updateBlock(block.id, 'buttonText', e.target.value)}
                        className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Live Render Preview */
        <div className="flex-1 overflow-y-auto bg-slate-950 text-white p-6">
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden min-h-[600px]">
            {blocks.map(block => (
              <div key={block.id} className="p-10 border-b border-slate-800/80 last:border-b-0">
                {block.type === 'hero' && (
                  <div className="text-center py-12 space-y-6">
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">{block.title}</h1>
                    <p className="text-slate-400 text-lg max-w-xl mx-auto">{block.subtitle}</p>
                    {block.buttonText && (
                      <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl shadow-lg transition">
                        {block.buttonText}
                      </button>
                    )}
                  </div>
                )}

                {block.type === 'features' && (
                  <div>
                    <h2 className="text-2xl font-bold text-center mb-8">{block.title}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {block.items?.map((item, i) => (
                        <div key={i} className="p-6 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                          <div className="font-bold text-indigo-400 mb-2">{item.title}</div>
                          <div className="text-xs text-slate-400">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {block.type === 'form' && (
                  <div className="max-w-md mx-auto bg-slate-800 border border-slate-700 p-8 rounded-2xl">
                    <h2 className="text-xl font-bold text-center mb-2">{block.title}</h2>
                    <p className="text-xs text-slate-400 text-center mb-6">{block.subtitle}</p>
                    <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                      <input type="text" placeholder="Ваше Имя" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs focus:outline-none focus:border-indigo-500" />
                      <input type="text" placeholder="Номер телефона" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs focus:outline-none focus:border-indigo-500" />
                      <button className="w-full py-3 bg-indigo-600 font-bold rounded-lg text-xs hover:bg-indigo-500 transition">Отправить заявку в CRM</button>
                    </form>
                  </div>
                )}

                {block.type === 'footer' && (
                  <div className="text-center text-xs text-slate-500 py-4">
                    <div>{block.title}</div>
                    <div className="mt-1 opacity-70">{block.subtitle}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
