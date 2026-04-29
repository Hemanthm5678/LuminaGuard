import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getWindowsBrowserCandidates() {
  const candidates = [
    process.env.CHROME_PATH,
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ].filter(Boolean) as string[];

  const edgeCandidates = [
    `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ].filter(Boolean) as string[];

  return { chrome: candidates, edge: edgeCandidates };
}

function openDetached(command: string, args: string[]) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
}

export async function POST() {
  try {
    if (process.platform === 'win32') {
      const { chrome, edge } = getWindowsBrowserCandidates();
      const chromePath = chrome.find((candidate) => existsSync(candidate));

      if (chromePath) {
        openDetached(chromePath, ['chrome://extensions']);
        return NextResponse.json({
          success: true,
          browser: 'Chrome',
          url: 'chrome://extensions',
        });
      }

      const edgePath = edge.find((candidate) => existsSync(candidate));
      if (edgePath) {
        openDetached(edgePath, ['edge://extensions']);
        return NextResponse.json({
          success: true,
          browser: 'Microsoft Edge',
          url: 'edge://extensions',
          note: 'Chrome was not found, so Edge extensions was opened instead.',
        });
      }

      openDetached('cmd.exe', ['/c', 'start', 'chrome', 'chrome://extensions']);
      return NextResponse.json({
        success: true,
        browser: 'Chrome',
        url: 'chrome://extensions',
        note: 'Chrome was launched through the Windows shell.',
      });
    }

    if (process.platform === 'darwin') {
      openDetached('open', ['-a', 'Google Chrome', 'chrome://extensions']);
      return NextResponse.json({ success: true, browser: 'Chrome', url: 'chrome://extensions' });
    }

    openDetached('google-chrome', ['chrome://extensions']);
    return NextResponse.json({ success: true, browser: 'Chrome', url: 'chrome://extensions' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to open Chrome extensions';
    return NextResponse.json(
      {
        success: false,
        error: message,
        fallback: 'Open Chrome manually and paste chrome://extensions in the address bar.',
      },
      { status: 500 },
    );
  }
}
