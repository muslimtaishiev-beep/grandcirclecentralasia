import React, { useState } from 'react';
import { SiteBlock } from '../../../../types/siteBuilder';
import { CheckCircle2, MinusCircle } from 'lucide-react';

interface Props {
  block: SiteBlock;
}

export default function PublicPricingBlock({ block }: Props) {
  if (block.type !== 'PRICING_TABLE') return null;
  const { config: { data }, background, spacing, typographyOverrides } = block as any;

  const bgStyle: React.CSSProperties = {
    backgroundColor: background?.type === 'solid' ? background.color : undefined,
    color: typographyOverrides?.color || 'var(--text-main)',
    paddingTop: spacing?.desktop?.padding?.[0] ? `${spacing.desktop.padding[0]}px` : '5rem',
    paddingBottom: spacing?.desktop?.padding?.[2] ? `${spacing.desktop.padding[2]}px` : '5rem',
  };

  return (
    <section style={bgStyle} className="px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">{data.title}</h2>
          {data.subtitle && <p className="text-lg opacity-80 max-w-3xl mx-auto">{data.subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center">
          {data.tiers.map((tier: any) => (
            <div 
              key={tier.id} 
              className={`relative bg-white dark:bg-slate-900 rounded-3xl p-8 flex flex-col ${
                tier.isPopular ? 'ring-4 shadow-2xl scale-105 z-10' : 'border border-slate-200 dark:border-slate-800 shadow-xl'
              }`}
              style={{ '--tw-ring-color': tier.isPopular ? 'var(--primary-color)' : undefined } as any}
            >
              {tier.isPopular && (
                <div 
                  className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wide"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  Популярный
                </div>
              )}

              <h3 className="text-2xl font-bold mb-4">{tier.name}</h3>
              <div className="flex items-end gap-2 mb-8">
                <span className="text-5xl font-extrabold">{tier.price}</span>
                {tier.period && <span className="opacity-60 mb-1">{tier.period}</span>}
              </div>

              <a 
                href={tier.cta.link || '#'}
                className="w-full text-center py-4 rounded-xl font-bold transition hover:-translate-y-0.5"
                style={
                  tier.isPopular 
                    ? { backgroundColor: 'var(--primary-color)', color: 'white' }
                    : { backgroundColor: 'color-mix(in srgb, var(--primary-color) 10%, transparent)', color: 'var(--primary-color)' }
                }
              >
                {tier.cta.text}
              </a>

              <div className="mt-8 space-y-4 flex-1">
                {tier.features.map((feat: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3">
                    {feat.isIncluded ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--primary-color)' }} />
                    ) : (
                      <MinusCircle className="w-5 h-5 opacity-30 shrink-0" />
                    )}
                    <span className={`text-sm ${feat.isIncluded ? 'opacity-90' : 'opacity-50'}`}>
                      {feat.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
