export interface LiveScreenDomInspection {
  urlPath: string;
  pageTitle: string;
  visibleHeadings: string[];
  visibleButtonsAndActions: string[];
  openModalsOrBanners: string[];
}

/**
 * Live DOM & UI Introspector for Pluggable AI Assistant.
 * Scans the host application's currently rendered screen in real time (<2ms)
 * so the assistant automatically discovers new buttons, tabs, headings, and modals
 * in any page or external app where it is embedded—while strictly ignoring password
 * fields, scripts, and the assistant drawer itself.
 */
export function inspectLiveScreenDOM(): LiveScreenDomInspection {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      urlPath: '/',
      pageTitle: '',
      visibleHeadings: [],
      visibleButtonsAndActions: [],
      openModalsOrBanners: []
    };
  }

  const isInsideIgnoredZone = (el: Element): boolean => {
    return Boolean(
      el.closest('[data-assistant-drawer="true"]') ||
      el.closest('[data-assistant-ignore="true"]') ||
      el.closest('script, style, noscript')
    );
  };

  const isElementVisible = (el: Element): boolean => {
    if (isInsideIgnoredZone(el)) return false;
    const htmlEl = el as HTMLElement;
    if (htmlEl.hidden) return false;
    const style = window.getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = htmlEl.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const cleanLabel = (raw: string | null | undefined): string => {
    if (!raw) return '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, 70);
  };

  // 1. Visible Headings (h1, h2, h3)
  const headingSet = new Set<string>();
  document.querySelectorAll('h1, h2, h3').forEach((el) => {
    if (!isElementVisible(el)) return;
    const txt = cleanLabel(el.textContent);
    if (txt && txt.length >= 2) headingSet.add(txt);
  });

  // 2. Visible Buttons, Tabs, and Action Links
  const actionSet = new Set<string>();
  document.querySelectorAll('button, [role="button"], [role="tab"], a[href]').forEach((el) => {
    if (actionSet.size >= 40) return;
    if (!isElementVisible(el)) return;
    const htmlEl = el as HTMLElement;
    const text = cleanLabel(htmlEl.innerText || htmlEl.textContent);
    const title = cleanLabel(htmlEl.getAttribute('title') || htmlEl.getAttribute('aria-label'));
    const combined = text && title && text !== title ? `${text} (${title})` : text || title;
    if (combined && combined.length >= 2) {
      actionSet.add(combined);
    }
  });

  // 3. Open Modals or Dialogs
  const modalSet = new Set<string>();
  document.querySelectorAll('[role="dialog"], [aria-modal="true"]').forEach((el) => {
    if (!isElementVisible(el)) return;
    const heading = el.querySelector('h1, h2, h3, h4, strong');
    const txt = cleanLabel(heading?.textContent || el.getAttribute('aria-label'));
    if (txt) modalSet.add(txt);
  });

  return {
    urlPath: window.location.pathname + window.location.search,
    pageTitle: cleanLabel(document.title),
    visibleHeadings: Array.from(headingSet).slice(0, 15),
    visibleButtonsAndActions: Array.from(actionSet).slice(0, 35),
    openModalsOrBanners: Array.from(modalSet).slice(0, 10)
  };
}
