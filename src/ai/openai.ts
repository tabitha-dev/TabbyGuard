import type { ChangedFile } from '../schemas/change.js';
import type { Finding } from '../schemas/finding.js';
import { TestPlanSchema, type TestPlanItem } from '../schemas/test-plan.js';
import { slugify } from '../util/fs.js';

const planJsonSchema = {
  type: 'object', additionalProperties: false, required: ['testPlan'], properties: {
    testPlan: { type: 'array', minItems: 1, maxItems: 24, items: {
      type: 'object', additionalProperties: false,
      required: ['id', 'targetSurface', 'route', 'viewport', 'checkType', 'reason', 'changedFiles', 'selectors'],
      properties: {
        id: { type: 'string' }, targetSurface: { type: 'string' }, route: { type: ['string', 'null'] },
        viewport: { type: 'string', enum: ['mobile', 'tablet', 'desktop'] },
        checkType: { type: 'string', enum: ['runtime', 'network', 'accessibility', 'layout', 'interaction', 'keyboard'] },
        reason: { type: 'string' }, changedFiles: { type: 'array', items: { type: 'string' } },
        selectors: { type: 'array', items: { type: 'string' } }
      }
    }}
  }
} as const;

const enrichmentJsonSchema = {
  type: 'object', additionalProperties: false, required: ['enrichments'], properties: {
    enrichments: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['findingId', 'suggestedCause'], properties: {
        findingId: { type: 'string' }, suggestedCause: { type: 'string' }
      }
    }}
  }
} as const;

function extractResponseText(payload: any): string | undefined {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return undefined;
}

async function callStructuredResponse(options: {
  apiKey: string; model: string; schemaName: string; schema: unknown; system: string; user: unknown;
}): Promise<unknown> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      input: [
        { role: 'system', content: options.system },
        { role: 'user', content: JSON.stringify(options.user) }
      ],
      text: { format: { type: 'json_schema', name: options.schemaName, strict: true, schema: options.schema } }
    })
  });
  const payload = await response.json() as any;
  if (!response.ok) throw new Error(`OpenAI Responses API returned ${response.status}: ${JSON.stringify(payload).slice(0, 800)}`);
  const text = extractResponseText(payload);
  if (!text) throw new Error('OpenAI response did not contain structured output text.');
  return JSON.parse(text);
}

export async function createAssistedPlan(options: {
  apiKey: string; model: string; changedFiles: ChangedFile[]; routes: string[]; fallbackPlan: TestPlanItem[]; maxChecks: number;
}): Promise<TestPlanItem[]> {
  const raw = await callStructuredResponse({
    apiKey: options.apiKey, model: options.model, schemaName: 'tabbyguard_test_plan', schema: planJsonSchema,
    system: [
      'You are a senior frontend QA planner for TabbyGuard.',
      'Use only supplied changed files, bounded patch context, and allowed routes.',
      'Choose a small set of high-signal browser checks.',
      'Never plan destructive flows such as purchase, deletion, billing, account mutation, or real form submission.',
      'A missing selector is not a bug. The browser evidence engine decides whether a finding exists.'
    ].join('\n'),
    user: { allowedRoutes: options.routes, changedFiles: options.changedFiles, deterministicFallback: options.fallbackPlan }
  });
  const parsed = TestPlanSchema.parse(raw);
  const knownFiles = new Set(options.changedFiles.map((file) => file.filename));
  const allowedRoutes = new Set(options.routes);
  return parsed.testPlan.slice(0, options.maxChecks).map((item: TestPlanItem, index: number) => ({
    ...item,
    id: slugify(`${index}-${item.targetSurface}-${item.viewport}-${item.checkType}`),
    route: item.route && allowedRoutes.has(item.route) ? item.route : options.routes[0] ?? '/',
    changedFiles: item.changedFiles.filter((name: string) => knownFiles.has(name)),
    selectors: item.selectors.slice(0, 8)
  }));
}

export async function enrichFindings(options: {
  apiKey: string; model: string; findings: Finding[]; changedFiles: ChangedFile[];
}): Promise<Finding[]> {
  if (options.findings.length === 0) return options.findings;
  const raw = await callStructuredResponse({
    apiKey: options.apiKey, model: options.model, schemaName: 'tabbyguard_finding_enrichment', schema: enrichmentJsonSchema,
    system: [
      'You explain existing TabbyGuard findings.',
      'Refine only the suggested cause for a supplied finding ID.',
      'Do not add/remove findings or change severity/confidence. Do not claim facts not present in evidence.'
    ].join('\n'),
    user: { findings: options.findings, changedFiles: options.changedFiles }
  }) as any;
  const enrichments = new Map<string, string>();
  for (const item of raw?.enrichments ?? []) {
    if (typeof item?.findingId === 'string' && typeof item?.suggestedCause === 'string') enrichments.set(item.findingId, item.suggestedCause);
  }
  return options.findings.map((finding) => ({ ...finding, suggestedCause: enrichments.get(finding.id) ?? finding.suggestedCause }));
}
