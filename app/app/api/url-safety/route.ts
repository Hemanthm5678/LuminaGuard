import { NextRequest, NextResponse } from 'next/server';
import { getReports } from '@/lib/db';
import { analyzeUrlSafety } from '@/lib/url-safety';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url : '';

    if (!url.trim()) {
      return NextResponse.json({ error: 'Missing required field: url' }, { status: 400 });
    }

    const reports = await getReports();
    const result = analyzeUrlSafety(url, reports);

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze URL';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
