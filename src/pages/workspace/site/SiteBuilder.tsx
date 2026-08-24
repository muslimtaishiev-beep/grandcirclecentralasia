import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSiteBuilderReducer, BuilderState } from '../../../hooks/useSiteBuilderReducer';
import { sitePersistenceService, calculateStateHash } from '../../../services/siteBuilderPersistence';
import LiveCanvas from '../../../components/siteBuilder/canvas/LiveCanvas';
import BlockInspectorPanel from '../../../components/siteBuilder/inspector/BlockInspectorPanel';
import { SiteBlock, TenantLandingPage } from '../../../types/siteBuilder';

import { 
  Undo, Redo, Layout, Smartphone, Tablet, Monitor, 
  Save, Globe, PlusSquare, Image, List, Link, CreditCard, HelpCircle, MessageSquare
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';

const DEFAULT_BLOCKS = [
  { type: 'HERO', icon: Image, label: 'Hero Секция', defaultData: { title: 'Новый Заголовок', subtitle: 'Вдохновляющий подзаголовок для конверсии', primaryCta: { text: 'Начать', link: '#', style: 'primary' } } },
  { type: 'FEATURES_GRID', icon: Layout, label: 'Преимущества', defaultData: { title: 'Почему выбирают нас', columns: 3, items: [] } },
  { type: 'FUNCTION_EMBED', icon: Link, label: 'Бизнес-функция', defaultData: { embeddedFunctionId: '', widgetTheme: 'card' } },
  { type: 'PRICING_TABLE', icon: CreditCard, label: 'Тарифы', defaultData: { title: 'Цены и пакеты', tiers: [] } },
  { type: 'FAQ_ACCORDION', icon: HelpCircle, label: 'Вопросы (FAQ)', defaultData: { title: 'Часто задаваемые вопросы', items: [], allowMultipleExpanded: false } },
  { type: 'TESTIMONIALS', icon: MessageSquare, label: 'Отзывы', defaultData: { title: 'Что о нас говорят', items: [] } },
  { type: 'FOOTER', icon: List, label: 'Подвал сайта', defaultData: { companyName: 'MyCompany', copyright: `© ${new Date().getFullYear()} Все права защищены`, columns: [] } }
];

const DEFAULT_PAGE: TenantLandingPage = {
  id: 'new',
  tenantId: 'demo',
  slug: 'home',
  version: 1,
  status: 'draft',
  seo: { metaTitle: 'Новый сайт', metaDescription: '' },
  theme: { fontFamily: 'Inter', primaryColor: '#10b981', accentColor: '#3b82f6' },
  blocks: [],
  updatedAt: Date.now()
};

export default function SiteBuilder() {
  const { orgId } = useParams();
  const [state, dispatch] = useSiteBuilderReducer(DEFAULT_PAGE, calculateStateHash(DEFAULT_PAGE));

  // Auto-save via reducer sync
  useEffect(() => {
    if (!state.isDirty || !orgId) return;
    
    sitePersistenceService.debouncedSave(
      orgId,
      state.present,
      state.lastSavedHash,
      (newVersion, newHash) => {
        dispatch({ type: 'SYNC_SUCCESS', payload: { newVersion, newHash } });
      },
      (err) => {
        console.error(err);
        dispatch({ type: 'SYNC_ERROR', payload: { error: err } });
      }
    );
  }, [state.present, state.isDirty, state.lastSavedHash, orgId, dispatch]);

  const handlePublish = async () => {
    if (!orgId) return;
    try {
      const updatedPage = { ...state.present, status: 'published' as const };
      dispatch({ type: 'UPDATE_PAGE_META', payload: { updates: { status: 'published' } } });
      
      const pageRef = doc(db, 'landing_pages', `${orgId}_${updatedPage.slug}`);
      await setDoc(pageRef, {
        ...updatedPage,
        version: increment(1),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePreview = () => {
    if (orgId && state.present.slug) {
      window.open(`/sites/${orgId}/${state.present.slug}`, '_blank');
    }
  };

  const addBlock = (type: string, defaultData: any) => {
    const newBlock: SiteBlock = {
      id: crypto.randomUUID(),
      type: type as any,
      order: state.present.blocks.length,
      config: { type: type as any, data: defaultData },
      background: { type: 'solid', color: 'transparent' },
      spacing: { 
        desktop: { padding: [80, 0, 80, 0], margin: [0,0,0,0] },
        tablet: { padding: [60, 0, 60, 0], margin: [0,0,0,0] },
        mobile: { padding: [40, 0, 40, 0], margin: [0,0,0,0] }
      },
      typographyOverrides: {
        fontFamily: state.present.theme.fontFamily,
        color: '#111827',
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: 1.5,
        textAlign: 'left'
      }
    };
    dispatch({ type: 'ADD_BLOCK', payload: { block: newBlock } });
  };

  const activeBlock = state.present.blocks.find(b => b.id === state.selectedBlockId) || null;

  return (
    <div className="h-[calc(100vh-64px)] -m-4 flex flex-col bg-[var(--bg-surface)] text-[var(--text-main)] overflow-hidden rounded-tl-2xl border-l border-t border-[var(--border-color)]">
      {/* HEADER BAR */}
      <header className="h-14 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="font-bold text-sm tracking-tight flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <Layout className="w-3.5 h-3.5" />
            </div>
            <span className="hidden md:inline">Редактор Лендингов</span>
            {state.present.status === 'draft' ? (
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/20 text-amber-500 ml-2">Draft</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-500 ml-2">Published</span>
            )}
          </div>
          
          <div className="h-4 w-px bg-[var(--border-color)]"></div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => dispatch({ type: 'UNDO' })} 
              disabled={state.past.length === 0}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition"
              title="Отменить"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button 
              onClick={() => dispatch({ type: 'REDO' })} 
              disabled={state.future.length === 0}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition"
              title="Повторить"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>
          
          <div className="h-4 w-px bg-[var(--border-color)] hidden md:block"></div>
          
          <div className="hidden md:flex items-center gap-2 text-[10px] uppercase font-bold text-[var(--text-muted)] w-24">
            {state.syncStatus === 'saving' && <span className="text-yellow-500 flex items-center gap-1"><Save className="w-3 h-3 animate-pulse" /> Saving...</span>}
            {state.syncStatus === 'saved' && <span className="text-emerald-500 flex items-center gap-1"><Save className="w-3 h-3" /> Saved</span>}
            {state.syncStatus === 'error' && <span className="text-red-500">Error saving</span>}
          </div>
        </div>

        <div className="flex flex-1 justify-center">
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg border border-[var(--border-color)]">
            <button 
              onClick={() => dispatch({ type: 'SET_SELECTED_DEVICE', payload: { device: 'desktop' } })}
              className={`p-1.5 rounded-md transition ${state.selectedDevice === 'desktop' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button 
              onClick={() => dispatch({ type: 'SET_SELECTED_DEVICE', payload: { device: 'tablet' } })}
              className={`p-1.5 rounded-md transition ${state.selectedDevice === 'tablet' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button 
              onClick={() => dispatch({ type: 'SET_SELECTED_DEVICE', payload: { device: 'mobile' } })}
              className={`p-1.5 rounded-md transition ${state.selectedDevice === 'mobile' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handlePreview}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-[var(--bg-surface)] border border-[var(--border-color)] hover:bg-[var(--bg-panel)] rounded-lg transition"
          >
            <Globe className="w-3.5 h-3.5" /> Превью
          </button>
          <button 
            onClick={handlePublish}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition shadow-sm"
          >
            {state.present.status === 'published' ? 'Обновить' : 'Опубликовать'}
          </button>
        </div>
      </header>

      {/* WORKSPACE AREA */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: CATALOG */}
        <aside className="w-64 bg-[var(--bg-panel)] border-r border-[var(--border-color)] flex flex-col shrink-0">
          <div className="p-4 border-b border-[var(--border-color)]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
              <PlusSquare className="w-4 h-4" /> Библиотека блоков
            </h3>
          </div>
          <div className="p-4 overflow-y-auto space-y-2 pb-20">
            {DEFAULT_BLOCKS.map(b => (
              <button 
                key={b.type}
                onClick={() => addBlock(b.type, b.defaultData)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-emerald-500/50 hover:shadow-sm hover:text-emerald-500 transition text-sm font-medium text-left group"
              >
                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 group-hover:bg-emerald-500/10 text-slate-500 group-hover:text-emerald-500 transition">
                  <b.icon className="w-4 h-4" />
                </div>
                {b.label}
              </button>
            ))}
          </div>
        </aside>

        {/* CENTER: LIVE CANVAS */}
        <main className="flex-1 relative flex flex-col">
          <LiveCanvas 
            page={state.present} 
            selectedBlockId={state.selectedBlockId} 
            selectedDevice={state.selectedDevice}
            dispatch={dispatch} 
          />
        </main>

        {/* RIGHT: INSPECTOR */}
        <BlockInspectorPanel block={activeBlock} dispatch={dispatch} />
        
      </div>
    </div>
  );
}
