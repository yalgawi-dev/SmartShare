/**
 * Headless Universal Agent OS — Pluggable Host Bridge (ADR-009 Phase 3).
 *
 * Strict Decoupling (Rule 16): The core AssistantEngine talks ONLY to this bridge.
 * Today SmartShare registers its adapter; tomorrow a CRM (Quotes/Invoices/Delivery Notes)
 * or Clinic app registers its own adapter without changing a single line in the core engine.
 */

import type { HostAppManifest } from './agentManifest';

export interface RegisteredHostAdapter {
  appId: string;
  getManifest: () => HostAppManifest;
  registerPrimitives: () => void;
}

let activeHostAdapter: RegisteredHostAdapter | null = null;

export function registerHostAdapter(adapter: RegisteredHostAdapter): void {
  activeHostAdapter = adapter;
  adapter.registerPrimitives();
}

export function getActiveHostAdapter(): RegisteredHostAdapter | null {
  return activeHostAdapter;
}

export function getActiveHostManifest(): HostAppManifest | null {
  return activeHostAdapter ? activeHostAdapter.getManifest() : null;
}
