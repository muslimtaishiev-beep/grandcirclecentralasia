import React from 'react';
import { SiteBlock } from '../../../../types/siteBuilder';
import { Star } from 'lucide-react';

interface Props {
  block: SiteBlock;
}

export default function PublicTestimonialsBlock({ block }: Props) {
  if (block.type !== 'TESTIMONIALS') return null;
  const { config: { data }, background, spacing, typographyOverrides } = block as any;

  const bgStyle: React.CSSProperties = {
    backgroundColor: background?.type === 'solid' ? background.color : undefined,
    color: typographyOverrides?.color || 'var(--text-main)',
    paddingTop: spacing?.desktop?.padding?.[0] ? `${spacing.desktop.padding[0]}px` : '5rem',
    paddingBottom: spacing?.desktop?.padding?.[2] ? `${spacing.desktop.padding[2]}px` : '5rem',
  };

  return (
    <section style={bgStyle} className="px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">{data.title}</h2>
          {data.subtitle && <p className="text-lg opacity-80 max-w-3xl mx-auto">{data.subtitle}</p>}
        </div>

        {/* Fallback to simple grid instead of complex carousel for now */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 hide-scrollbar">
          {data.items.map((item: any) => (
            <div 
              key={item.id} 
              className="snap-center shrink-0 w-80 md:w-96 bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col"
            >
              <div className="flex gap-1 mb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-5 h-5 ${i < item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 dark:text-slate-700'}`} 
                  />
                ))}
              </div>
              <p className="text-lg italic opacity-90 mb-8 flex-1">"{item.content}"</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-lg overflow-hidden shrink-0">
                  {item.avatarUrl ? <img src={item.avatarUrl} alt={item.authorName} className="w-full h-full object-cover" /> : item.authorName[0]}
                </div>
                <div>
                  <h4 className="font-bold">{item.authorName}</h4>
                  {item.authorRole && <p className="text-sm opacity-60">{item.authorRole}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </section>
  );
}
