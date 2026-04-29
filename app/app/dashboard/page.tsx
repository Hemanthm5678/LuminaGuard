'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, RefreshCw, Trash2, ExternalLink, AlertTriangle, CheckCircle2, Clock, Activity, BarChart3, Database, Globe, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface PatternData {
  type: string;
  name: string;
  description: string;
  text?: string;
}

interface Report {
  id: string;
  url: string;
  hostname: string;
  score: number;
  patterns: PatternData[];
  timestamp: string;
  reportedAt: string;
}

interface Stats {
  totalReports: number;
  averageScore: number;
  patternCounts: Record<string, number>;
  worstOffenders: Report[];
}

const patternTypeLabels: Record<string, string> = {
  deceptive_pattern: 'Deceptive Pattern',
  fake_urgency: 'Fake Urgency',
  countdown_timer: 'Countdown Timer',
  preselected_checkbox: 'Pre-selected',
  misleading_buttons: 'Misleading Buttons',
  suspicious_pricing: 'Suspicious Pricing',
  hidden_costs: 'Hidden Costs',
  confirmshaming: 'Confirmshaming',
  forced_continuity: 'Forced Continuity'
};

function getRiskLevel(score: number): { level: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (score === 0) return { level: 'Clean', variant: 'secondary' };
  if (score <= 25) return { level: 'Low', variant: 'outline' };
  if (score <= 50) return { level: 'Medium', variant: 'default' };
  return { level: 'High', variant: 'destructive' };
}

function getRiskTone(score: number): string {
  if (score === 0) return 'text-emerald-300';
  if (score <= 25) return 'text-sky-300';
  if (score <= 50) return 'text-amber-300';
  return 'text-red-300';
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [reportsRes, statsRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/reports?stats=true')
      ]);
      
      const reportsData = await reportsRes.json();
      const statsData = await statsRes.json();
      
      setReports(reportsData.reports || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 5000);

    return () => window.clearInterval(interval);
  }, []);

  async function deleteReport(id: string) {
    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReports(reports.filter(r => r.id !== id));
        if (selectedReport?.id === id) {
          setSelectedReport(null);
        }
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  }

  const sortedReports = [...reports].sort((a, b) => b.score - a.score);
  const recentReports = [...reports]
    .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
    .slice(0, 5);
  const totalPatterns = reports.reduce((total, report) => total + report.patterns.length, 0);
  const highRiskCount = reports.filter((report) => report.score > 50).length;
  const mediumRiskCount = reports.filter((report) => report.score > 25 && report.score <= 50).length;
  const lowRiskCount = reports.filter((report) => report.score > 0 && report.score <= 25).length;
  const cleanCount = reports.filter((report) => report.score === 0).length;
  const riskBuckets = [
    { label: 'High', count: highRiskCount, color: 'bg-red-400' },
    { label: 'Medium', count: mediumRiskCount, color: 'bg-amber-400' },
    { label: 'Low', count: lowRiskCount, color: 'bg-sky-400' },
    { label: 'Clean', count: cleanCount, color: 'bg-emerald-400' },
  ];
  const patternEntries = Object.entries(stats?.patternCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxPatternCount = Math.max(...patternEntries.map(([, count]) => count), 1);
  const averageScore = stats?.averageScore || 0;
  const latestReport = recentReports[0];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-foreground">Dashboard</span>
            </div>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="overflow-hidden border-primary/20 bg-card xl:col-span-2">
            <CardContent className="p-0">
              <div className="grid gap-0 md:grid-cols-[280px_1fr]">
                <div className="flex flex-col items-center justify-center border-b border-border bg-primary/5 p-8 md:border-b-0 md:border-r">
                  <div
                    className="relative flex h-44 w-44 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#fb7185 ${averageScore * 3.6}deg, rgba(148,163,184,0.16) 0deg)`,
                    }}
                  >
                    <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-background shadow-inner">
                      <span className={`text-5xl font-black ${getRiskTone(averageScore)}`}>{averageScore}</span>
                      <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">avg risk</span>
                    </div>
                  </div>
                  <p className="mt-5 text-center text-sm text-muted-foreground">
                    Live score from extension reports and URL safety checks.
                  </p>
                </div>

                <div className="p-6">
                  <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        <Activity className="h-3.5 w-3.5" />
                        Analysis Command Center
                      </div>
                      <h1 className="text-3xl font-bold text-foreground">Threat Analytics</h1>
                      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Every LuminaGuard audit updates this board with site risk, detected patterns, and the most suspicious domains.
                      </p>
                    </div>
                    <Badge variant={highRiskCount > 0 ? 'destructive' : 'secondary'}>
                      {highRiskCount > 0 ? `${highRiskCount} high-risk sites` : 'No high-risk sites'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-lg border border-border bg-background/70 p-4">
                      <Globe className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold text-foreground">{reports.length}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">sites scanned</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 p-4">
                      <Database className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold text-foreground">{totalPatterns}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">pattern records</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 p-4">
                      <TrendingUp className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-2xl font-bold text-foreground">{patternEntries.length}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">active signals</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 p-4">
                      <Clock className="mb-3 h-5 w-5 text-primary" />
                      <p className="truncate text-sm font-semibold text-foreground">{latestReport?.hostname || 'Waiting'}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">latest scan</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <BarChart3 className="h-5 w-5 text-primary" />
                Risk Distribution
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Site counts grouped by current risk band
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {riskBuckets.map((bucket) => {
                const width = reports.length > 0 ? Math.round((bucket.count / reports.length) * 100) : 0;
                return (
                  <div key={bucket.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{bucket.label}</span>
                      <span className="font-semibold text-foreground">{bucket.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${bucket.color}`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {patternEntries.length > 0 && (
          <Card className="mb-8 border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Pattern Intelligence</CardTitle>
              <CardDescription className="text-muted-foreground">
                Most common manipulation signals collected from extension audits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {patternEntries.map(([type, count]) => (
                  <div key={type} className="rounded-lg border border-border bg-background/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-medium text-foreground">{patternTypeLabels[type] || type}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-amber-300 to-red-400"
                        style={{ width: `${Math.max(8, Math.round((count / maxPatternCount) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted-foreground">Total Reports</CardDescription>
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
                <CardDescription className="text-muted-foreground">Patterns Found</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {Object.values(stats.patternCounts).reduce((a, b) => a + b, 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted-foreground">Worst Offender</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-foreground truncate">
                  {stats.worstOffenders[0]?.hostname || 'None yet'}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reports Table */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Reported Websites</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Sites scanned and reported by the extension
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No reports yet</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                      Install the Chrome extension and browse websites to start detecting dark patterns.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground">Website</TableHead>
                        <TableHead className="text-muted-foreground">Score</TableHead>
                        <TableHead className="text-muted-foreground">Risk</TableHead>
                        <TableHead className="text-muted-foreground">Patterns</TableHead>
                        <TableHead className="text-muted-foreground w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedReports
                        .map((report) => {
                          const risk = getRiskLevel(report.score);
                          return (
                            <TableRow 
                              key={report.id} 
                              className={`border-border cursor-pointer hover:bg-muted/50 ${selectedReport?.id === report.id ? 'bg-muted/30' : ''}`}
                              onClick={() => setSelectedReport(report)}
                            >
                              <TableCell className="font-medium text-foreground">
                                <div className="flex items-center gap-2">
                                  <span className="truncate max-w-[200px]">{report.hostname}</span>
                                  <a 
                                    href={report.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`font-semibold ${report.score > 50 ? 'text-primary' : 'text-foreground'}`}>
                                  {report.score}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={risk.variant}>{risk.level}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {report.patterns.length}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteReport(report.id);
                                  }}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Report Details */}
          <div>
            <Card className="bg-card border-border sticky top-6">
              <CardHeader>
                <CardTitle className="text-foreground">Report Details</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {selectedReport ? selectedReport.hostname : 'Select a report to view details'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedReport ? (
                  <div className="space-y-6">
                    {/* Score Display */}
                    <div className="text-center">
                      <div
                        className="mx-auto mb-3 flex h-28 w-28 items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(#fb7185 ${selectedReport.score * 3.6}deg, rgba(148,163,184,0.18) 0deg)`,
                        }}
                      >
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background">
                          <span className={`text-3xl font-bold ${getRiskTone(selectedReport.score)}`}>
                            {selectedReport.score}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Dark Pattern Score</p>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Reported {formatDate(selectedReport.reportedAt)}</span>
                    </div>

                    {/* Patterns List */}
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-3">Detected Patterns</h4>
                      {selectedReport.patterns.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No patterns detected</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedReport.patterns.map((pattern, index) => (
                            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                              <AlertTriangle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                  {patternTypeLabels[pattern.type] || pattern.name}
                                </p>
                                {pattern.text && (
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    {`"${pattern.text}"`}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" asChild>
                        <a href={selectedReport.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Visit Site
                        </a>
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={() => deleteReport(selectedReport.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Shield className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Click on a report in the table to view its details
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
