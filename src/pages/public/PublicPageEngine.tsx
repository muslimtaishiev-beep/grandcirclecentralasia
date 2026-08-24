import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { TenantLandingPage } from '../../types/siteBuilder';
import { resolveTenantPage, getCurrentTenantContext } from './SubdomainResolver';
import PublicThemeInjector from './components/PublicThemeInjector';
import SeoHeader from './components/SeoHeader';
import PublicBlockDispatcher from './components/PublicBlockDispatcher';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function PublicPageEngine() {
  const { subdomain, slug } = useParams();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState<TenantLandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const tenantContext = getCurrentTenantContext(subdomain || searchParams.get('tenantId') || undefined);

  useEffect(() => {
    const fetchPage = async () => {
      if (!tenantContext) {
        setError('Контекст организации не найден. Проверьте адресную строку.');
        setLoading(false);
        return;
      }

      // If no slug is provided, fallback to "home"
      const targetSlug = slug || 'home';
      
      const pageData = await resolveTenantPage(tenantContext, targetSlug);
      
      if (pageData) {
        setPage(pageData);
      } else {
        setError('Страница не найдена или еще не опубликована (404)');
      }
      setLoading(false);
    };

    fetchPage();
  }, [tenantContext, slug]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white dark:bg-slate-900 px-6 text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-6" />
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Ой!</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
        <a href="/" className="mt-8 px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition">
          Вернуться на главную
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white dark:bg-[#0B1120] text-slate-900 dark:text-slate-50 overflow-x-hidden">
      <PublicThemeInjector theme={page.theme} />
      <SeoHeader seo={page.seo} url={window.location.href} />
      
      <main>
        <PublicBlockDispatcher blocks={page.blocks} tenantId={tenantContext!} />
      </main>
    </div>
  );
}
