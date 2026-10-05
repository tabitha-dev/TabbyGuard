import type { Evidence } from '../schemas/finding.js';
import type { CheckStatus } from '../schemas/run-summary.js';
import type { TestPlanItem } from '../schemas/test-plan.js';

export type ConsoleRecord = { type: string; text: string; location?: string };
export type NetworkFailure = { url: string; method: string; failureText?: string; status?: number };
export type AxeViolation = { id: string; impact?: string | null; description?: string; help?: string; nodes: number };
export type LayoutObservation = {
  hasHorizontalOverflow: boolean;
  documentWidth: number;
  viewportWidth: number;
  offenders: { selector: string; width: number; left: number; right: number; text?: string }[];
};
export type InteractionObservation = {
  status: CheckStatus;
  kind: 'navigation' | 'dialog' | 'form' | 'generic';
  attempted: string[];
  failures: string[];
  reason: string;
  focusBefore?: string;
  focusAfter?: string;
};
export type KeyboardObservation = {
  status: CheckStatus;
  focusSequence: string[];
  reason: string;
};

export type BrowserCheckResult = {
  item: TestPlanItem;
  url: string;
  status: CheckStatus;
  durationMs: number;
  consoleMessages: ConsoleRecord[];
  pageErrors: string[];
  networkFailures: NetworkFailure[];
  axeViolations: AxeViolation[];
  layout?: LayoutObservation;
  interaction?: InteractionObservation;
  keyboard?: KeyboardObservation;
  evidence: Evidence[];
  notes: string[];
};

export type BrowserRunOptions = {
  previewUrl: string;
  artifactDir: string;
  testPlan: TestPlanItem[];
  browserChannel: string;
};
