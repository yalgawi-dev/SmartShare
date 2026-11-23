/**
 * SmartShare Host Adapter for the Headless Universal Agent OS (ADR-009).
 *
 * Plugs SmartShare's Universal Headless Primitives into the app-agnostic
 * agentActionRegistry so the parallel brain can transfer items anywhere,
 * create/manage entities across Vault & FileShare, and share resources
 * from ANY screen (including Home Screen) with ZERO UI clicks!
 */

import { agentActionRegistry } from './assistantActionRegistry';
import type { HostAppManifest } from './agentManifest';
import type { HostActionRuntimeContext } from './assistantActionExecutor';
import { createSecurityEnvelope, canCallerAccessSpace } from './assistantFirewall';
import {
  createOrUpdatePublicShare,
  generateShareToken,
  type FileShareItem,
  type RecipientShareLink,
  type ShareLinkConfig,
} from '@/utils/fileShareUtils';

let smartSharePrimitivesRegistered = false;

export function getSmartShareHostManifest(): HostAppManifest {
  return {
    appId: 'smartshare',
    appName: 'MySpace / SmartShare',
    version: '1.0.0',
    entities: [
      { kind: 'space', label: 'מרחב עבודה', description: 'פרויקט או קבוצת עבודה המכילה מסמכים, קיר שיתוף והוצאות' },
      { kind: 'vault_document', label: 'מסמך בכספת', description: 'מסמך/שרטוט/PDF השמור בתוך מדף ותיקייה בכספת' },
      { kind: 'vault_folder', label: 'תיקייה בכספת', description: 'תיקייה לסידור מסמכים בתוך מדף' },
      { kind: 'fileshare_item', label: 'קובץ או תיקייה בקיר שיתוף', description: 'פריט המיועד לשיתוף מהיר עם לקוחות, קבלנים ושותפים' },
      { kind: 'share_link', label: 'קישור שיתוף אישי', description: 'קישור מאובטח לנמען ספציפי או ציבורי עם מעקב צפיות' },
    ],
    capabilities: agentActionRegistry.listSchemas(),
  };
}

export function registerSmartShareUniversalPrimitives(): void {
  if (smartSharePrimitivesRegistered) return;
  smartSharePrimitivesRegistered = true;

  /**
   * UNIVERSAL PRIMITIVE #1: transfer_items
   * Move or copy ANY file(s) from ANY source (vault | fileshare, space A)
   * to ANY destination (vault | fileshare, folder, space B) — 100% headlessly from ANY screen!
   */
  agentActionRegistry.register({
    schema: {
      name: 'transfer_items',
      description: 'העברה או העתקה אוניברסלית מאחורי הקלעים של קובץ אחד או יותר (או תיקייה שלמה) מכל מקור (vault או fileshare) אל כל יעד (vault או fileshare, כולל בין מרחבים שונים או לתוך תיקייה ספציפית). עובד גם ממסך הבית ללא כניסה למרחב!',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        sourceSpaceId: { type: 'string', description: 'מזהה מרחב המקור', required: true },
        sourceArea: { type: 'string', description: 'אזור המקור: "vault" (כספת/מסמכים) או "fileshare" (קיר שיתוף)', required: true },
        itemIds: { type: 'string[]', description: 'מערך מזהי קבצים להעברה (או ריק אם מעבירים לפי sourceFolderId)', required: false },
        sourceFolderId: { type: 'string', description: 'אופציונלי: מזהה תיקיית מקור להעברת כל הקבצים שבתוכה', required: false },
        destSpaceId: { type: 'string', description: 'מזהה מרחב היעד (ברירת מחדל: זהה למרחב המקור)', required: false },
        destArea: { type: 'string', description: 'אזור היעד: "fileshare" (קיר שיתוף) או "vault" (כספת/מסמכים)', required: true },
        destFolderId: { type: 'string', description: 'אופציונלי: מזהה תיקיית היעד (תומך גם ב-"$step1.createdId" בשרשור תוכנית!)', required: false },
        destFolderName: { type: 'string', description: 'אופציונלי: שם תיקיית יעד קיימת לאיתור אוטומטי', required: false },
        mode: { type: 'string', description: '"copy" (העתקה - ברירת מחדל בטוחה) או "move" (העברה)', required: false },
      },
    },
    execute: async (params, ctx) => {
      const { user, spaces, spacesApi, router, suppressAutoNavigate } = ctx as HostActionRuntimeContext & { suppressAutoNavigate?: boolean };
      const envelope = createSecurityEnvelope(user);
      const srcSpace = (spaces || []).find((s: any) => s.id === params.sourceSpaceId);
      const dstSpace = (spaces || []).find((s: any) => s.id === (params.destSpaceId || params.sourceSpaceId));

      if (!srcSpace || !canCallerAccessSpace(envelope, srcSpace)) {
        return { success: false, message: 'אין הרשאה לגשת למרחב המקור.' };
      }
      if (!dstSpace || !canCallerAccessSpace(envelope, dstSpace)) {
        return { success: false, message: 'אין הרשאה לגשת למרחב היעד.' };
      }

      const sourceArea = params.sourceArea === 'fileshare' ? 'fileshare' : 'vault';
      const destArea = params.destArea === 'vault' ? 'vault' : 'fileshare';
      const mode = params.mode === 'move' ? 'move' : 'copy';
      const requestedIds: string[] = Array.isArray(params.itemIds) ? params.itemIds.map(String) : [];

      // 1. Collect source items
      let collected: Array<{ id: string; name: string; fileName?: string; url: string; rawPdfUrl?: string; thumbnailUrl?: string; pages?: string[]; mimeType?: string; fileType?: string; size?: number }> = [];

      if (sourceArea === 'vault') {
        const activeDocs = (srcSpace.documents || []).filter((d: any) => !d.deletedAt);
        const matched = requestedIds.length > 0
          ? activeDocs.filter((d: any) => requestedIds.includes(d.id))
          : params.sourceFolderId
            ? activeDocs.filter((d: any) => d.folderId === params.sourceFolderId)
            : [];
        collected = matched.map((d: any) => ({
          id: d.id,
          name: String(d.title || d.name || d.fileName || 'מסמך'),
          fileName: d.fileName || d.title || d.name,
          url: d.rawPdfUrl || d.fileUrl || d.url || (Array.isArray(d.pages) && d.pages[0]) || '',
          rawPdfUrl: d.rawPdfUrl,
          thumbnailUrl: d.thumbnailUrl,
          pages: d.pages,
          mimeType: d.mimeType,
          fileType: d.fileType,
          size: d.size,
        }));
      } else {
        const activeFs = (srcSpace.fileShareItems || []).filter((i: any) => !i.deletedAt && i.type === 'file');
        const matched = requestedIds.length > 0
          ? activeFs.filter((i: any) => requestedIds.includes(i.id))
          : params.sourceFolderId
            ? activeFs.filter((i: any) => i.parentId === params.sourceFolderId)
            : [];
        collected = matched.map((i: any) => ({
          id: i.id,
          name: String(i.name || i.fileName || 'קובץ'),
          fileName: i.fileName || i.name,
          url: i.rawPdfUrl || i.url || (Array.isArray(i.pages) && i.pages[0]) || '',
          rawPdfUrl: i.rawPdfUrl,
          thumbnailUrl: i.thumbnailUrl,
          pages: i.pages,
          mimeType: i.mimeType,
          fileType: i.fileType,
          size: i.size,
        }));
      }

      if (collected.length === 0) {
        return { success: false, message: 'לא נמצאו קבצים תואמים להעברה.' };
      }

      const nowIso = new Date().toISOString();

      // 2. Write into Destination
      if (destArea === 'fileshare') {
        const dstItems: any[] = Array.isArray(dstSpace.fileShareItems) ? [...dstSpace.fileShareItems] : [];
        let targetParentId: string | null = params.destFolderId || null;
        let targetLabel = 'קיר השיתוף';

        if (!targetParentId && params.destFolderName) {
          const needle = String(params.destFolderName).trim().toLowerCase();
          const folder = dstItems.find((i: any) => !i.deletedAt && i.type === 'folder' && String(i.name || '').trim().toLowerCase() === needle);
          if (folder) {
            targetParentId = folder.id;
            targetLabel = `תיקיית "${folder.name}" בקיר השיתוף`;
          }
        } else if (targetParentId) {
          const folder = dstItems.find((i: any) => !i.deletedAt && i.id === targetParentId);
          if (folder) targetLabel = `תיקיית "${folder.name}" בקיר השיתוף`;
        }

        const createdIds: string[] = [];
        const transferredNames: string[] = [];

        for (const item of collected) {
          if (sourceArea === 'fileshare' && srcSpace.id === dstSpace.id && mode === 'move') {
            const idx = dstItems.findIndex((x: any) => x.id === item.id);
            if (idx >= 0) {
              dstItems[idx] = { ...dstItems[idx], parentId: targetParentId };
              createdIds.push(item.id);
              transferredNames.push(item.name);
              continue;
            }
          }

          const exists = dstItems.some(
            (x: any) => !x.deletedAt && x.type === 'file' && (x.parentId || null) === targetParentId && ((item.url && (x.url === item.url || x.rawPdfUrl === item.url)) || x.name === item.name)
          );
          if (exists) {
            transferredNames.push(item.name);
            continue;
          }

          const newId = `fs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          dstItems.push({
            id: newId,
            type: 'file',
            name: item.name,
            fileName: item.fileName || item.name,
            parentId: targetParentId,
            url: item.url,
            ...(item.rawPdfUrl ? { rawPdfUrl: item.rawPdfUrl } : {}),
            ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
            ...(Array.isArray(item.pages) && item.pages.length > 0 ? { pages: item.pages } : {}),
            ...(item.mimeType ? { mimeType: item.mimeType } : {}),
            ...(item.fileType ? { fileType: item.fileType } : {}),
            ...(item.size ? { size: item.size } : {}),
            createdAt: nowIso,
            uploadedBy: user?.id || 'assistant',
            uploadedByName: user?.realName || user?.name || 'משתמש',
            isPublic: true,
            allowedPartners: [],
          });
          createdIds.push(newId);
          transferredNames.push(item.name);
        }

        spacesApi.updateFileShareItems(dstSpace.id, dstItems);

        const proofUrl = `/space/${dstSpace.id}?tab=fileshare`;
        if (!suppressAutoNavigate) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smartshare:open_tab', { detail: { spaceId: dstSpace.id, tab: 'fileshare' } }));
          }
          router.push(proofUrl);
        }

        return {
          success: true,
          message: `בוצעה העברה של ${transferredNames.length} קבצים (${transferredNames.join(', ')}) אל ${targetLabel} במרחב "${dstSpace.title}".`,
          proofUrl,
          proofLabel: `🔗 צפה ב-${targetLabel}`,
          data: { createdIds, targetFolderId: targetParentId, spaceId: dstSpace.id },
        };
      }

      // Destination = Vault (same-space vault move)
      if (sourceArea === 'vault' && srcSpace.id === dstSpace.id) {
        let targetFolder = params.destFolderId
          ? (dstSpace.documentFolders || []).find((f: any) => f.id === params.destFolderId && !f.deletedAt)
          : null;
        if (!targetFolder && params.destFolderName) {
          const needle = String(params.destFolderName).trim().toLowerCase();
          targetFolder = (dstSpace.documentFolders || []).find((f: any) => !f.deletedAt && String(f.name || '').trim().toLowerCase() === needle);
        }
        for (const item of collected) {
          spacesApi.updateDocument(dstSpace.id, item.id, {
            folderId: targetFolder ? targetFolder.id : null,
            ...(targetFolder?.shelfId ? { shelfId: targetFolder.shelfId } : {}),
          });
        }
        const destLabel = targetFolder ? `תיקיית "${targetFolder.name}"` : 'התיקייה הראשית';
        const proofUrl = `/space/${dstSpace.id}?tab=documents${targetFolder ? `&folderId=${targetFolder.id}` : ''}`;
        if (!suppressAutoNavigate) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smartshare:open_tab', { detail: { spaceId: dstSpace.id, tab: 'documents' } }));
          }
          router.push(proofUrl);
        }
        return {
          success: true,
          message: `הועברו ${collected.length} מסמכים אל ${destLabel} במרחב "${dstSpace.title}".`,
          proofUrl,
          proofLabel: `📂 צפה ב-${destLabel}`,
          data: { targetFolderId: targetFolder?.id || null, spaceId: dstSpace.id },
        };
      }

      return { success: false, message: 'העברה חוצת-מרחבים לתוך הכספת עדיין בפיתוח — העבר אל קיר השיתוף או בתוך אותו מרחב.' };
    },
  });

  /**
   * UNIVERSAL PRIMITIVE #2: manage_entity
   * Create a folder in EITHER Vault OR FileShare headlessly from ANY screen, returning { createdId } for chaining!
   */
  agentActionRegistry.register({
    schema: {
      name: 'manage_entity',
      description: 'יוצר תיקייה חדשה מאחורי הקלעים בכספת ("vault") או בקיר השיתוף ("fileshare") בכל מרחב, ומחזיר createdId לשרשור מיידי של שלבים נוספים בתוכנית (כגון transfer_items או share_resource).',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        spaceId: { type: 'string', description: 'מזהה המרחב', required: true },
        area: { type: 'string', description: '"fileshare" (קיר שיתוף) או "vault" (כספת/מסמכים)', required: true },
        action: { type: 'string', description: '"create_folder"', required: true },
        name: { type: 'string', description: 'שם התיקייה החדשה', required: true },
        parentFolderId: { type: 'string', description: 'אופציונלי: מזהה תיקיית אב', required: false },
      },
    },
    execute: async (params, ctx) => {
      const { user, spaces, spacesApi, router, suppressAutoNavigate } = ctx as HostActionRuntimeContext & { suppressAutoNavigate?: boolean };
      const envelope = createSecurityEnvelope(user);
      const space = (spaces || []).find((s: any) => s.id === params.spaceId);
      if (!space || !canCallerAccessSpace(envelope, space)) {
        return { success: false, message: 'אין הרשאה ליצור תיקייה במרחב זה.' };
      }
      const name = String(params.name || '').trim();
      if (!name) return { success: false, message: 'יש לציין שם לתיקייה.' };

      if (params.area === 'fileshare') {
        const items: any[] = Array.isArray(space.fileShareItems) ? [...space.fileShareItems] : [];
        const existing = items.find(
          (i: any) => !i.deletedAt && i.type === 'folder' && (i.parentId || null) === (params.parentFolderId || null) && String(i.name || '').trim().toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          return {
            success: true,
            message: `תיקיית "${existing.name}" כבר קיימת בקיר השיתוף — משתמש בה.`,
            proofUrl: `/space/${space.id}?tab=fileshare`,
            proofLabel: '🔗 פתח קיר שיתוף',
            data: { createdId: existing.id, spaceId: space.id },
          };
        }
        const newId = `fs_folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        items.push({
          id: newId,
          type: 'folder',
          name,
          parentId: params.parentFolderId || null,
          createdAt: new Date().toISOString(),
          uploadedBy: user?.id || 'assistant',
          uploadedByName: user?.realName || user?.name || 'משתמש',
          isPublic: true, // Rule 20
          allowedPartners: [],
        });
        spacesApi.updateFileShareItems(space.id, items);
        const proofUrl = `/space/${space.id}?tab=fileshare`;
        if (!suppressAutoNavigate) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smartshare:open_tab', { detail: { spaceId: space.id, tab: 'fileshare' } }));
          }
          router.push(proofUrl);
        }
        return {
          success: true,
          message: `תיקיית "${name}" נוצרה בקיר השיתוף של "${space.title}".`,
          proofUrl,
          proofLabel: '🔗 צפה בקיר השיתוף',
          data: { createdId: newId, spaceId: space.id },
        };
      }

      const defaultShelf = (space.shelves || []).find((s: any) => !s.deletedAt);
      const newFolderId = spacesApi.addDocumentFolder(space.id, {
        name,
        shelfId: defaultShelf?.id || undefined,
        parentId: params.parentFolderId || null,
        allowedPartners: [],
      });
      const proofUrl = `/space/${space.id}?tab=documents${newFolderId ? `&folderId=${newFolderId}` : ''}`;
      if (!suppressAutoNavigate) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smartshare:open_tab', { detail: { spaceId: space.id, tab: 'documents' } }));
        }
        router.push(proofUrl);
      }
      return {
        success: true,
        message: `תיקיית "${name}" נוצרה בכספת של "${space.title}".`,
        proofUrl,
        proofLabel: '📂 צפה בתיקייה החדשה',
        data: { createdId: newFolderId, spaceId: space.id },
      };
    },
  });

  /**
   * UNIVERSAL PRIMITIVE #3: share_resource
   * Creates/enables a live share link + optional named recipient for ANY FileShare folder/file
   * 100% headlessly from ANY screen (even Home Screen!), returning the direct share URL!
   */
  agentActionRegistry.register({
    schema: {
      name: 'share_resource',
      description: 'יוצר ומפעיל קישור שיתוף אמיתי (כולל קישור אישי לנמען ספציפי עם מעקב צפייה) עבור קובץ או תיקייה בקיר השיתוף מכל מסך באפליקציה, ומחזיר קישור מוכן לשליחה.',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        spaceId: { type: 'string', description: 'מזהה המרחב', required: true },
        itemId: { type: 'string', description: 'מזהה הקובץ או התיקייה בקיר השיתוף (תומך גם ב-"$step1.createdId")', required: false },
        itemName: { type: 'string', description: 'אופציונלי: שם הקובץ או התיקייה בקיר השיתוף', required: false },
        recipientName: { type: 'string', description: 'אופציונלי: שם הנמען לקבלת קישור אישי (למשל "אלי אינסטלטור")', required: false },
      },
    },
    execute: async (params, ctx) => {
      const { user, spaces, spacesApi } = ctx as HostActionRuntimeContext;
      const envelope = createSecurityEnvelope(user);
      const space = (spaces || []).find((s: any) => s.id === params.spaceId);
      if (!space || !canCallerAccessSpace(envelope, space)) {
        return { success: false, message: 'אין הרשאה לשתף פריטים במרחב זה.' };
      }

      const items: FileShareItem[] = Array.isArray(space.fileShareItems) ? [...space.fileShareItems] : [];
      let target = params.itemId ? items.find((i) => !i.deletedAt && i.id === params.itemId) : undefined;
      if (!target && params.itemName) {
        const needle = String(params.itemName).trim().toLowerCase();
        target = items.find((i) => !i.deletedAt && String(i.name || '').trim().toLowerCase() === needle);
      }
      if (!target) {
        return { success: false, message: 'הפריט המבוקש לא נמצא בקיר השיתוף.' };
      }

      const existingLink = target.shareLink;
      const masterToken = existingLink?.token || generateShareToken();
      const recipients: RecipientShareLink[] = Array.isArray(existingLink?.recipients) ? [...existingLink.recipients] : [];
      let activeTokenToShare = masterToken;
      const recName = String(params.recipientName || '').trim();

      if (recName) {
        const existingRec = recipients.find((r) => r.recipientName.trim().toLowerCase() === recName.toLowerCase());
        if (existingRec) {
          activeTokenToShare = existingRec.token;
        } else {
          const recToken = generateShareToken();
          recipients.push({
            id: `rcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            recipientName: recName,
            role: 'client',
            phone: '',
            token: recToken,
            enabled: true,
            createdAt: Date.now(),
            viewCount: 0,
            totalDurationSeconds: 0,
            lastViewedAt: null,
            chatChannelId: `guest_${recToken}`,
          });
          activeTokenToShare = recToken;
        }
      }

      const newConfig: ShareLinkConfig = {
        enabled: true,
        token: masterToken,
        requirePin: Boolean(existingLink?.requirePin),
        pin: existingLink?.pin || '',
        expiresAt: existingLink?.expiresAt || null,
        allowDownload: existingLink?.allowDownload !== false,
        allowUploads: existingLink?.allowUploads !== false,
        includeSubtree: Boolean(existingLink?.includeSubtree),
        viewCount: existingLink?.viewCount || 0,
        totalDurationSeconds: existingLink?.totalDurationSeconds || 0,
        lastViewedAt: existingLink?.lastViewedAt || null,
        createdAt: existingLink?.createdAt || Date.now(),
        recipients,
      };

      const folderFiles = target.type === 'folder' ? items.filter((i) => !i.deletedAt && i.type === 'file' && i.parentId === target!.id) : [];
      await createOrUpdatePublicShare(space.id, space.title, target, newConfig, folderFiles);

      const updatedItems = items.map((i) => (i.id === target!.id ? { ...i, shareLink: newConfig } : i));
      spacesApi.updateFileShareItems(space.id, updatedItems);

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://smart-share-tvwn-delta.vercel.app';
      const shareUrl = `${origin}/share/${activeTokenToShare}`;

      return {
        success: true,
        message: recName
          ? `נוצר קישור שיתוף אישי עבור "${recName}" ל-${target.type === 'folder' ? 'תיקיית' : 'קובץ'} "${target.name}"!`
          : `קישור השיתוף עבור "${target.name}" הופעל בהצלחה!`,
        proofUrl: shareUrl,
        proofLabel: recName ? `🔗 פתח את הקישור של ${recName}` : '🔗 פתח קישור שיתוף',
        data: { shareUrl, token: activeTokenToShare },
      };
    },
  });
}
