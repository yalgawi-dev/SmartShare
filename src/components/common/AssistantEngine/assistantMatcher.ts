import type { ScreenContext } from './assistantKnowledge';

/**
 * Generic Knowledge Graph contracts — decoupled from SmartShare so any external
 * website or app can plug in its own KnowledgeGraph later.
 */
export interface KnowledgeNode {
  id: string;
  title: string;
  domain: string;
  /** Route prefixes or patterns where this node is directly relevant (e.g. '/space', '/settings'). */
  routePatterns?: string[];
  /** Active widget keys where this node should receive a strong context boost. */
  widgets?: Array<NonNullable<ScreenContext['activeWidget']>>;
  /** Active modal keys where this node is the exact focus. */
  modals?: Array<NonNullable<ScreenContext['activeModal']>>;
  keywords: string[];
  /** Everyday Hebrew/English synonyms and user phrasings. */
  synonyms: string[];
  explanation: string;
  /** Natural example question shown in context chips or disambiguation. */
  sampleQuestion: string;
  /** Connected node IDs (neural edges) for follow-up navigation & fallback suggestions. */
  edges: string[];
}

export interface KnowledgeGraph {
  appName: string;
  version: string;
  nodes: KnowledgeNode[];
}

const HEBREW_PREFIXES = ['ה', 'ב', 'ל', 'מ', 'ש', 'כ', 'ו'];

/** Normalizes Hebrew/English text and expands simple prefix-stripped stems. */
export function tokenizeQuery(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/["'״׳?!.,:;()\-_/\\]/g, ' ')
    .trim();
  if (!cleaned) return [];

  const tokens = new Set<string>();
  for (const raw of cleaned.split(/\s+/)) {
    if (raw.length < 2) continue;
    tokens.add(raw);
    if (/^[\u0590-\u05FF]+$/.test(raw) && raw.length >= 4 && HEBREW_PREFIXES.includes(raw[0])) {
      tokens.add(raw.slice(1));
    }
  }
  return Array.from(tokens);
}

function isNodeInContext(node: KnowledgeNode, context: ScreenContext): boolean {
  if (context.activeModal && node.modals?.includes(context.activeModal)) return true;
  if (context.activeWidget && node.widgets?.includes(context.activeWidget)) return true;
  if (context.route && node.routePatterns?.some((p) => (p === '/' ? context.route === '/' : context.route.startsWith(p)))) {
    return true;
  }
  return false;
}

export interface MatchResult {
  node: KnowledgeNode | null;
  confidence: 'high' | 'medium' | 'low';
  suggestions: KnowledgeNode[];
  answer: string;
}

/**
 * Pure generic graph matcher:
 * 1. Scores every node on keyword + synonym + title token overlap.
 * 2. Applies a Context Boost if the node matches the user's current screen/widget/modal,
 *    narrowing ambiguous questions ("איך משתפים?") to where the user actually is,
 *    while still allowing strong general questions to win across the whole app.
 */
export function matchKnowledgeGraph(
  graph: KnowledgeGraph,
  query: string,
  context: ScreenContext
): MatchResult {
  const queryTokens = tokenizeQuery(query);
  const lowerQuery = query.toLowerCase();

  const scored = graph.nodes.map((node) => {
    let semanticScore = 0;

    if (lowerQuery.includes(node.title.toLowerCase())) semanticScore += 6;

    for (const kw of node.keywords) {
      const k = kw.toLowerCase();
      if (lowerQuery.includes(k)) {
        semanticScore += k.includes(' ') ? 5 : 3;
      } else if (queryTokens.some((t) => t === k || (t.length >= 3 && k.includes(t)))) {
        semanticScore += 2;
      }
    }

    for (const syn of node.synonyms) {
      const s = syn.toLowerCase();
      if (lowerQuery.includes(s)) {
        semanticScore += 3;
      } else if (queryTokens.some((t) => t === s)) {
        semanticScore += 2;
      }
    }

    const inContext = isNodeInContext(node, context);
    // Boost only if there is at least some semantic signal, or slightly to break ties
    const contextBoost = inContext ? (semanticScore > 0 ? 4 : 0.5) : 0;

    return {
      node,
      semanticScore,
      totalScore: semanticScore + contextBoost,
      inContext
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  const top = scored[0];

  if (top && top.semanticScore >= 4) {
    const edgeNodes = top.node.edges
      .map((id) => graph.nodes.find((n) => n.id === id))
      .filter((n): n is KnowledgeNode => Boolean(n))
      .slice(0, 3);

    return {
      node: top.node,
      confidence: 'high',
      suggestions: edgeNodes,
      answer: top.node.explanation
    };
  }

  if (top && top.semanticScore >= 2) {
    const edgeNodes = top.node.edges
      .map((id) => graph.nodes.find((n) => n.id === id))
      .filter((n): n is KnowledgeNode => Boolean(n))
      .slice(0, 3);

    return {
      node: top.node,
      confidence: 'medium',
      suggestions: edgeNodes,
      answer: top.node.explanation
    };
  }

  // Low confidence — do NOT hallucinate; suggest the most relevant nodes for this screen
  const contextNodes = graph.nodes.filter((n) => isNodeInContext(n, context)).slice(0, 3);
  const fallbackList = contextNodes.length > 0 ? contextNodes : graph.nodes.slice(0, 3);
  const optionsText = fallbackList.map((n, i) => `${i + 1}. ${n.sampleQuestion}`).join('\n');

  return {
    node: null,
    confidence: 'low',
    suggestions: fallbackList,
    answer: `לא זיהיתי בוודאות למה התכוונת (ואני מעדיף לא לנחש). אולי התכוונת לאחד מאלה במסך הנוכחי?\n${optionsText}`
  };
}
