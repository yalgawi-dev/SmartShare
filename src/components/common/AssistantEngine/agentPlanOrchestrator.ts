/**
 * Headless Universal Agent OS — Multi-Step Parallel Plan Orchestrator & Playbook Learner (ADR-009).
 *
 * 100% App-Agnostic & 100% Headless (zero DOM clicking).
 * Executes 1..6 chained capability steps behind the scenes regardless of the user's current screen,
 * supports variable chaining ($step1.createdId / $prev.createdId), halts safely on error (Rule 9),
 * and reinforces proven multi-step Playbooks using the Conductor learning pattern.
 */

import { agentActionRegistry } from './assistantActionRegistry';
import type {
  AgentActionPlan,
  AgentPlanExecutionReport,
  AgentPlanStep,
  AgentPlaybook,
} from './agentManifest';

const PLAYBOOK_STORAGE_PREFIX = 'universal_agent_playbooks_v1_';
const MAX_PLAYBOOKS_PER_APP = 12;

function normalizeIntentSignature(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

/**
 * Resolves chained references like "$step1.createdId" or "$prev.id" inside step params.
 */
function resolveChainedParams(
  params: Record<string, any>,
  stepOutputs: Array<Record<string, any> | undefined>
): Record<string, any> {
  const resolveValue = (val: any): any => {
    if (typeof val === 'string') {
      const prevMatch = val.match(/^\$prev\.([a-zA-Z0-9_]+)$/);
      if (prevMatch) {
        const prevData = stepOutputs[stepOutputs.length - 1];
        if (prevData && prevData[prevMatch[1]] !== undefined) {
          return prevData[prevMatch[1]];
        }
      }
      const stepMatch = val.match(/^\$step(\d+)\.([a-zA-Z0-9_]+)$/);
      if (stepMatch) {
        const idx = Number(stepMatch[1]) - 1;
        const data = stepOutputs[idx];
        if (data && data[stepMatch[2]] !== undefined) {
          return data[stepMatch[2]];
        }
      }
      return val;
    }
    if (Array.isArray(val)) return val.map(resolveValue);
    if (val && typeof val === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = resolveValue(v);
      }
      return out;
    }
    return val;
  };

  return resolveValue(params || {});
}

export function loadLearnedPlaybooks(appId: string): AgentPlaybook[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${PLAYBOOK_STORAGE_PREFIX}${appId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordSuccessfulPlaybook(
  appId: string,
  intentText: string,
  title: string,
  toolSequence: string[]
): void {
  if (typeof window === 'undefined' || toolSequence.length === 0) return;
  const sig = normalizeIntentSignature(intentText);
  if (sig.length < 4) return;

  try {
    const existing = loadLearnedPlaybooks(appId);
    const seqKey = toolSequence.join('->');
    const now = Date.now();
    const idx = existing.findIndex((p) => p.toolSequence.join('->') === seqKey && p.intentSignature === sig);

    if (idx >= 0) {
      existing[idx] = {
        ...existing[idx],
        score: Math.min(100, existing[idx].score + 12),
        uses: existing[idx].uses + 1,
        lastUsedAt: now,
      };
    } else {
      // Mild decay for older entries
      existing.forEach((p) => {
        p.score = Math.max(1, p.score - 2);
      });
      existing.push({
        id: `pb_${now}_${Math.random().toString(36).slice(2, 6)}`,
        appId,
        intentSignature: sig,
        title: title.slice(0, 80),
        toolSequence,
        score: 20,
        uses: 1,
        lastUsedAt: now,
      });
    }

    const trimmed = existing
      .sort((a, b) => b.score - a.score || b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_PLAYBOOKS_PER_APP);

    localStorage.setItem(`${PLAYBOOK_STORAGE_PREFIX}${appId}`, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Executes a multi-step Headless AgentActionPlan sequentially with chained outputs,
 * real-time per-step status callbacks, and strict stop-on-error (Rule 9: zero fake success).
 */
export async function executeAgentActionPlan(
  plan: AgentActionPlan,
  runtimeContext: Record<string, any>,
  options?: {
    intentText?: string;
    onStepProgress?: (steps: AgentPlanStep[]) => void;
  }
): Promise<AgentPlanExecutionReport> {
  const workingSteps: AgentPlanStep[] = plan.steps.map((s) => ({ ...s, status: 'pending' }));
  const stepOutputs: Array<Record<string, any> | undefined> = [];
  let completedSteps = 0;
  let finalProofUrl: string | undefined;
  let finalProofLabel: string | undefined;
  let finalWhatsappUrl: string | undefined;

  for (let i = 0; i < workingSteps.length; i++) {
    const step = workingSteps[i];
    step.status = 'running';
    options?.onStepProgress?.([...workingSteps]);

    const resolvedParams = resolveChainedParams(step.params, stepOutputs);
    // Only let the FINAL step trigger navigation so intermediate steps run 100% silently in the background!
    const isFinalStep = i === workingSteps.length - 1;
    const stepRuntimeCtx = {
      ...runtimeContext,
      suppressAutoNavigate: !isFinalStep,
    };

    const registered = agentActionRegistry.get(step.tool);
    const result = registered
      ? await registered.execute(resolvedParams, stepRuntimeCtx)
      : { success: false, message: `הכלי "${step.tool}" אינו רשום במערכת.` };

    if (!result.success) {
      step.status = 'failed';
      step.resultMessage = result.message;
      options?.onStepProgress?.([...workingSteps]);
      return {
        planId: plan.id,
        success: false,
        completedSteps,
        totalSteps: workingSteps.length,
        steps: [...workingSteps],
        finalMessage: `התוכנית נעצרה בשלב ${i + 1} (${step.label}): ${result.message}`,
        finalProofUrl,
        finalProofLabel,
      };
    }

    step.status = 'done';
    step.resultMessage = result.message;
    step.proofUrl = result.proofUrl;
    step.proofLabel = result.proofLabel;
    stepOutputs.push(result.data);
    completedSteps++;
    if (result.proofUrl) {
      finalProofUrl = result.proofUrl;
      finalProofLabel = result.proofLabel;
    }
    if (result.data?.whatsappUrl) {
      finalWhatsappUrl = String(result.data.whatsappUrl);
    }
    options?.onStepProgress?.([...workingSteps]);
  }

  if (options?.intentText && workingSteps.length > 0) {
    recordSuccessfulPlaybook(
      plan.appId || 'default',
      options.intentText,
      plan.title,
      workingSteps.map((s) => s.tool)
    );
  }

  const lastMessage = workingSteps[workingSteps.length - 1]?.resultMessage || 'כל השלבים הושלמו בהצלחה!';
  return {
    planId: plan.id,
    success: true,
    completedSteps,
    totalSteps: workingSteps.length,
    steps: [...workingSteps],
    finalMessage: lastMessage,
    finalProofUrl,
    finalProofLabel,
    finalWhatsappUrl,
  };
}
