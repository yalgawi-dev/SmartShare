/**
 * Layer 5.5 — Deterministic Pre-Execution Policy, Clarity & Ambiguity Gate
 *
 * App-agnostic Universal Agent OS guardrail that runs AFTER the LLM proposes an action
 * and BEFORE showing the confirmation card / executing:
 * 1. Ambiguity Guard: If the user referred generically to "the file here / on this page"
 *    without naming a specific item AND 2+ candidate items are visible in the current viewport,
 *    block guessing and ask a crisp 1-line disambiguation question.
 * 2. Explicit Diff Clarity: Enriches proposedAction.details & answer so the user ALWAYS sees
 *    EXACTLY what item is being moved/cut/copied/deleted, from where, and to where.
 */

import type { LiveScreenSnapshot } from './assistantDomIntrospector';

export interface ClarityGateInput {
  userQuery: string;
  answer: string;
  proposedAction: any | null;
  proposedPlan: any | null;
  liveScreenDOM: LiveScreenSnapshot | null;
}

export interface ClarityGateOutput {
  answer: string;
  proposedAction: any | null;
  proposedPlan: any | null;
  blockedForAmbiguity: boolean;
}

const GENERIC_FILE_REF_REGEX =
  /(את\s+הקובץ|את\s+המסמך|הקובץ\s+ש(את\s+)?רואה|המסמך\s+ש(את\s+)?רואה|הקובץ\s+פה|המסמך\s+פה|בדף\s+פה|במסך\s+פה|כאן\s+בדף)/i;

const MOVE_OR_MUTATE_TOOLS = new Set([
  'transfer_items',
  'move_document',
  'export_documents_to_fileshare',
  'update_or_delete_entity',
]);

export function runPreExecutionClarityGate(input: ClarityGateInput): ClarityGateOutput {
  const { userQuery, liveScreenDOM } = input;
  let { answer, proposedAction, proposedPlan } = input;

  const visibleFiles = (liveScreenDOM?.visibleEntities || []).filter(
    (e) => e.type === 'document' || e.type === 'file'
  );
  const visibleFolders = (liveScreenDOM?.visibleEntities || []).filter(
    (e) => e.type === 'folder'
  );

  // 1. Ambiguity Guard for generic "the file on this page" references
  if (
    proposedAction &&
    MOVE_OR_MUTATE_TOOLS.has(String(proposedAction.tool || '')) &&
    GENERIC_FILE_REF_REGEX.test(userQuery) &&
    visibleFiles.length >= 2
  ) {
    const normQuery = userQuery.toLowerCase();
    const userExplicitlyNamedOne = visibleFiles.some((f) => {
      const cleanTitle = f.title.toLowerCase().trim();
      if (cleanTitle.length < 2) return false;
      return normQuery.includes(cleanTitle) || cleanTitle.split(/\s+/).some((w) => w.length >= 3 && normQuery.includes(w));
    });

    if (!userExplicitlyNamedOne) {
      const namesList = visibleFiles
        .slice(0, 4)
        .map((f) => `«${f.title}»`)
        .join(', ');
      return {
        answer: `אני רואה בדף הזה ${visibleFiles.length} קבצים: ${namesList}. איזה מהם להעביר?`,
        proposedAction: null,
        proposedPlan: null,
        blockedForAmbiguity: true,
      };
    }
  }

  // 2. Explicit Diff Enrichment: guarantee Source, Item Name, and Destination are clearly shown
  if (proposedAction && MOVE_OR_MUTATE_TOOLS.has(String(proposedAction.tool || ''))) {
    const params = proposedAction.params || {};
    const existingDetails: string[] = Array.isArray(proposedAction.details)
      ? [...proposedAction.details]
      : [];

    const itemId = params.documentId || params.itemId || (Array.isArray(params.itemIds) ? params.itemIds[0] : undefined);
    const destId = params.targetFolderId || params.destFolderId;

    const matchedFile = itemId ? visibleFiles.find((f) => f.id === itemId) : undefined;
    const matchedDest = destId ? visibleFolders.find((f) => f.id === destId) : undefined;
    const scopeLabel = liveScreenDOM?.activeScope?.label;

    const hasItemDetail = existingDetails.some((d) => /קובץ|מסמך|פריט/.test(d));
    const hasSourceDetail = existingDetails.some((d) => /ממקור|מתיקיי|ממיקום/.test(d));
    const hasDestDetail = existingDetails.some((d) => /יעד|אל תיקיי|לתיקיי/.test(d));

    const enrichedDetails = [...existingDetails];
    if (!hasItemDetail && (matchedFile?.title || params.documentTitle || params.itemName)) {
      enrichedDetails.unshift(`פריט: ${matchedFile?.title || params.documentTitle || params.itemName}`);
    }
    if (!hasSourceDetail && scopeLabel) {
      enrichedDetails.push(`ממקור: ${scopeLabel}`);
    }
    if (!hasDestDetail && (matchedDest?.title || params.targetFolderName || params.destFolderName)) {
      enrichedDetails.push(`ליעד: ${matchedDest?.title || params.targetFolderName || params.destFolderName}`);
    }

    proposedAction = {
      ...proposedAction,
      details: enrichedDetails,
    };
  }

  return {
    answer,
    proposedAction,
    proposedPlan,
    blockedForAmbiguity: false,
  };
}
