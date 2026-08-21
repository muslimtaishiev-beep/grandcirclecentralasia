export interface UtmParameters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  capturedAt?: string;
}

const UTM_KEY = 'utm_params_v1';

export function captureUtmParameters(): UtmParameters {
  if (typeof window === 'undefined') return {};

  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source');
  const utmMedium = urlParams.get('utm_medium');
  const utmCampaign = urlParams.get('utm_campaign');
  const utmContent = urlParams.get('utm_content');
  const utmTerm = urlParams.get('utm_term');

  if (utmSource || utmMedium || utmCampaign) {
    const params: UtmParameters = {
      ...(utmSource && { utm_source: utmSource }),
      ...(utmMedium && { utm_medium: utmMedium }),
      ...(utmCampaign && { utm_campaign: utmCampaign }),
      ...(utmContent && { utm_content: utmContent }),
      ...(utmTerm && { utm_term: utmTerm }),
      capturedAt: new Date().toISOString()
    };

    try {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(params));
    } catch (e) {
      console.warn('Unable to store UTM parameters:', e);
    }
    return params;
  }

  // Return existing parameters if available
  try {
    const existing = sessionStorage.getItem(UTM_KEY);
    return existing ? JSON.parse(existing) : {};
  } catch (e) {
    return {};
  }
}
