import React, { useEffect } from 'react';
import { TenantLandingPage } from '../../../types/siteBuilder';

interface Props {
  seo: TenantLandingPage['seo'];
  url: string;
}

export default function SeoHeader({ seo, url }: Props) {
  useEffect(() => {
    document.title = seo.metaTitle || 'Главная';

    const updateMeta = (name: string, content: string, isProperty = false) => {
      if (!content) return;
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    updateMeta('description', seo.metaDescription || '');
    updateMeta('og:title', seo.metaTitle || '', true);
    updateMeta('og:description', seo.metaDescription || '', true);
    updateMeta('og:url', url, true);
    updateMeta('og:type', 'website', true);
    
    if (seo.ogImageUrl) {
      updateMeta('og:image', seo.ogImageUrl, true);
    }

    // JSON-LD schema
    const jsonLdScriptId = 'schema-org-json-ld';
    let script = document.getElementById(jsonLdScriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = jsonLdScriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": seo.metaTitle,
      "description": seo.metaDescription,
      "url": url,
    };
    script.textContent = JSON.stringify(schema);
    
  }, [seo, url]);

  return null;
}
