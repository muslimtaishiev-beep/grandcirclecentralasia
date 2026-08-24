import React from 'react';
import { SiteBlock } from '../../../../types/siteBuilder';
import * as LucideIcons from 'lucide-react';

interface Props {
  block: SiteBlock;
}

export default function PublicFeaturesBlock({ block }: Props) {
  if (block.type !== 'FEATURES_GRID') return null;
  const { config: { data }, background, spacing, typographyOverrides } = block as any;

  const bgStyle: React.CSSProperties = {
    backgroundColor: background?.type === 'solid' ? background.color : undefined,
    color: typographyOverrides?.color || 'var(--text-main)',
    paddingTop: spacing?.desktop?.padding?.[0] ? `${spacing.desktop.padding[0]}px` : '5rem',
    paddingBottom: spacing?.desktop?.padding?.[2] ? `${spacing.desktop.padding[2]}px` : '5rem',
  };

  const gridColsClass = 
    data.columns === 1 ? 'grid-cols-1' :
    data.columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
    data.columns === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
    'grid-cols-1 md:grid-cols-3';

  return (
    <section style={bgStyle} className="px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">{data.title}</h2>
          {data.subtitle && <p className="text-lg opacity-80 max-w-3xl mx-auto">{data.subtitle}</p>}
        </div>
        
        <div className={`grid ${gridColsClass} gap-8`}>
          {data.items.map((item: any) => {
            const IconComponent = (LucideIcons as any)[item.icon || 'CheckCircle'] || LucideIcons.CheckCircle;
            return (
              <div key={item.id} className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" 
                  style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 20%, transparent)', color: 'var(--primary-color)' }}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="opacity-75 leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
