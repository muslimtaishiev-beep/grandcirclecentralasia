import React, { useState } from 'react';
import { SiteBlock } from '../../../../types/siteBuilder';
import { ChevronDown } from 'lucide-react';

interface Props {
  block: SiteBlock;
}

export default function PublicFaqBlock({ block }: Props) {
  if (block.type !== 'FAQ_ACCORDION') return null;
  const { config: { data }, background, spacing, typographyOverrides } = block as any;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!data.allowMultipleExpanded) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  };

  const bgStyle: React.CSSProperties = {
    backgroundColor: background?.type === 'solid' ? background.color : undefined,
    color: typographyOverrides?.color || 'var(--text-main)',
    paddingTop: spacing?.desktop?.padding?.[0] ? `${spacing.desktop.padding[0]}px` : '5rem',
    paddingBottom: spacing?.desktop?.padding?.[2] ? `${spacing.desktop.padding[2]}px` : '5rem',
  };

  return (
    <section style={bgStyle} className="px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">{data.title}</h2>
          {data.subtitle && <p className="text-lg opacity-80 max-w-3xl mx-auto">{data.subtitle}</p>}
        </div>

        <div className="space-y-4">
          {data.items.map((item: any) => {
            const isExpanded = expandedIds.has(item.id);
            return (
              <div 
                key={item.id} 
                className="bg-white/5 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
              >
                <button 
                  onClick={() => toggle(item.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left px-6 py-5 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-inset"
                  style={{ outlineColor: 'var(--primary-color)' }}
                >
                  <span className="font-bold text-lg pr-4">{item.question}</span>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--primary-color)' }} />
                </button>
                <div 
                  className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-6 opacity-80 leading-relaxed">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
