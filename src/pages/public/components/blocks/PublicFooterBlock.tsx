import React from 'react';
import { SiteBlock } from '../../../../types/siteBuilder';

interface Props {
  block: SiteBlock;
}

export default function PublicFooterBlock({ block }: Props) {
  if (block.type !== 'FOOTER') return null;
  const { config: { data }, background, spacing, typographyOverrides } = block as any;

  const bgStyle: React.CSSProperties = {
    backgroundColor: background?.type === 'solid' ? background.color : undefined,
    color: typographyOverrides?.color || 'var(--text-main)',
    paddingTop: spacing?.desktop?.padding?.[0] ? `${spacing.desktop.padding[0]}px` : '4rem',
    paddingBottom: spacing?.desktop?.padding?.[2] ? `${spacing.desktop.padding[2]}px` : '2rem',
  };

  return (
    <footer style={bgStyle} className="px-6 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-12">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--primary-color)' }}>{data.companyName}</h2>
            {data.description && <p className="opacity-70 max-w-sm">{data.description}</p>}
          </div>
          
          <div className="flex gap-12 flex-wrap justify-center md:justify-end">
            {data.columns.map((col: any) => (
              <div key={col.id} className="min-w-[120px]">
                <h3 className="font-bold mb-4 uppercase text-xs tracking-wider opacity-60">{col.title}</h3>
                <ul className="space-y-3">
                  {col.links.map((link: any, idx: number) => (
                    <li key={idx}>
                      <a href={link.url} className="opacity-80 hover:opacity-100 hover:text-[var(--primary-color)] transition-colors">
                        {link.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        
        <div className="pt-8 border-t border-slate-200/20 dark:border-slate-800/20 flex flex-col md:flex-row items-center justify-between gap-4 text-sm opacity-50">
          <p>{data.copyright}</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-[var(--primary-color)]">Privacy Policy</a>
            <a href="#" className="hover:text-[var(--primary-color)]">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
