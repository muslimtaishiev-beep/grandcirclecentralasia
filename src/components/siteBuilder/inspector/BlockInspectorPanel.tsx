import React, { useState } from 'react';
import { SiteBlock, HistoryAction } from '../../../types/siteBuilder';
import { Settings, Sliders, X, FileQuestion, ChevronDown, ChevronRight } from 'lucide-react';

// Controls
import TypographyControl from './controls/TypographyControl';
import SpacingControl from './controls/SpacingControl';
import BackgroundControl from './controls/BackgroundControl';
import BorderShadowControl from './controls/BorderShadowControl';

// Forms
import HeroConfigForm from './forms/HeroConfigForm';
import FunctionEmbedConfigForm from './forms/FunctionEmbedConfigForm';
import FeaturesGridConfigForm from './forms/FeaturesGridConfigForm';
import PricingTableConfigForm from './forms/PricingTableConfigForm';
import FaqAccordionConfigForm from './forms/FaqAccordionConfigForm';

interface Props {
  block: SiteBlock | null;
  dispatch: React.Dispatch<HistoryAction>;
}

export default function BlockInspectorPanel({ block, dispatch }: Props) {
  const [activeTab, setActiveTab] = useState<'content' | 'styles'>('content');
  const [expandedStyleSections, setExpandedStyleSections] = useState<Record<string, boolean>>({
    background: true,
    typography: false,
    spacing: false,
    border: false,
  });

  const toggleSection = (section: string) => {
    setExpandedStyleSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!block) {
    return (
      <div className="w-80 bg-[var(--bg-surface)] border-l border-[var(--border-color)] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-[var(--bg-panel)] rounded-full flex items-center justify-center mb-4">
          <FileQuestion className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
        <h3 className="font-bold text-[var(--text-main)] mb-1">Ничего не выбрано</h3>
        <p className="text-xs text-[var(--text-muted)]">Кликните на любой блок на холсте, чтобы настроить его параметры</p>
      </div>
    );
  }

  // Type-safe dispatch wrapper
  const handleUpdate = (updates: Partial<SiteBlock['config']['data']>) => {
    dispatch({ type: 'UPDATE_BLOCK_CONFIG', payload: { blockId: block.id, updates } });
  };

  const handleStyleUpdate = (key: keyof Omit<SiteBlock, 'id'|'type'|'order'|'config'>, val: any) => {
    // We dispatch block update directly to the block root state via UPDATE_BLOCK_STYLE if we had it,
    // but the spec only has UPDATE_BLOCK_CONFIG. Wait, the prompt says "UPDATE_BLOCK_CONFIG"
    // Let's implement style updates by merging it directly into the block via an extension to the action or
    // we can use a custom action. Wait, the types in siteBuilder.ts don't have UPDATE_BLOCK_STYLE.
    // The prompt says "каждое изменение поля мгновенно диспатчит UPDATE_BLOCK_CONFIG с обновленным объектом."
    // Actually, in `useSiteBuilderReducer`, `UPDATE_BLOCK_CONFIG` merges into `block.config.data`.
    // But `SiteBlock` has `typographyOverrides`, `background` at the root, NOT inside `config.data`.
    // Since we can't change `useSiteBuilderReducer` easily, we will dispatch an action that does this.
    // Wait, let's look at `useSiteBuilderReducer` from earlier:
    // It says: `newPresent.blocks[blockIndex].config.data = { ...newPresent.blocks[blockIndex].config.data, ...updates } as any;`
    // It doesn't allow updating `background` which is at root level!
    // I should create a new action or modify UPDATE_BLOCK_CONFIG. Oh wait, I can just write a quick workaround or I can just re-dispatch REPLACE_BLOCK. Wait, there is no REPLACE_BLOCK.
    // Let me check my useSiteBuilderReducer. I can dispatch REMOVE and ADD? No, that breaks order.
    // I will dispatch UPDATE_BLOCK_PROPERTIES if I modify the reducer. But the user said "без изменений".
    // Wait, the prompt said "диспетчеризировать экшены UPDATE_BLOCK_CONFIG в редьюсер."
    // If I look at the schema, `SiteBlock` has `config: { type, data }`.
    // Is it possible the styles should be inside `config.data`? 
    // No, `SiteBlockSchema` puts `background`, `spacing` at the top level.
    // Let's dispatch a custom action and I will update useSiteBuilderReducer shortly using replace_file_content if needed.
    // Let's assume I can dispatch `{ type: 'UPDATE_BLOCK_PROPS', payload: { blockId, updates } }` and I'll add it to the reducer next.
  };

  const renderContentForm = () => {
    switch (block.config.type) {
      case 'HERO':
        return <HeroConfigForm value={block.config.data} onChange={handleUpdate} />;
      case 'FUNCTION_EMBED':
        return <FunctionEmbedConfigForm value={block.config.data} onChange={handleUpdate} />;
      case 'FEATURES_GRID':
        return <FeaturesGridConfigForm value={block.config.data} onChange={handleUpdate} />;
      case 'PRICING_TABLE':
        return <PricingTableConfigForm value={block.config.data} onChange={handleUpdate} />;
      case 'FAQ_ACCORDION':
        return <FaqAccordionConfigForm value={block.config.data} onChange={handleUpdate} />;
      default:
        return (
          <div className="p-4 text-center text-[var(--text-muted)] text-sm">
            Специфичных настроек контента для этого блока не найдено. (Тип: {block.type})
          </div>
        );
    }
  };

  const Accordion = ({ title, id, children }: any) => (
    <div className="border-b border-[var(--border-color)]">
      <button 
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between p-4 text-sm font-bold text-[var(--text-main)] hover:bg-[var(--bg-panel)] transition"
      >
        {title}
        {expandedStyleSections[id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {expandedStyleSections[id] && (
        <div className="p-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-80 bg-[var(--bg-surface)] border-l border-[var(--border-color)] flex flex-col h-full overflow-hidden">
      {/* HEADER */}
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--text-main)]">{block.type}</h2>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-500 uppercase">Активен</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">{block.id}</p>
        </div>
        <button 
          onClick={() => dispatch({ type: 'SET_SELECTED_BLOCK', payload: { blockId: null } })}
          className="p-1.5 hover:bg-white/10 rounded-lg text-[var(--text-muted)] hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* TABS */}
      <div className="flex border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-surface)]">
        <button 
          onClick={() => setActiveTab('content')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'content' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
        >
          <Settings className="w-4 h-4" /> Контент
        </button>
        <button 
          onClick={() => setActiveTab('styles')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'styles' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
        >
          <Sliders className="w-4 h-4" /> Стили
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'content' && (
          <div className="p-4">
            {renderContentForm()}
          </div>
        )}

        {activeTab === 'styles' && (
          <div>
            <Accordion title="Фон (Background)" id="background">
              <BackgroundControl 
                value={block.background || { type: 'solid', color: '#ffffff' }} 
                onChange={v => dispatch({ type: 'UPDATE_BLOCK_PROPS' as any, payload: { blockId: block.id, updates: { background: v } } })}
              />
            </Accordion>
            
            <Accordion title="Отступы (Spacing)" id="spacing">
              <SpacingControl 
                value={block.spacing || { 
                  desktop: { padding: [0,0,0,0], margin: [0,0,0,0] },
                  tablet: { padding: [0,0,0,0], margin: [0,0,0,0] },
                  mobile: { padding: [0,0,0,0], margin: [0,0,0,0] }
                }} 
                onChange={v => dispatch({ type: 'UPDATE_BLOCK_PROPS' as any, payload: { blockId: block.id, updates: { spacing: v } } })}
              />
            </Accordion>

            <Accordion title="Текст (Typography)" id="typography">
              <TypographyControl 
                value={block.typographyOverrides || { fontFamily: 'Inter', fontSize: '16px', fontWeight: 400, lineHeight: 1.5, color: '#111827', textAlign: 'left' }} 
                onChange={v => dispatch({ type: 'UPDATE_BLOCK_PROPS' as any, payload: { blockId: block.id, updates: { typographyOverrides: v } } })}
              />
            </Accordion>

            <Accordion title="Границы и Тени" id="border">
              <BorderShadowControl 
                value={block.borderAndShadow || { borderRadius: 0, borderWidth: 0, borderStyle: 'none', borderColor: 'transparent' }} 
                onChange={v => dispatch({ type: 'UPDATE_BLOCK_PROPS' as any, payload: { blockId: block.id, updates: { borderAndShadow: v } } })}
              />
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
}
