import React from 'react';
import { SiteBlock } from '../../../../types/siteBuilder';

interface Props {
  block: SiteBlock;
}

export default function PublicHeroBlock({ block }: Props) {
  if (block.type !== 'HERO') return null;
  const { config: { data }, background, typographyOverrides, spacing } = block as any;

  const bgStyle: React.CSSProperties = {
    backgroundColor: background?.type === 'solid' ? background.color : undefined,
    backgroundImage: background?.type === 'image' && background.imageUrl ? `url(${background.imageUrl})` 
                   : background?.type === 'linear-gradient' || background?.type === 'radial-gradient' ? background.gradient 
                   : undefined,
    backgroundSize: background?.imageSize || 'cover',
    backgroundPosition: background?.imagePosition || 'center',
    color: typographyOverrides?.color || 'var(--text-main)',
    paddingTop: spacing?.desktop?.padding?.[0] ? `${spacing.desktop.padding[0]}px` : '5rem',
    paddingBottom: spacing?.desktop?.padding?.[2] ? `${spacing.desktop.padding[2]}px` : '5rem',
  };

  return (
    <section style={bgStyle} className="relative w-full min-h-[70vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {background?.type === 'image' && background.overlayOpacity > 0 && (
        <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: background.overlayOpacity }} />
      )}
      
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        {data.badge && (
          <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-black/10 dark:bg-white/20 backdrop-blur-md uppercase tracking-wider">
            {data.badge}
          </span>
        )}
        
        <h1 
          className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight"
          style={{ 
            fontFamily: typographyOverrides?.fontFamily || 'var(--font-family)',
            fontWeight: typographyOverrides?.fontWeight || 800
          }}
        >
          {data.title}
        </h1>
        
        <p className="text-xl md:text-2xl opacity-90 max-w-2xl font-medium leading-relaxed">
          {data.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          {data.primaryCta && data.primaryCta.text && (
            <a 
              href={data.primaryCta.link || '#'}
              className="px-8 py-4 rounded-xl font-bold text-white shadow-xl hover:-translate-y-1 hover:shadow-2xl transition transform text-lg"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              {data.primaryCta.text}
            </a>
          )}
          {data.secondaryCta && data.secondaryCta.text && (
            <a 
              href={data.secondaryCta.link || '#'}
              className="px-8 py-4 rounded-xl font-bold text-[var(--text-main)] shadow-xl bg-white/10 border border-[var(--border-color)] backdrop-blur-md hover:bg-black/5 hover:-translate-y-1 hover:shadow-2xl transition transform text-lg"
            >
              {data.secondaryCta.text}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
