// AI Assistant Provider Bridge (Pluggable Architecture)
// Designed for seamless transition from Local Free Knowledge Engine to External Cloud LLM (Gemini / OpenAI) as an optional premium add-on.

import { ScreenContext, queryAssistantBrain } from './assistantKnowledge';
import type { KnowledgeNode } from './assistantMatcher';

export type AIProviderType = 'local_free' | 'cloud_llm';

export interface AIProviderConfig {
  provider: AIProviderType;
  modelName?: string;
  isPremiumEnabled?: boolean;
}

/**
 * Standard interface for AI Provider response.
 */
export interface AIQueryResponse {
  text: string;
  source: 'local_brain' | 'cloud_llm';
  tokensUsed?: number;
  nodeId?: string;
  confidence?: 'high' | 'medium' | 'low';
  suggestions?: KnowledgeNode[];
}

/**
 * Pluggable gateway function that handles queries.
 * Defaults to the 100% Free Local Knowledge Engine.
 * When premium is enabled, it bridges seamlessly to a cloud LLM endpoint.
 */
export async function queryAIAssistant(
  query: string,
  context: ScreenContext,
  config: AIProviderConfig = { provider: 'local_free' }
): Promise<AIQueryResponse> {
  // 1. If configured for external cloud LLM and user has premium feature enabled
  if (config.provider === 'cloud_llm' && config.isPremiumEnabled) {
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context: {
            route: context.route,
            activeWidget: context.activeWidget,
            spaceTitle: context.spaceTitle,
            currentFolderName: context.currentFolderName,
            activeModal: context.activeModal,
            userRole: context.userRole
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.answer) {
          return {
            text: data.answer,
            source: 'cloud_llm',
            tokensUsed: data.tokensUsed
          };
        }
      }
    } catch (err) {
      console.warn('Cloud LLM query failed, gracefully falling back to local brain:', err);
    }
  }

  // 2. Default: 100% Free Local Knowledge Brain (0 cost, fast, private, offline-capable)
  const localResult = queryAssistantBrain(query, context);
  return {
    text: localResult.answer,
    source: 'local_brain',
    nodeId: localResult.relatedTopicId,
    confidence: localResult.confidence,
    suggestions: localResult.suggestions
  };
}
