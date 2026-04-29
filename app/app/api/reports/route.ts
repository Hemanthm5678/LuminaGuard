import { NextRequest, NextResponse } from 'next/server';
import { getReports, addReport, getStats } from '@/lib/db';

// GET /api/reports - Get all reports or stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = searchParams.get('stats');
    
    if (stats === 'true') {
      const statsData = await getStats();
      return NextResponse.json(statsData);
    }
    
    const reports = await getReports();
    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

// POST /api/reports - Add a new report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.url || !body.hostname || body.score === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: url, hostname, score' },
        { status: 400 }
      );
    }
    
    const report = await addReport({
      url: body.url,
      hostname: body.hostname,
      score: body.score,
      patterns: body.patterns || [],
      timestamp: body.timestamp || new Date().toISOString()
    });
    
    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error adding report:', error);
    return NextResponse.json(
      { error: 'Failed to add report' },
      { status: 500 }
    );
  }
}
