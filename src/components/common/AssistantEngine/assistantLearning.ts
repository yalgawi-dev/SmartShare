import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_VERSION } from '@/constants/version';
import type { ScreenContext } from './assistantKnowledge';

export interface AssistantLearningEvent {
  type: 'unresolved' | 'feedback';
  queryText: string;
  matchedNodeId?: string;
  confidence?: 'high' | 'medium' | 'low';
  rating?: 'helpful' | 'not_helpful';
  route: string;
  activeWidget?: string;
  appVersion: string;
  timestamp: number;
}

const LOCAL_LOG_KEY = 'smartshare_assistant_learning_logs';

/**
 * Records unresolved queries and user feedback (👍 / 👎) non-blockingly
 * so the architect can see gaps in the Knowledge Graph and expand it.
 */
export async function logAssistantLearningEvent(
  params: Omit<AssistantLearningEvent, 'appVersion' | 'timestamp' | 'route' | 'activeWidget'>,
  context: ScreenContext
): Promise<void> {
  const entry: AssistantLearningEvent = {
    ...params,
    route: context.route || '/',
    activeWidget: context.activeWidget || 'general',
    appVersion: APP_VERSION,
    timestamp: Date.now()
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_LOG_KEY) || '[]');
      const next = [...(Array.isArray(existing) ? existing : []).slice(-49), entry];
      localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }

  try {
    await addDoc(collection(db, 'assistant_learning_logs'), entry);
  } catch {
    // Non-blocking: guest or offline sessions still keep local log
  }
}
