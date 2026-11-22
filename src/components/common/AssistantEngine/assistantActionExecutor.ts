import {
  agentActionRegistry,
  type AgentActionProposal,
  type AgentActionExecutionResult
} from './assistantActionRegistry';
import { executeLiveDomElementAction, executeLiveDomBatch } from './assistantDomIntrospector';
import { createSecurityEnvelope, canCallerAccessSpace, resolveCallerSpaceRole } from './assistantFirewall';

export interface HostActionRuntimeContext {
  user: any;
  spaces: any[];
  router: { push: (url: string) => void };
  spacesApi: {
    updateDocument: (spaceId: string, docId: string, updates: any) => void;
    addDocumentFolder: (spaceId: string, folder: any) => string;
    updateDocumentFolder: (spaceId: string, folderId: string, updates: any) => void;
    removeDocument: (spaceId: string, docId: string) => void;
    updateInvoice: (spaceId: string, invoiceId: string, updates: any, performedBy?: string, actionDetail?: string) => void;
  };
}

let isInitialized = false;

/**
 * Registers both:
 * - Layer 2 Universal Zero-Config UI Tools (work in ANY app automatically via live DOM discovery)
 * - Layer 1 MySpace Domain Tools (DRY wrappers around SpacesContext with Zero-Trust Firewall checks)
 */
export function ensureDefaultAgentActionsRegistered(): void {
  if (isInitialized) return;
  isInitialized = true;

  // =========================================================================
  // LAYER 2: UNIVERSAL ZERO-CONFIG UI TOOLS (Work in ANY future host app!)
  // =========================================================================
  agentActionRegistry.register({
    schema: {
      name: 'ui_click_element',
      description: 'לוחץ על כפתור, טאב או קישור שגלוי כרגע על המסך באמצעות המזהה שלו (agentId מתוך liveScreenDOM.interactiveElements). לפעולות ניווט/פתיחת מודאל/שיתוף מתבצע אוטומטית.',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        agentId: { type: 'string', description: 'המזהה החי של האלמנט מתוך interactiveElements (למשל ui_5)', required: true },
        elementLabel: { type: 'string', description: 'שם הכפתור בעברית לצורך הצגה באישור', required: true }
      }
    },
    execute: async (params) => {
      const res = executeLiveDomElementAction(String(params.agentId || ''), 'click');
      return { success: res.success, message: res.message };
    }
  });

  agentActionRegistry.register({
    schema: {
      name: 'ui_fill_input',
      description: 'ממלא טקסט בשדה חיפוש או הקלדה שגלוי כרגע על המסך באמצעות agentId מתוך interactiveElements.',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        agentId: { type: 'string', description: 'המזהה החי של השדה מתוך interactiveElements', required: true },
        value: { type: 'string', description: 'הטקסט להזנה בשדה', required: true }
      }
    },
    execute: async (params) => {
      const res = executeLiveDomElementAction(String(params.agentId || ''), 'fill', String(params.value ?? ''));
      return { success: res.success, message: res.message };
    }
  });

  agentActionRegistry.register({
    schema: {
      name: 'ui_execute_batch',
      description: 'מבצע רצף של עד 3 פעולות UI במכה אחת (למשל: מילוי שדות + לחיצה על כפתור בתוך מודאל פתוח) בקריאת AI אחת בלבד.',
      riskLevel: 'medium',
      requiresConfirmation: false,
      parameters: {
        steps: {
          type: 'string[]',
          description: 'מערך צעדים בסדר ביצוע: [{ "agentId": "ui_12", "op": "fill", "value": "..." }, { "agentId": "ui_15", "op": "click" }] מתוך liveScreenDOM.interactiveElements',
          required: true
        }
      }
    },
    execute: async (params) => {
      const steps = Array.isArray(params.steps) ? params.steps : [];
      const res = await executeLiveDomBatch(steps);
      return { success: res.success, message: res.message };
    }
  });

  // =========================================================================
  // LAYER 1: MYSPACE HOST ADAPTER TOOLS (Single Source of Truth via SpacesContext)
  // =========================================================================
  agentActionRegistry.register({
    schema: {
      name: 'navigate_to_space',
      description: 'מעביר את המשתמש למרחב עבודה ספציפי (ואופציונלית לטאב מסמכים/הוצאות/שותפים או תיקייה ספציפית).',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        spaceId: { type: 'string', description: 'מזהה המרחב (id) מתוך liveSpacesData', required: true },
        tab: { type: 'string', description: 'טאב יעד אופציונלי: documents | accounting | fileshare | partners', required: false },
        folderId: { type: 'string', description: 'מזהה תיקייה אופציונלי לפתיחה ישירה', required: false }
      }
    },
    execute: async (params, ctx) => {
      const { user, spaces, router } = ctx as HostActionRuntimeContext;
      const envelope = createSecurityEnvelope(user);
      const space = (spaces || []).find((s: any) => s.id === params.spaceId);
      if (!space || !canCallerAccessSpace(envelope, space)) {
        return { success: false, message: 'אין הרשאה לגשת למרחב המבוקש או שהמרחב לא נמצא.' };
      }
      const qp = new URLSearchParams();
      if (params.tab) qp.set('tab', String(params.tab));
      if (params.folderId) qp.set('folderId', String(params.folderId));
      const url = `/space/${space.id}${qp.toString() ? `?${qp.toString()}` : ''}`;
      router.push(url);
      return {
        success: true,
        message: `המסך הועבר למרחב "${space.title}".`,
        proofUrl: url,
        proofLabel: `פתח את "${space.title}"`
      };
    }
  });

  agentActionRegistry.register({
    schema: {
      name: 'move_document',
      description: 'מעביר מסמך קיים לתיקייה אחרת או למדף אחר בתוך המרחב. חובה לקבל אישור מהמשתמש לפני הביצוע.',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        spaceId: { type: 'string', description: 'מזהה המרחב (id)', required: true },
        docId: { type: 'string', description: 'מזהה המסמך (id) מתוך vault.documents', required: true },
        targetFolderId: { type: 'string', description: 'מזהה תיקיית היעד (id) מתוך vault.folders (או ריק להעברה לראש המדף)', required: false },
        targetShelfId: { type: 'string', description: 'מזהה מדף היעד (id) מתוך vault.shelves אם מעבירים למדף אחר', required: false }
      }
    },
    execute: async (params, ctx) => {
      const { user, spaces, spacesApi, router } = ctx as HostActionRuntimeContext;
      const envelope = createSecurityEnvelope(user);
      const space = (spaces || []).find((s: any) => s.id === params.spaceId);
      if (!space || !canCallerAccessSpace(envelope, space)) {
        return { success: false, message: 'אין הרשאה לבצע פעולה במרחב זה.' };
      }
      const doc = (space.documents || []).find((d: any) => d.id === params.docId && !d.deletedAt);
      if (!doc) {
        return { success: false, message: 'המסמך המבוקש לא נמצא במרחב.' };
      }

      const targetFolder = params.targetFolderId
        ? (space.documentFolders || []).find((f: any) => f.id === params.targetFolderId && !f.deletedAt)
        : null;
      const targetShelfId = targetFolder?.shelfId || params.targetShelfId || doc.shelfId;
      const targetShelf = (space.shelves || []).find((s: any) => s.id === targetShelfId && !s.deletedAt);

      spacesApi.updateDocument(space.id, doc.id, {
        folderId: targetFolder ? targetFolder.id : null,
        ...(targetShelfId ? { shelfId: targetShelfId } : {})
      });

      const destName = targetFolder ? `תיקיית "${targetFolder.name}"` : targetShelf ? `מדף "${targetShelf.title || targetShelf.name}"` : 'התיקייה הראשית';
      const proofUrl = `/space/${space.id}?tab=documents${targetFolder ? `&folderId=${targetFolder.id}` : ''}`;

      // Automatically navigate user to the new location so they physically see the moved file!
      router.push(proofUrl);

      return {
        success: true,
        message: `המסמך "${doc.title || doc.name}" הועבר בהצלחה אל ${destName} במרחב "${space.title}".`,
        proofUrl,
        proofLabel: `📂 צפה במיקום החדש (${destName})`
      };
    }
  });

  agentActionRegistry.register({
    schema: {
      name: 'create_folder',
      description: 'יוצר תיקייה חדשה בתוך מדף או בתוך תיקיית אב במרחב (פתוחה לכולם 🌐 כברירת מחדל).',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        spaceId: { type: 'string', description: 'מזהה המרחב (id)', required: true },
        name: { type: 'string', description: 'שם התיקייה החדשה', required: true },
        shelfId: { type: 'string', description: 'מזהה המדף (id) מתוך vault.shelves', required: false },
        parentFolderId: { type: 'string', description: 'מזהה תיקיית אב אופציונלי', required: false }
      }
    },
    execute: async (params, ctx) => {
      const { user, spaces, spacesApi, router } = ctx as HostActionRuntimeContext;
      const envelope = createSecurityEnvelope(user);
      const space = (spaces || []).find((s: any) => s.id === params.spaceId);
      if (!space || !canCallerAccessSpace(envelope, space)) {
        return { success: false, message: 'אין הרשאה ליצור תיקייה במרחב זה.' };
      }
      const folderName = String(params.name || '').trim();
      if (!folderName) {
        return { success: false, message: 'יש לציין שם לתיקייה החדשה.' };
      }
      const defaultShelf = (space.shelves || []).find((s: any) => !s.deletedAt);
      const shelfId = params.shelfId || defaultShelf?.id || undefined;
      const newFolderId = spacesApi.addDocumentFolder(space.id, {
        name: folderName,
        shelfId,
        parentId: params.parentFolderId || null,
        allowedPartners: [] // Rule 20: Open to all (🌐) by default
      });
      const proofUrl = `/space/${space.id}?tab=documents${newFolderId ? `&folderId=${newFolderId}` : ''}`;
      router.push(proofUrl);
      return {
        success: true,
        message: `התיקייה "${folderName}" נוצרה בהצלחה (🌐 פתוחה לכל חברי המרחב) במרחב "${space.title}".`,
        proofUrl,
        proofLabel: `📁 פתח את התיקייה "${folderName}"`
      };
    }
  });

  agentActionRegistry.register({
    schema: {
      name: 'set_item_privacy',
      description: 'משנה הרשאת פרטיות של מסמך או תיקייה ל"פתוח לכולם" (open_all) או "מוגבל ליוצר/שותפים" (restricted). זמין ליוצר המרחב בלבד.',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        spaceId: { type: 'string', description: 'מזהה המרחב (id)', required: true },
        itemType: { type: 'string', description: 'document או folder', required: true },
        itemId: { type: 'string', description: 'מזהה המסמך או התיקייה (id)', required: true },
        visibility: { type: 'string', description: 'open_all (פתוח לכולם 🌐) או only_me (רק ליוצר 🔒)', required: true }
      }
    },
    execute: async (params, ctx) => {
      const { user, spaces, spacesApi } = ctx as HostActionRuntimeContext;
      const envelope = createSecurityEnvelope(user);
      const space = (spaces || []).find((s: any) => s.id === params.spaceId);
      if (!space || resolveCallerSpaceRole(envelope, space) !== 'creator') {
        return { success: false, message: 'רק יוצר המרחב רשאי לשנות הרשאות פרטיות של פריטים.' };
      }
      const allowedPartners = params.visibility === 'only_me' ? ['__only_me__'] : [];
      if (params.itemType === 'folder') {
        spacesApi.updateDocumentFolder(space.id, params.itemId, { allowedPartners });
      } else {
        spacesApi.updateDocument(space.id, params.itemId, { allowedPartners });
      }
      const label = params.visibility === 'only_me' ? '🔒 מוגבל ליוצר בלבד' : '🌐 פתוח לכל חברי המרחב';
      return {
        success: true,
        message: `הרשאת הפרטיות עודכנה בהצלחה ל-${label}.`,
        proofUrl: `/space/${space.id}?tab=documents`,
        proofLabel: '📂 עבור לכספת המסמכים'
      };
    }
  });

  agentActionRegistry.register({
    schema: {
      name: 'update_invoice_payer',
      description: 'מעדכן מי שילם חשבונית קיימת (למשל משנה חשבונית הרשומה תחת "אורח" לשם השותף האמיתי).',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        spaceId: { type: 'string', description: 'מזהה המרחב (id)', required: true },
        invoiceId: { type: 'string', description: 'מזהה החשבונית (id) מתוך invoices', required: true },
        newPayerName: { type: 'string', description: 'שם המשלם החדש', required: true }
      }
    },
    execute: async (params, ctx) => {
      const { user, spaces, spacesApi, router } = ctx as HostActionRuntimeContext;
      const envelope = createSecurityEnvelope(user);
      const space = (spaces || []).find((s: any) => s.id === params.spaceId);
      if (!space || !canCallerAccessSpace(envelope, space)) {
        return { success: false, message: 'אין הרשאה לערוך חשבוניות במרחב זה.' };
      }
      const inv = (space.invoices || []).find((i: any) => i.id === params.invoiceId && i.isActive !== false);
      if (!inv) {
        return { success: false, message: 'החשבונית לא נמצאה.' };
      }
      const targetName = String(params.newPayerName || '').trim();
      const matchedMember = (space.members || []).find((m: any) => m.name === targetName);
      const isMe = targetName === (user?.realName || user?.nickname) || targetName === 'אני';
      const newPayerId = matchedMember?.userId || (isMe ? (user?.id || space.creatorId || 'me') : inv.payerId);

      spacesApi.updateInvoice(
        space.id,
        inv.id,
        { payerId: newPayerId, payerName: targetName },
        user?.id || 'me',
        `עדכון משלם ל-${targetName} באמצעות הסוכן האישי`
      );

      const proofUrl = `/space/${space.id}?tab=accounting`;
      router.push(proofUrl);
      return {
        success: true,
        message: `המשלם בחשבונית "${inv.description || inv.supplier || inv.vendor || 'הוצאה'}" (₪${inv.amount}) עודכן בהצלחה ל-"${targetName}".`,
        proofUrl,
        proofLabel: '🧾 צפה בהוצאות המעודכנות'
      };
    }
  });
}

/**
 * Unified Zero-Trust Action Executor.
 * Always verifies tool existence and runs execution through the registered handler.
 */
export async function executeApprovedAgentAction(
  proposal: AgentActionProposal,
  runtimeContext: HostActionRuntimeContext
): Promise<AgentActionExecutionResult> {
  ensureDefaultAgentActionsRegistered();
  const tool = agentActionRegistry.get(proposal.tool);
  if (!tool) {
    return { success: false, message: `הפעולה "${proposal.tool}" אינה נתמכת כרגע במערכת.` };
  }
  try {
    return await tool.execute(proposal.params || {}, runtimeContext);
  } catch (err: any) {
    console.error('Agent action execution error:', err);
    return { success: false, message: 'אירעה שגיאה טכנית בביצוע הפעולה. נסה שוב.' };
  }
}
