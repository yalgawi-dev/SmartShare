import { SMARTSHARE_GRAPH } from './assistantGraph';
import { matchKnowledgeGraph, type KnowledgeGraph, type KnowledgeNode } from './assistantMatcher';

export interface ScreenContext {
  route: string;
  spaceId?: string;
  spaceTitle?: string;
  currentFolderId?: string | null;
  currentFolderName?: string;
  activeWidget?: 'fileshare' | 'documents' | 'accounting' | 'scanner' | 'partners' | 'gallery' | 'general';
  activeModal?: 'share' | 'move' | 'recycle_bin' | 'privacy' | 'invite' | null;
  userRole?: 'creator' | 'admin' | 'partner' | 'guest';
}

/**
 * Queries a KnowledgeGraph (defaults to SmartShare's Living Twin graph, or any
 * external site graph injected later when packaged as a standalone widget).
 */
export function queryAssistantBrain(
  query: string,
  context: ScreenContext,
  graph: KnowledgeGraph = SMARTSHARE_GRAPH
): { answer: string; relatedTopicId?: string; confidence: 'high' | 'medium' | 'low'; suggestions: KnowledgeNode[] } {
  const result = matchKnowledgeGraph(graph, query, context);
  return {
    answer: result.answer,
    relatedTopicId: result.node?.id,
    confidence: result.confidence,
    suggestions: result.suggestions
  };
}

/**
 * Computes context-aware quick question chips based on where the user currently is.
 */
export function getContextSuggestions(
  context: ScreenContext,
  graph: KnowledgeGraph = SMARTSHARE_GRAPH
): string[] {
  const result = matchKnowledgeGraph(graph, '', context);
  const byContext = graph.nodes.filter((n) => {
    if (context.activeModal && n.modals?.includes(context.activeModal)) return true;
    if (context.activeWidget && context.activeWidget !== 'general' && n.widgets?.includes(context.activeWidget)) return true;
    if (context.route && n.routePatterns?.some((p) => (p === '/' ? context.route === '/' : context.route.startsWith(p)))) return true;
    return false;
  });

  const list = (byContext.length > 0 ? byContext : result.suggestions).slice(0, 3);
  return list.map((n) => n.sampleQuestion);
}
