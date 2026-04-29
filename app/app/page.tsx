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
        const res = await fetch('/api/reports?stats=true');
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
      const response = await fetch('/api/url-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to analyze this URL');
      }

      setUrlResult(data.result);
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
          setCopyMessage('Folder is ready. Copy permission was blocked, so select the path manually.');
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
      setCopyMessage('Copy failed. Select the text manually.');
    }
  }

  async function openChromeExtensions() {
    setOpeningChrome(true);
    setCopyMessage(null);

    try {
      const response = await fetch('/api/extension/open-chrome', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.fallback || 'Unable to open Chrome extensions');
      }

      setCopyMessage(`${data.browser || 'Chrome'} extensions page opened. Enable Developer Mode, then click Load unpacked.`);
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : 'Open Chrome manually and paste chrome://extensions.');
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

  const severityTone: Record<UrlSafetySignal['severity'], string> = {
    low: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    medium: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    high: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
    critical: 'border-red-500/30 bg-red-500/10 text-red-200',
  };

  const features = [
    {
      icon: Eye,
      title: 'Lumina Extension',
      description: 'Runs the bundled LuminaGuard extension against the current tab'
    },
    {
      icon: AlertTriangle,
      title: '8 Pattern Types',
      description: 'Detects fake urgency, pre-selected checkboxes, misleading buttons, and more'
    },
    {
      icon: BarChart3,
      title: 'Dark Pattern Score',
      description: 'Each site gets a score from 0-100 showing how manipulative it is'
    },
    {
      icon: Globe,
      title: 'Community Reports',
      description: 'Report findings to help build a database of dark pattern offenders'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold text-foreground">Dark Pattern Detector</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Button onClick={requestExtensionInstall} data-testid="add-extension-header">
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
          <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6 text-balance">
            Expose Dark Patterns Hiding on the Web
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto text-pretty">
            A Chrome extension that detects and highlights manipulative design tactics used by websites to trick you into unwanted actions.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={requestExtensionInstall} data-testid="add-extension-hero">
              <Download className="mr-2 h-5 w-5" />
              Add Extension
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">
                View Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* URL Safety Check */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl">
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-2xl text-foreground">Website Safety Check</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Paste a URL to review security signals, local spam records, and dark-pattern history.
                  </CardDescription>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Activity className="h-3.5 w-3.5" />
                  Local analytics
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={checkUrlSafety} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder="https://example.com"
                  className="h-12 bg-secondary border-border text-base"
                />
                <Button type="submit" size="lg" disabled={checkingUrl} className="sm:w-44">
                  <Search className="mr-2 h-4 w-4" />
                  {checkingUrl ? 'Checking' : 'Check URL'}
                </Button>
              </form>

              {urlError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {urlError}
                </div>
              )}

              {urlResult && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background/60 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Safety Score</p>
                        <p className={`mt-2 text-5xl font-bold ${scoreTone}`}>{urlResult.safetyScore}</p>
                      </div>
                      <div className="rounded-full bg-secondary p-3">
                        {urlResult.safetyScore >= 70 ? (
                          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-7 w-7 text-red-400" />
                        )}
                      </div>
                    </div>
                    <div className="mt-4 text-sm">
                      <p className="font-medium text-foreground">{urlResult.riskLevel}</p>
                      <p className="mt-1 truncate text-muted-foreground">{urlResult.hostname}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                    <div className="rounded-lg border border-border bg-background/60 p-4">
                      <Database className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold text-foreground">{urlResult.spamRecords}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Spam records</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-4">
                      <BarChart3 className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold text-foreground">{urlResult.averageDarkPatternScore}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg risk score</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-4">
                      <Shield className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold text-foreground">{urlResult.localReports}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Local reports</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-4">
                      <Globe className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold text-foreground">{urlResult.analytics.protocol}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Protocol</p>
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <div className="flex flex-wrap gap-2">
                      {urlResult.signals.length === 0 ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
                          No suspicious signals found
                        </span>
                      ) : (
                        urlResult.signals.map((signal) => (
                          <span
                            key={`${signal.label}-${signal.weight}`}
                            className={`rounded-full border px-3 py-1 text-sm ${severityTone[signal.severity]}`}
                            title={signal.description}
                          >
                            {signal.label}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      {!loading && stats && stats.totalReports > 0 && (
        <section className="py-16 px-6 border-y border-border bg-card/50">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="text-muted-foreground">Sites Reported</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stats.totalReports}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="text-muted-foreground">Average Score</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{stats.averageScore}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="text-muted-foreground">Patterns Detected</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {Object.values(stats.patternCounts).reduce((a, b) => a + b, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="text-muted-foreground">Pattern Types</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {Object.keys(stats.patternCounts).length}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The extension runs automatically on every page you visit, scanning for manipulative design patterns and alerting you to potential tricks.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card border-border">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pattern Types */}
      <section className="py-24 px-6 border-t border-border bg-card/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Dark Patterns We Detect</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our extension identifies 8 types of manipulative design tactics commonly used on e-commerce and subscription sites.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(patternTypeLabels).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Installation */}
      <section id="install" className="py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <Card className="bg-card border-border">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-foreground">Add the Lumina Extension</CardTitle>
              <CardDescription className="text-muted-foreground">
                Load the bundled LuminaGuard extension and connect it to this app&apos;s integrated analyzer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 rounded-lg border border-primary/20 bg-primary/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">Open bundled extension</h4>
                    <p className="text-sm text-muted-foreground">
                      This opens the app&apos;s Lumina extension folder so Chrome can load it unpacked.
                    </p>
                  </div>
                  <Button onClick={requestExtensionInstall}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Add Extension
                  </Button>
                </div>
                {extensionMessage && (
                  <p className="mt-3 text-sm text-muted-foreground">{extensionMessage}</p>
                )}
                {extensionPath && (
                  <code className="mt-3 block rounded bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                    {extensionPath}
                  </code>
                )}
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Run This App</h4>
                    <p className="text-muted-foreground text-sm">
                      Keep the Next app running on <code className="bg-secondary px-1.5 py-0.5 rounded text-sm">http://127.0.0.1:3000</code>. The analysis API is now built into the app.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Open Chrome Extensions</h4>
                    <p className="text-muted-foreground text-sm">
                      Navigate to <code className="bg-secondary px-1.5 py-0.5 rounded text-sm">chrome://extensions</code> in your browser and enable Developer Mode in the top right corner.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Load the Extension</h4>
                    <p className="text-muted-foreground text-sm">
                      {`Click "Load unpacked" and select the extension folder opened by the Add Extension button.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Start Browsing</h4>
                    <p className="text-muted-foreground text-sm">
                      Visit any website, open Lumina Pro from the toolbar, and run the integrity audit.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="border-primary/25 bg-background sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              Add LuminaGuard Extension
            </DialogTitle>
            <DialogDescription>
              LuminaGuard will be prepared from this app&apos;s bundled extension files. Chrome requires you to approve unpacked extensions from the extensions page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card/70 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Permission requested</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Click yes to prepare the local extension folder, copy its path, and open it in File Explorer. The extension calls this app&apos;s integrated analyzer, so no separate backend terminal is required.
                  </p>
                </div>
              </div>
            </div>

            {extensionMessage && (
              <div className={`rounded-lg border px-4 py-3 text-sm ${extensionPrepared ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-primary/25 bg-primary/10 text-muted-foreground'}`}>
                {extensionMessage}
              </div>
            )}

            {extensionPath && (
              <div className="space-y-3 rounded-lg border border-border bg-card/70 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extension folder</p>
                  <code className="mt-2 block break-all rounded-md bg-background px-3 py-2 text-xs text-foreground">
                    {extensionPath}
                  </code>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyInstallText(extensionPath, 'Extension folder path copied.')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Path
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyInstallText('chrome://extensions', 'Chrome extensions URL copied.')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openChromeExtensions}
                    disabled={openingChrome}
                  >
                    {openingChrome ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Open Chrome
                  </Button>
                </div>
                {copyMessage && (
                  <p className="text-sm text-emerald-300">{copyMessage}</p>
                )}
              </div>
            )}

            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card/50 p-3">
                <span className="text-primary font-semibold">1.</span> Open <code className="rounded bg-secondary px-1 py-0.5">chrome://extensions</code>.
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-3">
                <span className="text-primary font-semibold">2.</span> Enable Developer Mode.
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-3">
                <span className="text-primary font-semibold">3.</span> Click Load unpacked and select the copied folder.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInstallDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={prepareExtensionInstall} disabled={preparingExtension}>
              {preparingExtension ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Yes, Prepare Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Dark Pattern Detector</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Built to protect users from manipulation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
