/**
 * Generic Pluggable Agent Action Registry & Protocol (Layer 1 — App-Agnostic SDK).
 *
 * Designed so ANY host application (MySpace today, or any future app where this
 * assistant widget is embedded) can register its own business actions dynamically
 * at runtime. The AI reads the registered tool schemas automatically—zero hardcoding
 * of host-specific actions inside the core engine.
 */

export type ActionRiskLevel = 'low' | 'medium' | 'high';

export interface AgentToolSchema {
  name: string;
  description: string;
  riskLevel: ActionRiskLevel;
  requiresConfirmation: boolean;
  parameters: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'string[]';
    description: string;
    required?: boolean;
  }>;
}

export interface AgentActionProposal {
  id: string;
  tool: string;
  title: string;
  summary: string;
  details: string[];
  params: Record<string, any>;
  riskLevel: ActionRiskLevel;
  requiresConfirmation: boolean;
}

export interface AgentActionExecutionResult {
  success: boolean;
  message: string;
  proofUrl?: string;
  proofLabel?: string;
}

export type AgentToolHandler = (
  params: Record<string, any>,
  runtimeContext: Record<string, any>
) => Promise<AgentActionExecutionResult>;

export interface RegisteredAgentTool {
  schema: AgentToolSchema;
  execute: AgentToolHandler;
}

/**
 * Singleton Pluggable Action Registry (Single Source of Truth).
 * Host applications register their domain tools here; the core AssistantEngine
 * also registers universal DOM UI tools automatically.
 */
class AgentActionRegistry {
  private tools = new Map<string, RegisteredAgentTool>();

  register(tool: RegisteredAgentTool): void {
    this.tools.set(tool.schema.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): RegisteredAgentTool | undefined {
    return this.tools.get(name);
  }

  listSchemas(): AgentToolSchema[] {
    return Array.from(this.tools.values()).map((t) => t.schema);
  }
}

export const agentActionRegistry = new AgentActionRegistry();
