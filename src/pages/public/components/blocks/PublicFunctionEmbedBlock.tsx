import React, { useState, useEffect } from 'react';
import { SiteBlock } from '../../../../types/siteBuilder';
import { CustomBusinessFunction } from '../../../../types/engine';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import DynamicFormRunner from '../../../../components/engine/DynamicFormRunner';
import { Loader2 } from 'lucide-react';

interface Props {
  block: SiteBlock;
  tenantId: string;
}

export default function PublicFunctionEmbedBlock({ block, tenantId }: Props) {
  if (block.type !== 'FUNCTION_EMBED') return null;
  const { config: { data }, background, spacing } = block as any;
  const [funcData, setFuncData] = useState<CustomBusinessFunction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFunc = async () => {
      if (!data.embeddedFunctionId) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'custom_business_functions', data.embeddedFunctionId));
        if (snap.exists()) {
          setFuncData(snap.data() as CustomBusinessFunction);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchFunc();
  }, [data.embeddedFunctionId]);

  if (loading) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary-color)' }} /></div>;
  }

  if (!funcData) {
    return <div className="py-20 text-center text-slate-500">Функция недоступна</div>;
  }

  const bgStyle: React.CSSProperties = {
    backgroundColor: background?.type === 'solid' ? background.color : undefined,
    paddingTop: spacing?.desktop?.padding?.[0] ? `${spacing.desktop.padding[0]}px` : '5rem',
    paddingBottom: spacing?.desktop?.padding?.[2] ? `${spacing.desktop.padding[2]}px` : '5rem',
  };

  const widgetClass = data.widgetTheme === 'full-bleed' 
    ? 'w-full' 
    : data.widgetTheme === 'inline' 
      ? 'max-w-4xl mx-auto' 
      : 'max-w-4xl mx-auto bg-white dark:bg-slate-900 shadow-2xl rounded-3xl p-6 md:p-10 border border-slate-200 dark:border-slate-800';

  return (
    <section style={bgStyle} className="px-6 relative">
      <div className="max-w-6xl mx-auto">
        {!data.hideSystemHeaders && (
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold mb-4">{data.title || funcData.name}</h2>
            <p className="text-lg opacity-80">{data.subtitle || funcData.description}</p>
          </div>
        )}
        <div className={widgetClass}>
          <DynamicFormRunner functionConfig={funcData} tenantId={tenantId} />
        </div>
      </div>
    </section>
  );
}
