import type { Report } from './db';

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface UrlSafetySignal {
  label: string;
  description: string;
  severity: SignalSeverity;
  weight: number;
}

export interface UrlSafetyResult {
  inputUrl: string;
  normalizedUrl: string;
  hostname: string;
  safetyScore: number;
  riskLevel: 'Safe' | 'Caution' | 'Risky' | 'Dangerous';
  spamRecords: number;
  localReports: number;
  darkPatternRecords: number;
  averageDarkPatternScore: number;
  signals: UrlSafetySignal[];
  analytics: {
    protocol: string;
    tld: string;
    hostLength: number;
    subdomainCount: number;
    digitCount: number;
    hyphenCount: number;
    suspiciousKeywordCount: number;
    impersonatedBrand: string | null;
  };
}

const OFFICIAL_BRANDS: Record<string, string[]> = {
  ajio: ['ajio.com'],
  amazon: ['amazon.com', 'amazon.in'],
  flipkart: ['flipkart.com'],
  myntra: ['myntra.com'],
  shein: ['shein.com'],
};

const SUSPICIOUS_TLDS = new Set([
  'bid',
  'cam',
  'cf',
  'click',
  'country',
  'cyou',
  'gq',
  'icu',
  'loan',
  'ml',
  'mov',
  'quest',
  'rest',
  'tk',
  'top',
  'work',
  'xyz',
  'zip',
]);

const SUSPICIOUS_KEYWORDS = [
  'account',
  'bonus',
  'claim',
  'free',
  'gift',
  'login',
  'offer',
  'payment',
  'prize',
  'secure',
  'update',
  'verify',
  'wallet',
  'winner',
];

function normalizeInput(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Enter a website URL to check.');
  }

  try {
    return new URL(trimmed);
  } catch {
    return new URL(`https://${trimmed}`);
  }
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function getTld(hostname: string): string {
  const parts = hostname.split('.').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

function isIpAddress(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
}

function isOfficialBrandHost(hostname: string, officialHost: string): boolean {
  return hostname === officialHost || hostname.endsWith(`.${officialHost}`);
}

function findImpersonatedBrand(hostname: string): string | null {
  const normalized = normalizeHost(hostname);

  for (const [brand, officialHosts] of Object.entries(OFFICIAL_BRANDS)) {
    if (normalized.includes(brand) && !officialHosts.some((officialHost) => isOfficialBrandHost(normalized, officialHost))) {
      return brand;
    }
  }

  return null;
}

function getRelevantReports(hostname: string, reports: Report[]): Report[] {
  const normalized = normalizeHost(hostname);

  return reports.filter((report) => {
    const reportHost = normalizeHost(report.hostname);
    return normalized === reportHost || normalized.endsWith(`.${reportHost}`) || reportHost.endsWith(`.${normalized}`);
  });
}

function getRiskLevel(safetyScore: number): UrlSafetyResult['riskLevel'] {
  if (safetyScore >= 85) return 'Safe';
  if (safetyScore >= 70) return 'Caution';
  if (safetyScore >= 50) return 'Risky';
  return 'Dangerous';
}

export function analyzeUrlSafety(inputUrl: string, reports: Report[]): UrlSafetyResult {
  const url = normalizeInput(inputUrl);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https URLs can be checked.');
  }

  const hostname = normalizeHost(url.hostname);
  const relevantReports = getRelevantReports(hostname, reports);
  const darkPatternRecords = relevantReports.reduce((total, report) => total + report.patterns.length, 0);
  const averageDarkPatternScore =
    relevantReports.length > 0
      ? Math.round(relevantReports.reduce((total, report) => total + report.score, 0) / relevantReports.length)
      : 0;
  const signals: UrlSafetySignal[] = [];

  function addSignal(label: string, description: string, severity: SignalSeverity, weight: number) {
    signals.push({ label, description, severity, weight });
  }

  if (url.protocol !== 'https:') {
    addSignal('Insecure protocol', 'The URL uses HTTP instead of HTTPS.', 'high', 18);
  }

  if (isIpAddress(hostname)) {
    addSignal('IP address host', 'The site is addressed by raw IP instead of a domain name.', 'high', 20);
  }

  if (hostname.includes('xn--')) {
    addSignal('Punycode domain', 'The domain may contain lookalike international characters.', 'high', 18);
  }

  const tld = getTld(hostname);
  if (SUSPICIOUS_TLDS.has(tld)) {
    addSignal('Risky top-level domain', `.${tld} domains are commonly abused in throwaway campaigns.`, 'medium', 12);
  }

  const subdomainCount = Math.max(hostname.split('.').length - 2, 0);
  if (subdomainCount >= 3) {
    addSignal('Deep subdomain chain', 'The URL uses many subdomains, which can hide the real domain.', 'medium', 10);
  }

  const digitCount = (hostname.match(/\d/g) || []).length;
  if (digitCount >= 4) {
    addSignal('Many digits in domain', 'Domains with many numbers are often used for disposable or deceptive sites.', 'medium', 8);
  }

  const hyphenCount = (hostname.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    addSignal('Many hyphens in domain', 'Heavy hyphen use can indicate keyword stuffing or impersonation.', 'medium', 8);
  }

  if (hostname.length > 38) {
    addSignal('Long domain name', 'Very long hostnames are harder to inspect and can hide deceptive wording.', 'low', 6);
  }

  const urlText = url.href.toLowerCase();
  const suspiciousKeywordCount = SUSPICIOUS_KEYWORDS.filter((keyword) => urlText.includes(keyword)).length;
  if (suspiciousKeywordCount >= 3) {
    addSignal('High-pressure keywords', 'The URL contains several account, payment, prize, or verification terms.', 'medium', 10);
  } else if (suspiciousKeywordCount > 0) {
    addSignal('Sensitive keyword found', 'The URL contains wording often used in phishing or spam campaigns.', 'low', 4);
  }

  const impersonatedBrand = findImpersonatedBrand(hostname);
  if (impersonatedBrand) {
    addSignal(
      'Possible brand impersonation',
      `The domain references ${impersonatedBrand} but is not its official host.`,
      'critical',
      35,
    );
  }

  if (relevantReports.length > 0) {
    addSignal('Local reports found', 'This host already appears in the dashboard report database.', 'high', Math.min(32, 8 + averageDarkPatternScore * 0.28));
  }

  if (darkPatternRecords > 0) {
    addSignal(
      'Dark-pattern records found',
      `${darkPatternRecords} saved dark-pattern record${darkPatternRecords === 1 ? '' : 's'} are linked to this host.`,
      darkPatternRecords >= 5 ? 'high' : 'medium',
      Math.min(24, darkPatternRecords * 4),
    );
  }

  const riskScore = Math.min(100, Math.round(signals.reduce((total, signal) => total + signal.weight, 0)));
  const safetyScore = Math.max(0, 100 - riskScore);
  const spamRecords = darkPatternRecords + relevantReports.filter((report) => report.score >= 50).length;

  return {
    inputUrl,
    normalizedUrl: url.href,
    hostname,
    safetyScore,
    riskLevel: getRiskLevel(safetyScore),
    spamRecords,
    localReports: relevantReports.length,
    darkPatternRecords,
    averageDarkPatternScore,
    signals: signals.sort((a, b) => b.weight - a.weight),
    analytics: {
      protocol: url.protocol.replace(':', '').toUpperCase(),
      tld,
      hostLength: hostname.length,
      subdomainCount,
      digitCount,
      hyphenCount,
      suspiciousKeywordCount,
      impersonatedBrand,
    },
  };
}
