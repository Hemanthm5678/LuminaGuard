import { NextRequest, NextResponse } from 'next/server';

interface WebElement {
  id: number;
  text_content: string;
}

interface AuditRequest {
  url: string;
  elements: WebElement[];
}

interface Rule {
  type: string;
  name: string;
  explanation: string;
  weight: number;
  patterns: RegExp[];
}

const OFFICIAL_BRANDS: Record<string, string[]> = {
  ajio: ['ajio.com'],
  amazon: ['amazon.com', 'amazon.in'],
  flipkart: ['flipkart.com'],
  myntra: ['myntra.com'],
  shein: ['shein.com'],
};

const RULES: Rule[] = [
  {
    type: 'fake_urgency',
    name: 'Fake Urgency',
    explanation: 'Artificial scarcity or time pressure language was detected.',
    weight: 25,
    patterns: [
      /only \d+ left/i,
      /limited time/i,
      /hurry/i,
      /act now/i,
      /last chance/i,
      /ending soon/i,
      /selling fast/i,
      /today only/i,
      /limited (stock|availability|quantity)/i,
      /\d+ (people|users|customers) (are )?(viewing|watching|looking)/i,
    ],
  },
  {
    type: 'countdown_timer',
    name: 'Countdown Timer',
    explanation: 'A timer-like pattern was detected.',
    weight: 20,
    patterns: [/\b\d{1,2}:\d{2}(:\d{2})?\b/],
  },
  {
    type: 'misleading_buttons',
    name: 'Misleading Button',
    explanation: 'Button text may steer users toward a preferred action.',
    weight: 25,
    patterns: [/no,?\s*(thanks|thank you)/i, /maybe later/i, /skip/i, /not now/i, /decline/i, /accept/i, /claim/i, /unlock/i],
  },
  {
    type: 'suspicious_pricing',
    name: 'Suspicious Pricing',
    explanation: 'Discount framing or price anchoring language was detected.',
    weight: 15,
    patterns: [/was \$?\d+/i, /save \d+%/i, /\d+% off/i, /originally \$?\d+/i, /compare at/i],
  },
  {
    type: 'hidden_costs',
    name: 'Hidden Costs',
    explanation: 'Fee or late-stage cost language was detected.',
    weight: 20,
    patterns: [/service fee/i, /handling fee/i, /processing fee/i, /convenience fee/i, /delivery fee/i, /shipping calculated/i, /\+ tax/i, /fees may apply/i],
  },
  {
    type: 'confirmshaming',
    name: 'Confirmshaming',
    explanation: 'Decline copy may use guilt or shame.',
    weight: 35,
    patterns: [/no,?\s*i (don'?t )?(want to )?(hate|dislike)/i, /i (don'?t )?like (paying|spending) full/i, /i prefer to (miss|lose|ignore)/i],
  },
  {
    type: 'forced_continuity',
    name: 'Forced Continuity',
    explanation: 'Subscription, renewal, or trial-trap language was detected.',
    weight: 20,
    patterns: [/auto(-|\s)?renew/i, /automatically (renew|charge|bill)/i, /recurring (charge|payment|billing)/i, /free trial/i, /credit card required/i, /billing (starts|begins)/i],
  },
];

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function hostMatches(hostname: string, officialHost: string): boolean {
  return hostname === officialHost || hostname.endsWith(`.${officialHost}`);
}

function detectClone(url: string): { isFake: boolean; originalUrl: string } {
  const hostname = normalizeHost(new URL(url).hostname);

  for (const [brand, officialHosts] of Object.entries(OFFICIAL_BRANDS)) {
    const looksLikeBrand = hostname.includes(brand);
    const isOfficial = officialHosts.some((officialHost) => hostMatches(hostname, officialHost));

    if (looksLikeBrand && !isOfficial) {
      return { isFake: true, originalUrl: `https://www.${officialHosts[0]}` };
    }
  }

  return { isFake: false, originalUrl: '' };
}

function analyzeElements(elements: WebElement[]) {
  const findings: Array<{
    id: number;
    type: string;
    name: string;
    explanation: string;
    law: string;
    text: string;
    confidence: number;
  }> = [];
  const typeCounts: Record<string, number> = {};
  const seen = new Set<string>();

  for (const element of elements) {
    const text = element.text_content.trim();
    if (!text) continue;

    for (const rule of RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(text))) continue;

      const key = `${element.id}:${rule.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      typeCounts[rule.type] = (typeCounts[rule.type] || 0) + 1;

      findings.push({
        id: element.id,
        type: rule.type,
        name: rule.name,
        explanation: rule.explanation,
        law: 'Dark Pattern Detector heuristic rule',
        text: text.slice(0, 160),
        confidence: Math.min(98, 68 + rule.weight),
      });
    }
  }

  const score = Object.entries(typeCounts).reduce((total, [type, count]) => {
    const rule = RULES.find((entry) => entry.type === type);
    if (!rule) return total;
    return total + rule.weight + Math.min(count - 1, 3) * 5;
  }, 0);

  return {
    findings,
    score: Math.min(100, score),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AuditRequest;

    if (!body.url || !Array.isArray(body.elements)) {
      return NextResponse.json({ error: 'Missing required fields: url and elements' }, { status: 400 });
    }

    const clone = detectClone(body.url);
    const analysis = analyzeElements(body.elements);
    const integrityScore = clone.isFake ? 100 : analysis.score;

    return NextResponse.json({
      is_fake: clone.isFake,
      original_url: clone.originalUrl,
      integrity_score: integrityScore,
      verdict: integrityScore > 70 ? 'MALICIOUS' : integrityScore > 25 ? 'SUSPICIOUS' : 'SAFE',
      findings: analysis.findings,
      engine: 'integrated-next-analyzer',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to analyze site';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
