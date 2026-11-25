/**
 * Layer 6.5 — Universal Post-Action Undo Ledger (App-Agnostic)
 *
 * Stores reversible pre-action snapshots so any supported mutation executed by the Agent
 * (move document, change permission, rename, etc.) can be undone in 1 tap from the
 * Smart Auto-Collapse Success Pill — guaranteeing 100% user trust even in brand-new environments.
 */

export interface AgentUndoEntry {
  id: string;
  label: string;
  createdAt: number;
  undo: () => Promise<string> | string;
}

const MAX_UNDO_STACK = 10;
const undoStack: AgentUndoEntry[] = [];

export function registerAgentUndo(
  label: string,
  undo: () => Promise<string> | string
): string {
  const id = `undo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  undoStack.unshift({
    id,
    label,
    createdAt: Date.now(),
    undo,
  });
  if (undoStack.length > MAX_UNDO_STACK) {
    undoStack.length = MAX_UNDO_STACK;
  }
  return id;
}

export async function executeAgentUndo(
  id: string
): Promise<{ success: boolean; message: string }> {
  const idx = undoStack.findIndex((e) => e.id === id);
  if (idx < 0) {
    return { success: false, message: 'לא נמצאה פעולה לביטול.' };
  }
  const [entry] = undoStack.splice(idx, 1);
  try {
    const msg = await entry.undo();
    return { success: true, message: msg || `הפעולה "${entry.label}" בוטלה בהצלחה.` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'ביטול הפעולה נכשל.' };
  }
}

export function hasUndoEntry(id?: string): boolean {
  if (!id) return false;
  return undoStack.some((e) => e.id === id);
}
