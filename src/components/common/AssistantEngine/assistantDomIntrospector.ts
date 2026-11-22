export interface InteractiveDomElement {
  agentId: string;
  tag: 'button' | 'link' | 'tab' | 'input' | 'textarea' | 'checkbox' | 'select';
  label: string;
  contextHint?: string;
  placeholder?: string;
  currentValue?: string;
  checked?: boolean;
  inModal?: boolean;
  isDisabled?: boolean;
}

const DESTRUCTIVE_KEYWORDS = [
  'מחק', 'מחיקה', 'הסר', 'הסרה', 'חסום', 'חסימה', 'שלם', 'תשלום', 'בטל מנוי',
  'delete', 'remove', 'block', 'revoke', 'pay', 'destroy', 'clear all'
];

/**
 * Generic safety guard: returns true if a button label looks destructive/irreversible
 * and must NEVER be auto-clicked without explicit human confirmation.
 */
export function isDestructiveUiLabel(label: string): boolean {
  const low = (label || '').toLowerCase();
  return DESTRUCTIVE_KEYWORDS.some((kw) => low.includes(kw));
}

export interface LiveDomBatchStep {
  agentId: string;
  op: 'click' | 'fill';
  value?: string;
}

export interface LiveScreenDomInspection {
  urlPath: string;
  pageTitle: string;
  visibleHeadings: string[];
  visibleButtonsAndActions: string[];
  interactiveElements: InteractiveDomElement[];
  openModalsOrBanners: string[];
}

/**
 * Live DOM & UI Introspector + Action Discovery Engine (Layer 2 — Zero-Config Generic).
 * Scans the host application's currently rendered screen in real time (<3ms),
 * assigns live `data-agent-action-id` handles to visible interactive elements
 * (buttons, tabs, links, search inputs), and enables the AI assistant to both
 * understand ANY screen accurately AND click/fill newly added UI controls
 * automatically without hardcoding selectors—even when embedded in a brand-new app.
 *
 * Security: Strictly ignores password fields, hidden inputs, scripts, and the assistant drawer itself.
 */
export function inspectLiveScreenDOM(): LiveScreenDomInspection {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      urlPath: '/',
      pageTitle: '',
      visibleHeadings: [],
      visibleButtonsAndActions: [],
      interactiveElements: [],
      openModalsOrBanners: []
    };
  }

  const isInsideIgnoredZone = (el: Element): boolean => {
    return Boolean(
      el.closest('[data-assistant-drawer="true"]') ||
      el.closest('[data-assistant-ignore="true"]') ||
      el.closest('[data-bug-recorder-hud="true"]') ||
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
    return raw.replace(/\s+/g, ' ').trim().slice(0, 75);
  };

  // Clear previous live handles so stale IDs from closed modals never linger
  document.querySelectorAll('[data-agent-action-id]').forEach((el) => {
    el.removeAttribute('data-agent-action-id');
  });

  // 1. Visible Headings (h1, h2, h3)
  const headingSet = new Set<string>();
  document.querySelectorAll('h1, h2, h3').forEach((el) => {
    if (!isElementVisible(el)) return;
    const txt = cleanLabel(el.textContent);
    if (txt && txt.length >= 2) headingSet.add(txt);
  });

  // 2. Visible Buttons, Tabs, Links & Safe Form Inputs (modal elements prioritized first!)
  const actionSet = new Set<string>();
  const modalElements: InteractiveDomElement[] = [];
  const pageElements: InteractiveDomElement[] = [];
  let counter = 1;

  const selector =
    'button, [role="button"], [role="tab"], a[href], input[type="text"], input[type="search"], input[type="tel"], input[type="checkbox"], textarea, select';

  const isInsideOpenModal = (el: Element): boolean => {
    if (el.closest('[role="dialog"], [aria-modal="true"]')) return true;
    // Also detect generic React/CSS fixed full-screen modal overlays (zero host-app code needed!)
    let cur: HTMLElement | null = el.parentElement;
    let depth = 0;
    while (cur && cur !== document.body && depth < 12) {
      const style = window.getComputedStyle(cur);
      const z = parseInt(style.zIndex || '0', 10) || 0;
      if (style.position === 'fixed' && z >= 50) {
        const r = cur.getBoundingClientRect();
        if (r.width >= window.innerWidth * 0.7 && r.height >= window.innerHeight * 0.5) {
          return true;
        }
      }
      cur = cur.parentElement;
      depth++;
    }
    return false;
  };

  // Purely read-only outside observation: identifies which card/row a repeated button belongs to
  // (e.g., distinguishes "וואטסאפ" of "אלי אינסטלטור שחף" from another contact's "וואטסאפ" in ANY app!)
  const extractParentContextHint = (el: Element, ownLabel: string): string | undefined => {
    let cur: HTMLElement | null = el.parentElement;
    let depth = 0;
    while (cur && cur !== document.body && depth < 5) {
      const r = cur.getBoundingClientRect();
      if (r.height >= 48 && r.height <= 360 && r.width >= 160 && r.width <= window.innerWidth * 0.96) {
        const headingEl = cur.querySelector('h1, h2, h3, h4, strong, b, [class*="name"], [class*="title"]');
        const rawCandidate = headingEl
          ? cleanLabel(headingEl.textContent)
          : cleanLabel(
              Array.from(cur.childNodes)
                .filter((n) => n.nodeType === 3)
                .map((n) => n.textContent || '')
                .join(' ')
            );
        if (rawCandidate && rawCandidate.length >= 2 && rawCandidate !== ownLabel && !ownLabel.includes(rawCandidate)) {
          return rawCandidate.slice(0, 48);
        }
        // Fallback: first short text leaf inside this card container (such as contact name + phone)
        const firstTextLeaf = Array.from(cur.querySelectorAll('div, span, p')).find((node) => {
          if (node.closest('button, a, input, select')) return false;
          if (node.children.length > 1) return false;
          const t = cleanLabel(node.textContent);
          return t.length >= 3 && t.length <= 45 && t !== ownLabel;
        });
        if (firstTextLeaf) {
          const hint = cleanLabel(firstTextLeaf.textContent);
          if (hint && hint !== ownLabel) return hint.slice(0, 48);
        }
      }
      cur = cur.parentElement;
      depth++;
    }
    return undefined;
  };

  document.querySelectorAll(selector).forEach((el) => {
    if (modalElements.length + pageElements.length >= 55) return;
    if (!isElementVisible(el)) return;

    const htmlEl = el as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const inModal = isInsideOpenModal(el);
    const targetBucket = inModal ? modalElements : pageElements;

    if (tagName === 'input') {
      const inp = el as HTMLInputElement;
      const type = (inp.type || 'text').toLowerCase();
      if (type === 'checkbox') {
        const labelEl = inp.closest('label');
        const label = cleanLabel(labelEl?.textContent || inp.getAttribute('aria-label') || inp.title);
        if (!label) return;
        const agentId = `ui_${counter++}`;
        el.setAttribute('data-agent-action-id', agentId);
        targetBucket.push({
          agentId,
          tag: 'checkbox',
          label,
          checked: inp.checked,
          inModal: inModal || undefined
        });
        return;
      }
      if (type !== 'text' && type !== 'search' && type !== 'tel') return;
      const placeholder = cleanLabel(inp.placeholder || inp.getAttribute('aria-label') || inp.name);
      if (!placeholder) return;
      const agentId = `ui_${counter++}`;
      el.setAttribute('data-agent-action-id', agentId);
      targetBucket.push({
        agentId,
        tag: 'input',
        label: placeholder,
        placeholder,
        currentValue: inp.value ? inp.value.slice(0, 40) : undefined,
        inModal: inModal || undefined
      });
      return;
    }

    if (tagName === 'textarea') {
      const ta = el as HTMLTextAreaElement;
      const placeholder = cleanLabel(ta.placeholder || ta.getAttribute('aria-label'));
      if (!placeholder) return;
      const agentId = `ui_${counter++}`;
      el.setAttribute('data-agent-action-id', agentId);
      targetBucket.push({
        agentId,
        tag: 'textarea',
        label: placeholder,
        placeholder,
        currentValue: ta.value ? ta.value.slice(0, 40) : undefined,
        inModal: inModal || undefined
      });
      return;
    }

    if (tagName === 'select') {
      const sel = el as HTMLSelectElement;
      const label = cleanLabel(sel.getAttribute('aria-label') || sel.getAttribute('title') || sel.options[sel.selectedIndex]?.text);
      if (!label) return;
      const agentId = `ui_${counter++}`;
      el.setAttribute('data-agent-action-id', agentId);
      targetBucket.push({
        agentId,
        tag: 'select',
        label,
        currentValue: cleanLabel(sel.options[sel.selectedIndex]?.text),
        inModal: inModal || undefined
      });
      return;
    }

    const text = cleanLabel(htmlEl.innerText || htmlEl.textContent);
    const title = cleanLabel(htmlEl.getAttribute('title') || htmlEl.getAttribute('aria-label'));
    const combined = text && title && text !== title ? `${text} (${title})` : text || title;
    if (!combined || combined.length < 2) return;

    const agentId = `ui_${counter++}`;
    el.setAttribute('data-agent-action-id', agentId);

    const role = el.getAttribute('role');
    const tag: InteractiveDomElement['tag'] =
      role === 'tab' ? 'tab' : tagName === 'a' ? 'link' : 'button';

    const contextHint = extractParentContextHint(el, combined);
    actionSet.add(combined);
    targetBucket.push({
      agentId,
      tag,
      label: combined,
      contextHint: contextHint || undefined,
      inModal: inModal || undefined,
      isDisabled: (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true'
    });
  });

  // Prioritize modal elements first so the agent focuses immediately on any open dialog form
  const interactiveElements = [...modalElements, ...pageElements].slice(0, 45);

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
    interactiveElements,
    openModalsOrBanners: Array.from(modalSet).slice(0, 10)
  };
}

/**
 * Executes a live UI action on a discovered DOM element with visual highlight feedback
 * so the user physically sees what the agent clicked or filled on screen.
 */
export function executeLiveDomElementAction(
  agentId: string,
  operation: 'click' | 'fill',
  value?: string
): { success: boolean; message: string } {
  if (typeof document === 'undefined') {
    return { success: false, message: 'סביבת דפדפן אינה זמינה.' };
  }

  const el = document.querySelector(`[data-agent-action-id="${CSS.escape(agentId)}"]`) as HTMLElement | null;
  if (!el) {
    return { success: false, message: 'הכפתור או השדה כבר אינם מופיעים על המסך הנוכחי.' };
  }

  // Visual highlight pulse so user physically sees the action on screen
  const prevOutline = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.outline = '3px solid #4f46e5';
  el.style.outlineOffset = '2px';
  setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOffset;
  }, 1600);

  if (operation === 'fill') {
    const tag = el.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') {
      return { success: false, message: 'האלמנט שנבחר אינו שדה הקלדה.' };
    }
    const inp = el as HTMLInputElement | HTMLTextAreaElement;
    // Use native value setter so React controlled inputs update cleanly
    const proto = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(inp, value ?? '');
    } else {
      inp.value = value ?? '';
    }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.focus();
    return { success: true, message: `הוזן "${value ?? ''}" בשדה "${inp.placeholder || 'טופס'}" על המסך.` };
  }

  // Click operation
  el.click();
  const label = (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || 'הכפתור').trim().slice(0, 50);
  return { success: true, message: `הופעל הכפתור "${label}" על המסך.` };
}

/**
 * Executes a multi-step batch of UI actions in a single AI turn (fill fields + click buttons)
 * with a short 140ms React-settlement pause between steps so state updates cleanly.
 */
export async function executeLiveDomBatch(
  steps: LiveDomBatchStep[]
): Promise<{ success: boolean; message: string; completedSteps: number }> {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { success: false, message: 'לא התקבלו צעדים לביצוע.', completedSteps: 0 };
  }

  const capped = steps.slice(0, 3);
  const logs: string[] = [];
  let completed = 0;

  for (const step of capped) {
    const res = executeLiveDomElementAction(String(step.agentId || ''), step.op === 'fill' ? 'fill' : 'click', step.value);
    if (!res.success) {
      return {
        success: completed > 0,
        message: completed > 0
          ? `בוצעו ${completed} צעדים, אך הצעד הבא נעצר: ${res.message}`
          : res.message,
        completedSteps: completed
      };
    }
    completed++;
    logs.push(res.message);
    await new Promise((r) => setTimeout(r, 140));
  }

  return {
    success: true,
    message: `בוצעו ${completed} פעולות ברצף בהצלחה על המסך (${logs[logs.length - 1] || ''}).`,
    completedSteps: completed
  };
}
