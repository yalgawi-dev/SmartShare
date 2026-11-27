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

export interface VisibleAgentEntity {
  id: string;
  type: string;
  title: string;
  parentId?: string;
}

export interface ActiveViewportScope {
  containerId?: string;
  containerType?: string;
  label?: string;
  breadcrumb?: string;
}

export interface LiveScreenDomInspection {
  urlPath: string;
  pageTitle: string;
  visibleHeadings: string[];
  visibleButtonsAndActions: string[];
  interactiveElements: InteractiveDomElement[];
  openModalsOrBanners: string[];
  /** Universal readable text snapshot of the currently visible viewport / active modal (100% app-agnostic, zero-config!) */
  visibleScreenText?: string;
  /** Layer 2.5 Universal Viewport Grounding (Active container + entities currently visible on screen) */
  activeScope?: ActiveViewportScope | null;
  visibleEntities?: VisibleAgentEntity[];
}

export type LiveScreenSnapshot = LiveScreenDomInspection;

/**
 * Live DOM & UI Introspector + Action Discovery Engine (Layer 2 + Layer 2.5 — Zero-Config Generic).
 * Scans the host application's currently rendered screen in real time (<3ms),
 * assigns live `data-agent-action-id` handles to visible interactive elements
 * (buttons, tabs, links, search inputs), and discovers `data-agent-scope-*` / `data-agent-entity-*`
 * so the AI knows EXACTLY what container and items the user is currently looking at.
 *
 * Security: Strictly ignores password fields, hidden inputs, scripts, and the assistant drawer itself.
 */
export function inspectLiveScreenDOM(options?: { assignIds?: boolean }): LiveScreenDomInspection {
  const assignIds = options?.assignIds !== false;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      urlPath: '/',
      pageTitle: '',
      visibleHeadings: [],
      visibleButtonsAndActions: [],
      interactiveElements: [],
      openModalsOrBanners: [],
      activeScope: null,
      visibleEntities: []
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

  // Clear previous live handles ONLY when actively assigning IDs for the agent loop
  // (passive observers pass assignIds: false so they NEVER wipe live handles mid-turn!)
  if (assignIds) {
    document.querySelectorAll('[data-agent-action-id]').forEach((el) => {
      el.removeAttribute('data-agent-action-id');
    });
  }

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
    'button, [role="button"], [role="tab"], a[href], input[type="text"], input[type="search"], input[type="tel"], input[type="email"], input[type="number"], input[type="date"], input[type="time"], input[type="checkbox"], textarea, select';

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
    if (!isElementVisible(el)) return;

    const htmlEl = el as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const inModal = isInsideOpenModal(el);
    // Cap modal & background page SEPARATELY so portal modals at the end of document.body are NEVER cut off by background page buttons!
    if (inModal && modalElements.length >= 45) return;
    if (!inModal && pageElements.length >= 45) return;
    const targetBucket = inModal ? modalElements : pageElements;

    if (tagName === 'input') {
      const inp = el as HTMLInputElement;
      const type = (inp.type || 'text').toLowerCase();
      if (type === 'checkbox') {
        const labelEl = inp.closest('label');
        const label = cleanLabel(labelEl?.textContent || inp.getAttribute('aria-label') || inp.title);
        if (!label) return;
        const agentId = `ui_${counter++}`;
        if (assignIds) el.setAttribute('data-agent-action-id', agentId);
        targetBucket.push({
          agentId,
          tag: 'checkbox',
          label,
          checked: inp.checked,
          inModal: inModal || undefined
        });
        return;
      }
      if (!['text', 'search', 'tel', 'email', 'number', 'date', 'time'].includes(type)) return;
      const assocLabel =
        (inp.id ? document.querySelector(`label[for="${CSS.escape(inp.id)}"]`)?.textContent : '') ||
        inp.closest('label')?.textContent ||
        '';
      const fallbackTypeLabel =
        type === 'time'
          ? 'שעה (time)'
          : type === 'date'
            ? 'תאריך (date)'
            : type === 'number'
              ? 'מספר'
              : type === 'email'
                ? 'אימייל'
                : type === 'tel'
                  ? 'טלפון'
                  : '';
      const placeholder = cleanLabel(
        inp.placeholder || inp.getAttribute('aria-label') || inp.title || assocLabel || inp.name || fallbackTypeLabel
      );
      if (!placeholder) return;
      const agentId = `ui_${counter++}`;
      if (assignIds) el.setAttribute('data-agent-action-id', agentId);
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
      const assocLabel =
        (ta.id ? document.querySelector(`label[for="${CSS.escape(ta.id)}"]`)?.textContent : '') ||
        ta.closest('label')?.textContent ||
        '';
      const placeholder = cleanLabel(
        ta.placeholder || ta.getAttribute('aria-label') || ta.title || assocLabel || ta.name || 'שדה טקסט'
      );
      if (!placeholder) return;
      const agentId = `ui_${counter++}`;
      if (assignIds) el.setAttribute('data-agent-action-id', agentId);
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
      if (assignIds) el.setAttribute('data-agent-action-id', agentId);
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
    let combined = text && title && text !== title ? `${text} (${title})` : text || title;

    // 100% Universal Modal Close Button detection (single-char ×/✕/X or icon-only close button inside any modal!)
    if (inModal && (!combined || combined.length < 2)) {
      const rawTxt = (htmlEl.innerText || htmlEl.textContent || '').trim();
      const isCloseGlyph = ['×', '✕', '✖', 'x', 'X'].includes(rawTxt);
      const isSvgCloseBtn = !rawTxt && Boolean(htmlEl.querySelector('svg')) && htmlEl.getBoundingClientRect().width <= 52;
      if (isCloseGlyph || isSvgCloseBtn) {
        combined = 'סגור חלון (×)';
      }
    }
    if (!combined || combined.length < 2) return;

    const agentId = `ui_${counter++}`;
    if (assignIds) el.setAttribute('data-agent-action-id', agentId);

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

  // 3. Open Modals or Dialogs (ARIA dialogs + universal CSS-fixed full-screen modal overlays!)
  const modalSet = new Set<string>();
  document.querySelectorAll('[role="dialog"], [aria-modal="true"]').forEach((el) => {
    if (!isElementVisible(el)) return;
    const heading = el.querySelector('h1, h2, h3, h4, strong');
    const txt = cleanLabel(heading?.textContent || el.getAttribute('aria-label'));
    if (txt) modalSet.add(txt);
  });
  if (modalElements.length > 0 && modalSet.size === 0) {
    // Detect CSS-fixed modal overlays without explicit ARIA dialog attributes (works on ANY React/Vue/HTML app!)
    const allFixed = Array.from(document.querySelectorAll('div, section, aside'));
    for (let i = allFixed.length - 1; i >= 0; i--) {
      const el = allFixed[i];
      if (!isElementVisible(el)) continue;
      const style = window.getComputedStyle(el);
      const z = parseInt(style.zIndex || '0', 10) || 0;
      if (style.position === 'fixed' && z >= 50) {
        const r = el.getBoundingClientRect();
        if (r.width >= window.innerWidth * 0.7 && r.height >= window.innerHeight * 0.5) {
          const heading = el.querySelector('h1, h2, h3, h4, strong');
          const txt = cleanLabel(heading?.textContent) || 'חלון קופץ פתוח';
          modalSet.add(txt);
          break;
        }
      }
    }
  }

  // 4. Layer 2.5 — Zero-Tag Autonomous Viewport Scope & Entity Discovery (App-Agnostic)
  // Priority 1: Explicit semantic attributes if present; Priority 2: 100% Automatic heuristic discovery on ANY app!
  let activeScope: ActiveViewportScope | null = null;
  const scopeEls = Array.from(document.querySelectorAll('[data-agent-scope-label], [data-agent-scope-id]'));
  for (let i = scopeEls.length - 1; i >= 0; i--) {
    const el = scopeEls[i];
    if (!isElementVisible(el)) continue;
    activeScope = {
      containerId: el.getAttribute('data-agent-scope-id') || undefined,
      containerType: el.getAttribute('data-agent-scope-type') || undefined,
      label: cleanLabel(el.getAttribute('data-agent-scope-label')) || undefined,
      breadcrumb: cleanLabel(el.getAttribute('data-agent-scope-breadcrumb')) || undefined,
    };
    break;
  }

  // Zero-Tag Fallback for Active Scope (works on ANY unknown external app automatically!)
  if (!activeScope) {
    const breadcrumbEl = document.querySelector('nav[aria-label*="breadcrumb" i], [role="navigation"][aria-label*="מיקום"]');
    const activeTabEl = document.querySelector('[role="tab"][aria-selected="true"]');
    const topHeading = Array.from(headingSet)[0];
    const autoLabel =
      cleanLabel(breadcrumbEl?.textContent) ||
      cleanLabel(activeTabEl?.textContent) ||
      topHeading ||
      cleanLabel(document.title);
    if (autoLabel) {
      activeScope = {
        containerType: 'auto_discovered_screen',
        label: autoLabel.slice(0, 80),
      };
    }
  }

  const visibleEntities: VisibleAgentEntity[] = [];
  const seenEntityIds = new Set<string>();

  const pushVisibleEntity = (id: string, type: string, title: string, parentId?: string) => {
    if (visibleEntities.length >= 40) return;
    const cleanT = cleanLabel(title).slice(0, 80);
    if (!id || !cleanT || seenEntityIds.has(id)) return;
    seenEntityIds.add(id);
    visibleEntities.push({ id, type, title: cleanT, parentId });
  };

  // Pass A: Explicit data-agent-entity-id (if host provides them)
  document.querySelectorAll('[data-agent-entity-id]').forEach((el) => {
    if (!isElementVisible(el)) return;
    pushVisibleEntity(
      el.getAttribute('data-agent-entity-id') || '',
      el.getAttribute('data-agent-entity-type') || 'item',
      el.getAttribute('data-agent-entity-title') || el.textContent || '',
      el.getAttribute('data-agent-entity-parent') || undefined
    );
  });

  // Pass B: 100% Automatic Zero-Tag Heuristic Entity Discovery (works on ANY external app without manual tags!)
  if (visibleEntities.length < 25) {
    document
      .querySelectorAll('[data-doc-id], [data-folder-id], [data-item-id], [data-id], [role="listitem"], article, tbody tr')
      .forEach((el, idx) => {
        if (visibleEntities.length >= 40) return;
        if (!isElementVisible(el)) return;
        const explicitId =
          el.getAttribute('data-doc-id') ||
          el.getAttribute('data-folder-id') ||
          el.getAttribute('data-item-id') ||
          el.getAttribute('data-id') ||
          el.getAttribute('id') ||
          `auto_ent_${idx}`;
        const inferredType = el.hasAttribute('data-folder-id')
          ? 'folder'
          : el.hasAttribute('data-doc-id')
            ? 'document'
            : el.tagName.toLowerCase() === 'tr'
              ? 'row'
              : 'card';
        const titleNode = el.querySelector('h1, h2, h3, h4, strong, [title]');
        const titleText =
          titleNode?.getAttribute('title') ||
          titleNode?.textContent ||
          Array.from(el.querySelectorAll('span, div, td'))
            .map((n) => cleanLabel(n.textContent))
            .find((t) => t.length >= 2 && t.length <= 60) ||
          '';
        pushVisibleEntity(explicitId, inferredType, titleText);
      });
  }

  // Pass C: Universal Zero-Config Screen Text Reader (works on ANY app — lets the agent verify & read what opened!)
  let visibleScreenText = '';
  try {
    const textSnippets: string[] = [];
    const seenSnippets = new Set<string>();
    const roots: Element[] = [];
    // Prefer the top-most visible modal/dialog if one is open; otherwise scan document.body
    document.querySelectorAll('[role="dialog"], [aria-modal="true"], div[style*="position: fixed"]').forEach((el) => {
      if (isInsideIgnoredZone(el)) return;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
      const z = Number(cs.zIndex || 0);
      const rect = el.getBoundingClientRect();
      if (z >= 1000 && rect.width > 180 && rect.height > 120) {
        roots.push(el);
      }
    });
    const scanRoot = roots.length > 0 ? roots[roots.length - 1] : document.body;
    const walker = document.createTreeWalker(scanRoot, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    let totalChars = 0;
    while (node && totalChars < 850) {
      const parentEl = node.parentElement;
      if (
        parentEl &&
        !isInsideIgnoredZone(parentEl) &&
        !['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'INPUT', 'TEXTAREA'].includes(parentEl.tagName)
      ) {
        const txt = cleanLabel(node.textContent);
        if (txt.length >= 2 && txt.length <= 160 && !seenSnippets.has(txt)) {
          const rect = parentEl.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            seenSnippets.add(txt);
            textSnippets.push(txt);
            totalChars += txt.length + 3;
          }
        }
      }
      node = walker.nextNode();
    }
    visibleScreenText = textSnippets.join(' | ').slice(0, 900);
  } catch {
    visibleScreenText = '';
  }

  return {
    urlPath: window.location.pathname + window.location.search,
    pageTitle: cleanLabel(document.title),
    visibleHeadings: Array.from(headingSet).slice(0, 15),
    visibleButtonsAndActions: Array.from(actionSet).slice(0, 35),
    interactiveElements,
    openModalsOrBanners: Array.from(modalSet).slice(0, 10),
    visibleScreenText,
    activeScope,
    visibleEntities
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
    if (tag === 'select') {
      const sel = el as HTMLSelectElement;
      const wanted = String(value ?? '').trim().toLowerCase();
      const matchedOpt = Array.from(sel.options).find(
        (o) =>
          o.value.toLowerCase() === wanted ||
          o.text.trim().toLowerCase() === wanted ||
          o.text.trim().toLowerCase().includes(wanted)
      );
      if (!matchedOpt) {
        return { success: false, message: `האפשרות "${value ?? ''}" לא נמצאה ברשימה.` };
      }
      const nativeSelectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
      if (nativeSelectSetter) {
        nativeSelectSetter.call(sel, matchedOpt.value);
      } else {
        sel.value = matchedOpt.value;
      }
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, message: `נבחר "${matchedOpt.text.trim()}" ברשימה.` };
    }
    if (tag !== 'input' && tag !== 'textarea') {
      return { success: false, message: 'האלמנט שנבחר אינו שדה הקלדה.' };
    }
    const inp = el as HTMLInputElement | HTMLTextAreaElement;
    // Universal HTML5 <input type="time"> normalization (e.g. "9:30" -> "09:30")
    let normalizedVal = String(value ?? '');
    if (tag === 'input' && (inp as HTMLInputElement).type === 'time') {
      const m = normalizedVal.trim().match(/^(\d{1,2}):(\d{2})/);
      if (m) {
        normalizedVal = `${m[1].padStart(2, '0')}:${m[2]}`;
      }
    }
    // Use native value setter so React controlled inputs update cleanly
    const proto = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(inp, normalizedVal);
    } else {
      inp.value = normalizedVal;
    }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.focus();
    return { success: true, message: `הוזן "${normalizedVal}" בשדה "${inp.placeholder || inp.getAttribute('aria-label') || 'טופס'}" על המסך.` };
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

  const capped = steps.slice(0, 5);
  const logs: string[] = [];
  let completed = 0;

  const countVisibleFormFields = (): number => {
    if (typeof document === 'undefined') return 0;
    let count = 0;
    document.querySelectorAll('input, textarea, select').forEach((node) => {
      if (node.closest('[data-agent-ui="true"]')) return;
      const cs = window.getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
      const r = node.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) count++;
    });
    return count;
  };

  for (let i = 0; i < capped.length; i++) {
    const step = capped[i];
    const isClickWithMoreSteps = step.op !== 'fill' && i < capped.length - 1;
    const fieldsBefore = isClickWithMoreSteps ? countVisibleFormFields() : 0;

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
    await new Promise((r) => setTimeout(r, 160));

    // 100% Universal Progressive-Disclosure Guard (works on ANY web app!):
    // If clicking a button revealed NEW form input(s) (e.g. "Add time", "Add address", "Add coupon"),
    // pause the batch BEFORE blindly clicking Submit so the next autonomous step fills the newly-revealed field!
    if (isClickWithMoreSteps) {
      const fieldsAfter = countVisibleFormFields();
      if (fieldsAfter > fieldsBefore) {
        return {
          success: true,
          message: `בוצעו ${completed} פעולות ונפתחו שדות קלט חדשים על המסך — ממתין למילוי השדות החדשים לפני השמירה.`,
          completedSteps: completed
        };
      }
    }
  }

  return {
    success: true,
    message: `בוצעו ${completed} פעולות ברצף בהצלחה על המסך (${logs[logs.length - 1] || ''}).`,
    completedSteps: completed
  };
}
