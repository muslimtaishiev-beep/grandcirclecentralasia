import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TenantLandingPage, SiteBlock, CustomBusinessFunction } from '../../types/engine';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Loader2, CheckCircle, ChevronDown, MessageCircle, Star } from 'lucide-react';
import DynamicFormRunner from '../../components/engine/DynamicFormRunner';

export default function PublicSiteRenderer() {
  const { orgId, slug = 'home' } = useParams();
  
  const [pageData, setPageData] = useState<TenantLandingPage | null>(null);
  const [embeddedFunctions, setEmbeddedFunctions] = useState<Record<string, CustomBusinessFunction>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        if (!orgId) throw new Error("Missing organization ID");
        
        const pageRef = doc(db, 'landing_pages', `${orgId}_${slug}`);
        const snap = await getDoc(pageRef);
        
        if (!snap.exists()) {
          setError("Страница не найдена");
          return;
        }

        const data = snap.data() as TenantLandingPage;
        if (!data.isPublished) {
          setError("Сайт в процессе разработки");
          return;
        }

        setPageData(data);

        // Fetch needed embedded functions
        const funcIds = data.blocks
          .filter(b => b.type === 'FUNCTION_EMBED' && b.config.embeddedFunctionId)
          .map(b => b.config.embeddedFunctionId!);

        if (funcIds.length > 0) {
          const funcs: Record<string, CustomBusinessFunction> = {};
          for (const fid of funcIds) {
            const fs = await getDoc(doc(db, 'custom_business_functions', fid));
            if (fs.exists()) {
              funcs[fid] = fs.data() as CustomBusinessFunction;
            }
          }
          setEmbeddedFunctions(funcs);
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [orgId, slug]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Ой!</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const { theme, blocks } = pageData;

  const renderBlock = (block: SiteBlock) => {
    const { config } = block;
    const style = {
      backgroundColor: config.backgroundColor || '#ffffff',
      color: config.textColor || '#111827',
      fontFamily: theme.fontFamily || 'sans-serif'
    };

    switch (block.type) {
      case 'HERO':
        return (
          <section style={style} className="py-24 px-6 md:px-12 text-center flex flex-col items-center justify-center min-h-[70vh]">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl">{config.title}</h1>
            <p className="text-xl opacity-80 mb-10 max-w-2xl">{config.subtitle}</p>
            {config.ctaText && (
              <a 
                href={config.ctaLink || '#'} 
                className="px-8 py-4 rounded-2xl font-bold text-white shadow-xl hover:-translate-y-1 transition transform"
                style={{ backgroundColor: theme.primaryColor }}
              >
                {config.ctaText}
              </a>
            )}
          </section>
        );

      case 'FEATURES_GRID':
        return (
          <section style={style} className="py-20 px-6 md:px-12">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">{config.title}</h2>
                <p className="text-lg opacity-80">{config.subtitle}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {config.items?.map(item => (
                  <div key={item.id} className="p-8 rounded-3xl bg-black/5 hover:bg-black/10 transition">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: theme.primaryColor + '20', color: theme.primaryColor }}>
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="opacity-75">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'TESTIMONIALS':
        return (
          <section style={style} className="py-20 px-6 md:px-12">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">{config.title}</h2>
                <p className="text-lg opacity-80">{config.subtitle}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {config.items?.map(item => (
                  <div key={item.id} className="p-8 rounded-3xl bg-white shadow-xl shadow-black/5 relative">
                    <MessageCircle className="absolute top-6 right-6 w-8 h-8 opacity-10" style={{ color: theme.primaryColor }} />
                    <div className="flex gap-1 mb-4">
                      {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                    </div>
                    <p className="opacity-90 italic mb-6">"{item.description}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                        {item.avatarUrl && <img src={item.avatarUrl} alt={item.title} className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{item.title}</div>
                        <div className="text-xs opacity-60">{item.authorRole}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'FUNCTION_EMBED':
        const funcConfig = config.embeddedFunctionId ? embeddedFunctions[config.embeddedFunctionId] : null;
        return (
          <section style={style} className="py-20 px-6 md:px-12">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-4xl font-bold mb-4">{config.title}</h2>
                <p className="text-lg opacity-80">{config.subtitle}</p>
              </div>
              {funcConfig ? (
                <div className="shadow-2xl rounded-3xl overflow-hidden p-1 bg-gradient-to-br from-slate-200 to-slate-100">
                  <DynamicFormRunner 
                    functionConfig={funcConfig}
                    tenantId={orgId!}
                  />
                </div>
              ) : (
                <div className="text-center p-8 bg-black/5 rounded-2xl">Форма недоступна</div>
              )}
            </div>
          </section>
        );

      case 'FOOTER':
        return (
          <footer style={style} className="py-12 px-6 md:px-12 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">{config.title}</h2>
              <p className="opacity-70 mb-8">{config.subtitle}</p>
              <div className="opacity-50 text-sm">
                &copy; {new Date().getFullYear()} Все права защищены. Работает на базе ОС для бизнеса.
              </div>
            </div>
          </footer>
        );

      default:
        return (
          <section style={style} className="py-12 px-6 text-center">
            <h2 className="text-3xl font-bold">{config.title}</h2>
          </section>
        );
    }
  };

  // Setup basic global CSS for the loaded theme
  useEffect(() => {
    document.title = pageData?.seo.metaTitle || 'Сайт';
    // Let's force light mode for public sites for now unless they want a dark background
    document.documentElement.classList.remove('dark');
  }, [pageData]);

  return (
    <div className="w-full min-h-dvh bg-slate-50">
      {blocks.sort((a, b) => a.order - b.order).map(block => (
        <React.Fragment key={block.id}>
          {renderBlock(block)}
        </React.Fragment>
      ))}
    </div>
  );
}
