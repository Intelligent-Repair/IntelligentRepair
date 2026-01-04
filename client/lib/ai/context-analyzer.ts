// lib/ai/context-analyzer.ts
import { SAFETY_RULES } from '@/lib/knowledge/safety-rules';
import carSymptomsData from '@/lib/knowledge/car-symptoms.json';
import warningLightsKB from '@/lib/knowledge/warning-lights.json';
import type { SafetyRule } from '@/lib/types/knowledge';

export type LightSeverity = 'danger' | 'caution';

export type AnalysisResult =
  | { type: 'SAFETY_STOP'; rule: SafetyRule }
  | { type: 'WARNING_LIGHT'; lightId: string; severity: LightSeverity }
  | { type: 'START_SCENARIO'; scenarioId: string }
  | { type: 'CONSULT_AI' };

const NEGATION_WORDS = ['לא', 'אין', 'בלי', 'ללא', 'אף'];

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[״"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Keyword match with a small "negation window" just before the match.
 * Prevents false triggers like: "אין עשן".
 */
function containsNonNegatedKeyword(text: string, keyword: string): boolean {
  const t = normalizeText(text);
  const k = normalizeText(keyword);
  if (!t || !k) return false;

  const hasNegationNearEnd = (prefix: string): boolean => {
    // check last ~3 words only, exact-word match (prevents "לאחר" triggering "לא")
    const words = prefix.split(' ').filter(Boolean);
    const tail = words.slice(-3);
    return tail.some(w => NEGATION_WORDS.includes(w));
  };

  let idx = t.indexOf(k);
  while (idx !== -1) {
    const windowStart = Math.max(0, idx - 20);
    const prefix = t.slice(windowStart, idx).trim();
    const isNegated = hasNegationNearEnd(prefix);
    if (!isNegated) return true;
    idx = t.indexOf(k, idx + 1);
  }

  return false;
}

function toLightSeverity(raw: unknown): LightSeverity {
  // KB may contain: critical | high | moderate | medium | low | caution
  const s = String(raw || '').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'danger') return 'danger';
  return 'caution';
}

/**
 * Anti-Gravity helper: Safety scan only.
 * Use this in route.ts even when mid-flow, so you don't re-detect a light/scenario.
 */
export function analyzeSafetyOnly(text: string): SafetyRule | null {
  const t = normalizeText(text);
  if (!t) return null;

  for (const rule of SAFETY_RULES) {
    for (const kw of rule.keywords) {
      if (containsNonNegatedKeyword(t, kw)) return rule;
    }
  }
  return null;
}

/**
 * Full analysis: Safety -> symptom mapping -> direct warning-light name match -> AI fallback
 */
export function analyzeUserContext(text: string): AnalysisResult {
  const t = normalizeText(text);
  if (!t) return { type: 'CONSULT_AI' };

  // 1) Safety First
  const safetyRule = analyzeSafetyOnly(t);
  if (safetyRule) {
    console.log(`[Analyzer] 🚨 SAFETY TRIGGERED: ${safetyRule.id}`);
    return { type: 'SAFETY_STOP', rule: safetyRule };
  }

  // 2) Symptom mappings (car-symptoms.json)
  const symptoms = (carSymptomsData as any)?.symptoms ?? [];
  for (const group of symptoms) {
    const mappings = group?.mappings ?? [];
    for (const mapping of mappings) {
      const keywords: string[] = mapping?.keywords ?? [];
      for (const kw of keywords) {
        if (!containsNonNegatedKeyword(t, kw)) continue;

        if (mapping.type === 'light') {
          const lightId: string = mapping.targetId;
          const lightData = (warningLightsKB as any)?.[lightId];
          console.log(`[Analyzer] 💡 SYMPTOM->LIGHT: ${lightId}`);
          return { type: 'WARNING_LIGHT', lightId, severity: toLightSeverity(lightData?.severity) };
        }

        if (mapping.type === 'scenario') {
          console.log(`[Analyzer] 🌳 SYMPTOM->SCENARIO: ${mapping.targetId}`);
          return { type: 'START_SCENARIO', scenarioId: mapping.targetId };
        }

        if (mapping.type === 'safety') {
          const rule = SAFETY_RULES.find(r => r.id === mapping.targetId);
          if (rule) {
            console.log(`[Analyzer] 🛑 SYMPTOM->SAFETY: ${rule.id}`);
            return { type: 'SAFETY_STOP', rule };
          }
        }
      }
    }
  }

  // 3) Direct match by warning light names (warning-lights.json)
  for (const [id, data] of Object.entries(warningLightsKB as any)) {
    const he: string[] = (data as any)?.names?.he ?? [];
    const en: string[] = (data as any)?.names?.en ?? [];
    const names = [...he, ...en];

    if (names.some(name => containsNonNegatedKeyword(t, name))) {
      console.log(`[Analyzer] 💡 DIRECT LIGHT MATCH: ${id}`);
      return { type: 'WARNING_LIGHT', lightId: id, severity: toLightSeverity((data as any)?.severity) };
    }
  }

  // 4) Fallback to AI
  console.log('[Analyzer] ❓ No match. Routing to AI.');
  return { type: 'CONSULT_AI' };
}
