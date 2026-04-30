'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, AlertTriangle, Eye, Download, ArrowRight, BarChart3, Globe, Clock, Search, FolderOpen, Database, Activity, CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// --- INTEGRATION LOGIC ---
// This variable checks if you're in the cloud or on your laptop automatically.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://lumina-backend-ddhr.onrender.com";
interface Stats {
  totalReports: number;
  averageScore: number;
  patternCounts: Record<string, number>;
  worstOffenders: Array<{
    hostname: string;
    score: number;
  }>;
}

interface UrlSafetySignal {
  label: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
}

interface UrlSafetyResult {
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
    suspiciousKeywordCount: number;
    impersonatedBrand: string | null;
  };
}

const patternTypeLabels: Record<string, string> = {
  deceptive_pattern: 'Deceptive Pattern',
  fake_urgency: 'Fake Urgency',
  countdown_timer: 'Countdown Timers',
  preselected_checkbox: 'Pre-selected Options',
  misleading_buttons: 'Misleading Buttons',
  suspicious_pricing: 'Suspicious Pricing',
  hidden_costs: 'Hidden Costs',
  confirmshaming: 'Confirmshaming',
  forced_continuity: 'Forced Continuity'
};

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [urlResult, setUrlResult] = useState<UrlSafetyResult | null>(null);
  const [checkingUrl, setCheckingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [extensionMessage, setExtensionMessage] = useState<string | null>(null);
  const [extensionPath, setExtensionPath] = useState<string | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [preparingExtension, setPreparingExtension] = useState(false);
  const [openingChrome, setOpeningChrome] = useState(false);
  const [extensionPrepared, setExtensionPrepared] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reports?stats=true`);
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  async function checkUrlSafety(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckingUrl(true);
    setUrlError(null);

    try {
      // Pointing to Integrated Backend
      const response = await fetch(`${BACKEND_URL}/analyze_site`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput, elements: [] })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to analyze this URL');
      }

      setUrlResult(data); 
    } catch (error) {
      setUrlResult(null);
      setUrlError(error instanceof Error ? error.message : 'Unable to analyze this URL');
    } finally {
      setCheckingUrl(false);
    }
  }

  function requestExtensionInstall() {
    setInstallDialogOpen(true);
    setCopyMessage(null);
  }

  async function prepareExtensionInstall() {
    setPreparingExtension(true);
    setExtensionPrepared(false);
    setCopyMessage(null);
    setExtensionMessage('Preparing the LuminaGuard extension package...');

    try {
      const response = await fetch('/api/extension/open', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to open extension folder');
      }

      setExtensionPath(data.extensionPath);
      setExtensionPrepared(true);
      setExtensionMessage('Extension folder is ready. Load this folder with Chrome Developer Mode.');

      if (navigator.clipboard && data.extensionPath) {
        try {
          await navigator.clipboard.writeText(data.extensionPath);
          setCopyMessage('Extension folder path copied.');
        } catch {
          setCopyMessage('Folder is ready. Copy permission was blocked.');
        }
      }
    } catch (error) {
      setExtensionPrepared(false);
      setExtensionMessage(error instanceof Error ? error.message : 'Unable to open extension folder');
    } finally {
      setPreparingExtension(false);
    }
  }

  async function copyInstallText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(successMessage);
    } catch {
      setCopyMessage('Copy failed.');
    }
  }

  async function openChromeExtensions() {
    setOpeningChrome(true);
    try {
      const response = await fetch('/api/extension/open-chrome', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCopyMessage('Chrome extensions page opened.');
    } catch (error) {
      setCopyMessage('Open Chrome manually and paste chrome://extensions.');
    } finally {
      setOpeningChrome(false);
    }
  }

  const scoreTone =
    !urlResult || urlResult.safetyScore >= 85
      ? 'text-emerald-400'
      : urlResult.safetyScore >= 70
        ? 'text-amber-300'
        : urlResult.safetyScore >= 50
          ? 'text-orange-400'
          : 'text-red-400';

  const severityTone: Record<string, string> = {
    low: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    medium: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    high: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
    critical: 'border-red-500/30 bg-red-500/10 text-red-200',
  };

  const features = [
    { icon: Eye, title: 'Lumina Extension', description: 'Runs the bundled LuminaGuard extension against the current tab' },
    { icon: AlertTriangle, title: '8 Pattern Types', description: 'Detects fake urgency, pre-selected checkboxes, and more' },
    { icon: BarChart3, title: 'Dark Pattern Score', description: 'Each site gets a score from 0-100 showing how manipulative it is' },
    { icon: Globe, title: 'Community Reports', description: 'Report findings to help build a database of dark pattern offenders' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold text-foreground">Dark Pattern Detector</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Button onClick={requestExtensionInstall}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Add Extension
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <Shield className="h-4 w-4" />
            Protect yourself from manipulation
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6">Expose Dark Patterns Hiding on the Web</h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            A Chrome extension that detects and highlights manipulative design tactics used by websites.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={requestExtensionInstall}>
              <Download className="mr-2 h-5 w-5" />
              Add Extension
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">View Dashboard <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* URL Safety Check */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl">
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">Website Safety Check</CardTitle>
              <CardDescription>Paste a URL to review security signals and dark-pattern history.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={checkUrlSafety} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  className="h-12 bg-secondary border-border"
                />
                <Button type="submit" size="lg" disabled={checkingUrl} className="sm:w-44">
                  <Search className="mr-2 h-4 w-4" />
                  {checkingUrl ? 'Checking' : 'Check URL'}
                </Button>
              </form>

              {urlError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{urlError}</div>}

              {urlResult && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background/60 p-5">
                    <p className="text-sm text-muted-foreground">Safety Score</p>
                    <p className={`mt-2 text-5xl font-bold ${scoreTone}`}>{urlResult.safetyScore}</p>
                    <p className="mt-4 font-medium text-foreground uppercase">{urlResult.riskLevel}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                    <div className="rounded-lg border border-border bg-background/60 p-4">
                      <Database className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold">{urlResult.spamRecords}</p>
                      <p className="text-xs uppercase text-muted-foreground">Spam records</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-4">
                      <BarChart3 className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold">{urlResult.averageDarkPatternScore}</p>
                      <p className="text-xs uppercase text-muted-foreground">Risk Score</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-border">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card border-border">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          <span>Dark Pattern Detector | Built by Team Mind Matrix</span>
        </div>
      </footer>

      {/* Installation Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add LuminaGuard Extension</DialogTitle>
            <DialogDescription>Load the extension folder via Chrome Developer Mode.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {extensionMessage && <div className="rounded-lg border bg-primary/10 p-3 text-sm">{extensionMessage}</div>}
            {extensionPath && (
              <div className="bg-secondary p-3 rounded text-xs break-all">
                <code>{extensionPath}</code>
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => copyInstallText(extensionPath, 'Path Copied!')}>Copy</Button>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>Close</Button>
              <Button onClick={prepareExtensionInstall} disabled={preparingExtension}>
                {preparingExtension ? <Loader2 className="animate-spin h-4 w-4" /> : 'Prepare Extension'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}