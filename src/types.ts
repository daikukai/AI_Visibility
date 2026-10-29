export interface CheckResult {
  id: string;
  name: string;
  category: 'crawlability' | 'clarity' | 'qa_content' | 'structured_data';
  pointsEarned: number;
  maxPoints: number;
  status: 'pass' | 'partial' | 'fail';
  detail: string;
  fixText?: string;
}

export interface CategoryScore {
  name: string;
  earned: number;
  max: number;
  checks: CheckResult[];
}

export type ReadinessBand =
  | 'Strong readiness'
  | 'Good foundation with gaps'
  | 'Needs improvement'
  | 'Significant issues';

export interface FixItem {
  id: string;
  title: string;
  category: string;
  pointsLost: number;
  fix: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface UnreadableResult {
  readable: false;
  reason: string;
  url: string;
  domain: string;
  scannedAt: string;
}

export interface ScanSuccessResult {
  readable: true;
  url: string;
  domain: string;
  scannedAt: string;
  score: number;
  band: ReadinessBand;
  categories: {
    crawlability: CategoryScore;
    clarity: CategoryScore;
    qa_content: CategoryScore;
    structured_data: CategoryScore;
  };
  topFixes: FixItem[];
}

export type ScanResult = ScanSuccessResult | UnreadableResult;

export interface PageContent {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  html: string;
  text: string;
  wordCount: number;
  hasNoIndex: boolean;
  isHttps: boolean;
}

export interface ScannedSiteData {
  targetUrl: string;
  normalizedDomain: string;
  homepage: PageContent | null;
  robotsTxt: {
    exists: boolean;
    raw: string;
    parses: boolean;
    allowedBots: Record<string, boolean>; // GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot
  };
  sitemapXml: {
    exists: boolean;
    referencedInRobots: boolean;
    validXml: boolean;
    urlCount: number;
  };
  subpages: PageContent[];
  internalLinks: string[];
}
