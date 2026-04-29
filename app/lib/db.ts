import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

export interface PatternData {
  type: string;
  name: string;
  description: string;
  text?: string;
}

export interface Report {
  id: string;
  url: string;
  hostname: string;
  score: number;
  patterns: PatternData[];
  timestamp: string;
  reportedAt: string;
}

// Ensure data directory and file exist
async function ensureDataFile(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  try {
    await fs.access(REPORTS_FILE);
  } catch {
    await fs.writeFile(REPORTS_FILE, JSON.stringify({ reports: [] }, null, 2));
  }
}

// Read all reports
export async function getReports(): Promise<Report[]> {
  await ensureDataFile();
  const data = await fs.readFile(REPORTS_FILE, 'utf-8');
  const parsed = JSON.parse(data);
  return parsed.reports || [];
}

// Add a new report
export async function addReport(report: Omit<Report, 'id' | 'reportedAt'>): Promise<Report> {
  await ensureDataFile();
  
  const reports = await getReports();
  
  // Check if report for this hostname already exists
  const existingIndex = reports.findIndex(r => r.hostname === report.hostname);
  
  const newReport: Report = {
    ...report,
    id: existingIndex >= 0 ? reports[existingIndex].id : crypto.randomUUID(),
    reportedAt: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    // Update existing report
    reports[existingIndex] = newReport;
  } else {
    // Add new report
    reports.push(newReport);
  }
  
  await fs.writeFile(REPORTS_FILE, JSON.stringify({ reports }, null, 2));
  
  return newReport;
}

// Get report by ID
export async function getReportById(id: string): Promise<Report | null> {
  const reports = await getReports();
  return reports.find(r => r.id === id) || null;
}

// Get report by hostname
export async function getReportByHostname(hostname: string): Promise<Report | null> {
  const reports = await getReports();
  return reports.find(r => r.hostname === hostname) || null;
}

// Delete a report
export async function deleteReport(id: string): Promise<boolean> {
  const reports = await getReports();
  const index = reports.findIndex(r => r.id === id);
  
  if (index === -1) return false;
  
  reports.splice(index, 1);
  await fs.writeFile(REPORTS_FILE, JSON.stringify({ reports }, null, 2));
  
  return true;
}

// Get statistics
export async function getStats(): Promise<{
  totalReports: number;
  averageScore: number;
  patternCounts: Record<string, number>;
  worstOffenders: Report[];
}> {
  const reports = await getReports();
  
  const patternCounts: Record<string, number> = {};
  let totalScore = 0;
  
  reports.forEach(report => {
    totalScore += report.score;
    report.patterns.forEach(pattern => {
      patternCounts[pattern.type] = (patternCounts[pattern.type] || 0) + 1;
    });
  });
  
  const worstOffenders = [...reports]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  return {
    totalReports: reports.length,
    averageScore: reports.length > 0 ? Math.round(totalScore / reports.length) : 0,
    patternCounts,
    worstOffenders
  };
}
