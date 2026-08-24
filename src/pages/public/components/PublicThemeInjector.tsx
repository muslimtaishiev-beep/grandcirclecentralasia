import React, { useEffect } from 'react';
import { TenantLandingPage } from '../../../types/siteBuilder';

interface Props {
  theme: TenantLandingPage['theme'];
}

export default function PublicThemeInjector({ theme }: Props) {
  useEffect(() => {
    // Inject Google Font dynamically
    if (theme.fontFamily) {
      const linkId = 'public-site-font';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        const formattedName = theme.fontFamily.replace(/ /g, '+');
        link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;500;600;700;800&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [theme.fontFamily]);

  const css = `
    :root {
      --primary-color: ${theme.primaryColor};
      --accent-color: ${theme.accentColor};
      --font-family: '${theme.fontFamily}', sans-serif;
    }
    body {
      font-family: var(--font-family);
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
