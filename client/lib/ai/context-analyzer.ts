// lib/ai/context-analyzer.ts
import { SAFETY_RULES } from '@/lib/knowledge/safety-rules';
import carSymptomsData from '@/lib/knowledge/car-symptoms.json';
import warningLightsKB from '@/lib/knowledge/warning-lights.json';
import type { SafetyRule, SymptomMapping } from '@/lib/types/knowledge';

export type LightSeverity = 'danger' | 'caution';

/**
 * תוצאת ניתוח הקשר - מה לעשות עם הקלט של המשתמש
 */
export type AnalysisResult =
  | { type: 'SAFETY_STOP'; rule: SafetyRule }
  | { type: 'WARNING_LIGHT'; lightId: string; severity: LightSeverity }
  | { type: 'SYMPTOM_MATCH'; symptom: SymptomMapping; category: string }
  | { type: 'START_SCENARIO'; scenarioId: string }
  | { type: 'CONSULT_AI' };

// Negation words
const NEGATION_WORDS = ['לא', 'אין', 'בלי', 'ללא', 'אף', 'never', 'no', 'not', 'without'];

// Triggers that indicate user is reporting a dashboard light (not just a symptom)
const LIGHT_REPORT_TRIGGERS = ['נורה', 'נורית', 'חיווי', 'נדלקה', 'נדלק', 'לוח שעונים', 'דשבורד', 'סמל', 'אזהרה', 'warning', 'light', 'indicator', 'dashboard'];

// Text normalization
function normalizeText(input: string): string {
  return (input ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tokenize text into words
function tokenize(t: string): string[] {
  return normalizeText(t).split(' ').filter(Boolean);
}

// Match phrase on token boundaries
function hasPhrase(tokens: string[], phrase: string): boolean {
  const p = tokenize(phrase);
  if (!p.length) return false;
  if (p.length === 1) return tokens.includes(p[0]);
  for (let i = 0; i <= tokens.length - p.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (tokens[i + j] !== p[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

// Find phrase index for negation check
function findPhraseIndex(tokens: string[], phrase: string): number {
  const p = tokenize(phrase);
  if (!p.length) return -1;
  if (p.length === 1) return tokens.indexOf(p[0]);
  for (let i = 0; i <= tokens.length - p.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (tokens[i + j] !== p[j]) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
}

// Check if match is negated (negation word within 3 tokens before)
function isNegated(tokens: string[], matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - 3);
  for (let i = start; i < matchIndex; i++) {
    if (NEGATION_WORDS.includes(tokens[i])) return true;
  }
  return false;
}

// Check if phrase exists and is not negated
function containsNonNegated(tokens: string[], phrase: string): boolean {
  const idx = findPhraseIndex(tokens, phrase);
  if (idx === -1) return false;
  return !isNegated(tokens, idx);
}

// Check if user is reporting a light (not just describing a symptom)
function hasLightReport(tokens: string[]): boolean {
  return LIGHT_REPORT_TRIGGERS.some(tr => containsNonNegated(tokens, tr));
}

// Severity mapping
function toLightSeverity(raw: unknown): LightSeverity {
  const v = String(raw ?? '').toLowerCase();
  if (v === 'danger' || v === 'critical' || v === 'high' || v === 'severe') return 'danger';
  return 'caution';
}

/**
 * Safety scan only (for mid-flow checks in route.ts)
 */
export function analyzeSafetyOnly(text: string): SafetyRule | null {
  const tokens = tokenize(text);
  if (!tokens.length) return null;

  for (const rule of SAFETY_RULES) {
    for (const kw of rule.keywords) {
      if (containsNonNegated(tokens, kw)) {
        console.log(`[Safety] 🚨 Rule triggered: ${rule.id} by keyword: "${kw}" | Level: ${rule.level}`);
        return rule;
      }
    }
  }
  return null;
}

/**
 * Full analysis: Safety -> Direct light match -> Symptom mapping -> AI fallback
 */
export function analyzeUserContext(text: string): AnalysisResult {
  const tokens = tokenize(text);
  if (!tokens.length) return { type: 'CONSULT_AI' };

  // A) SAFETY FIRST
  const safetyRule = analyzeSafetyOnly(text);
  if (safetyRule) {
    return { type: 'SAFETY_STOP', rule: safetyRule };
  }

  // B) DIRECT LIGHT MATCH (by name from KB)
  for (const [id, data] of Object.entries(warningLightsKB as any)) {
    const he: string[] = (data as any)?.names?.he ?? [];
    const en: string[] = (data as any)?.names?.en ?? [];
    const names = [...he, ...en];

    for (const name of names) {
      if (containsNonNegated(tokens, name)) {
        return { type: 'WARNING_LIGHT', lightId: id, severity: toLightSeverity((data as any)?.severity) };
      }
    }
  }

  // C) SYMPTOM MAPPINGS (car-symptoms.json)
  const symptoms = (carSymptomsData as any)?.symptoms ?? [];
  for (const group of symptoms) {
    const categoryName = group?.category ?? 'unknown';
    const mappings = group?.mappings ?? [];
    for (const mapping of mappings) {
      const keywords: string[] = mapping?.keywords ?? [];

      for (const kw of keywords) {
        if (!containsNonNegated(tokens, kw)) continue;

        // C1: Scenario mapping -> CONSULT_AI (let AI handle symptoms, not KB scenarios)
        // This ensures symptoms like "רכב נכבה באמצע נסיעה" get AI-generated questions
        if (mapping.type === 'scenario') {
          return { type: 'CONSULT_AI' };
        }

        // C2: Safety mapping -> SAFETY_STOP
        if (mapping.type === 'safety') {
          const rule = SAFETY_RULES.find(r => r.id === mapping.targetId);
          if (rule) {
            return { type: 'SAFETY_STOP', rule };
          }
        }

        // C3: General symptom mapping -> SYMPTOM_MATCH (NEW!)
        // Returns the symptom with first_questions for KB-driven flow
        if (mapping.type === 'symptom') {
          return {
            type: 'SYMPTOM_MATCH',
            symptom: mapping as SymptomMapping,
            category: categoryName
          };
        }

        // C4: Light mapping -> only if user reports a light indicator
        if (mapping.type === 'light') {
          const lightId: string = mapping.targetId;

          // Only route to WARNING_LIGHT if user explicitly mentioned a light/indicator
          if (hasLightReport(tokens)) {
            const lightData = (warningLightsKB as any)?.[lightId];
            return { type: 'WARNING_LIGHT', lightId, severity: toLightSeverity(lightData?.severity) };
          }

          // Otherwise: symptom matches but no light report -> go to AI
          // (e.g., "ריח שמן" without "נורה" should not trigger KB flow)
          return { type: 'CONSULT_AI' };
        }
      }
    }
  }

  // D) FALLBACK
  return { type: 'CONSULT_AI' };
}
