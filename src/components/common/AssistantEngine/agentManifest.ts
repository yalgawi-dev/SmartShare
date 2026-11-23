/**
 * Headless Universal Agent OS — App-Agnostic Core Contracts (ADR-009).
 *
 * Zero knowledge of SmartShare, files, or folders. Any host application
 * (SmartShare today, CRM/ERP/Clinic/E-Commerce tomorrow) plugs in a thin
 * HostAppManifest declaring its entities, capabilities, and knowledge base.
 */

import type { ActionRiskLevel, AgentToolSchema } from './assistantActionRegistry';

export interface HostEntitySummary {
  kind: string; // e.g. 'space' | 'document' | 'folder' | 'customer' | 'quote' | 'invoice'
  label: string; // Human-readable Hebrew/display label
  description: string;
}

export interface HostAppManifest {
  appId: string; // e.g. 'smartshare' | 'crm-pro'
  appName: string;
  version: string;
  entities: HostEntitySummary[];
  capabilities: AgentToolSchema[];
  /** Optional host-specific Q&A / guide snippets for user explanations */
  knowledgeHints?: string[];
}

export type PlanStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface AgentPlanStep {
  id: string;
  tool: string;
  label: string;
  params: Record<string, any>;
  riskLevel?: ActionRiskLevel;
  status?: PlanStepStatus;
  resultMessage?: string;
  proofUrl?: string;
  proofLabel?: string;
}

export interface AgentActionPlan {
  id: string;
  appId: string;
  title: string;
  summary: string;
  steps: AgentPlanStep[];
  requiresConfirmation: boolean;
  riskLevel: ActionRiskLevel;
  matchedPlaybookUses?: number;
}

export interface AgentPlanExecutionReport {
  planId: string;
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  steps: AgentPlanStep[];
  finalMessage: string;
  finalProofUrl?: string;
  finalProofLabel?: string;
  finalWhatsappUrl?: string;
}

/**
 * Self-Learning Playbook record (Conductor pattern: reinforcement / decay / Top-K).
 * Stores proven multi-step headless workflows per host appId.
 */
export interface AgentPlaybook {
  id: string;
  appId: string;
  intentSignature: string;
  title: string;
  toolSequence: string[];
  score: number;
  uses: number;
  lastUsedAt: number;
}
