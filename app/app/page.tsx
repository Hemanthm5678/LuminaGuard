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

// --- CLOUD CONFIGURATION ---
// This line automatically picks your Render URL in production or localhost for development
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

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
        // Pointing to the Backend URL (Render or Local)
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
      // Pointing to the Backend URL (Render or Local)
      const response = await fetch(`${BACKEND_URL}/analyze_site`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput, elements: [] }) // Elements empty for URL-only check
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to analyze this URL');
      }

      setUrlResult(data); // Mapping the FastAPI response to your state
    } catch (error) {
      setUrlResult(null);
      setUrlError(error instanceof Error ? error.message : 'Unable to analyze this URL');
    } finally {
      setCheckingUrl(false);
    }
  }

  // NOTE: Functions like prepareExtensionInstall will only work locally 
  // as they interact with your computer's File System.
  function requestExtensionInstall() {
    setInstallDialogOpen(true);
    setCopyMessage(null);
  }

  async function prepareExtensionInstall() {
    setPreparingExtension(true);
    setExtensionPrepared(false);
    setExtensionMessage('Extension folder preparation is only available in local mode.');
    setPreparingExtension(false);
  }
}  
