import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import os from 'os';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getOpenCommand(targetPath: string): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    return { command: 'explorer.exe', args: [targetPath] };
  }

  if (process.platform === 'darwin') {
    return { command: 'open', args: [targetPath] };
  }

  return { command: 'xdg-open', args: [targetPath] };
}

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  const extensionPath = `${process.cwd()}${process.platform === 'win32' ? '\\' : '/'}extension`;
  const configPath = `${extensionPath}${process.platform === 'win32' ? '\\' : '/'}config.js`;

  try {
    const origin = getRequestOrigin(request);
    let configUpdated = true;

    try {
      await writeFile(configPath, `globalThis.LUMINA_APP_ORIGIN = '${origin}';\n`, 'utf-8');
    } catch {
      configUpdated = false;
    }

    const { command, args } = getOpenCommand(extensionPath);
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();

    return NextResponse.json({
      success: true,
      extensionPath,
      origin,
      configUpdated,
      platform: `${os.type()} ${os.release()}`,
      nextStep: 'Open chrome://extensions, enable Developer Mode, choose Load unpacked, then select this extension folder.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to open extension folder';
    return NextResponse.json(
      {
        success: false,
        error: message,
        extensionPath,
      },
      { status: 500 },
    );
  }
}
