import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveWin32HelperLaunch } from './helper-path';

describe('resolveWin32HelperLaunch', () => {
  const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  const originalDotnetRoot = process.env.DOTNET_ROOT;
  const originalDotnetHostPath = process.env.TEXTBRIDGE_DOTNET_PATH;

  afterEach(() => {
    if (originalResourcesPath === undefined) {
      delete (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
    } else {
      (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath =
        originalResourcesPath;
    }

    if (originalDotnetRoot === undefined) {
      delete process.env.DOTNET_ROOT;
    } else {
      process.env.DOTNET_ROOT = originalDotnetRoot;
    }

    if (originalDotnetHostPath === undefined) {
      delete process.env.TEXTBRIDGE_DOTNET_PATH;
    } else {
      process.env.TEXTBRIDGE_DOTNET_PATH = originalDotnetHostPath;
    }
  });

  it('uses dotnet run in development', () => {
    const command = resolveWin32HelperLaunch({
      isPackaged: false,
      fileExists: () => false
    });

    expect(command.command).toBe('dotnet');
    expect(command.args).toEqual([
      'run',
      '--project',
      'native/win32-helper/TextBridge.Win32Helper.csproj'
    ]);
  });

  it('prefers TEXTBRIDGE_DOTNET_PATH in development when it points to an existing executable', () => {
    process.env.TEXTBRIDGE_DOTNET_PATH = 'C:/custom/dotnet/dotnet.exe';

    const command = resolveWin32HelperLaunch({
      isPackaged: false,
      fileExists: (candidatePath) => candidatePath === 'C:/custom/dotnet/dotnet.exe'
    });

    expect(command.command).toBe('C:/custom/dotnet/dotnet.exe');
    expect(command.args).toEqual([
      'run',
      '--project',
      'native/win32-helper/TextBridge.Win32Helper.csproj'
    ]);
  });

  it('falls back to DOTNET_ROOT in development when dotnet is not on PATH', () => {
    process.env.DOTNET_ROOT = 'C:/Program Files/dotnet';

    const command = resolveWin32HelperLaunch({
      isPackaged: false,
      fileExists: (candidatePath) =>
        candidatePath === path.win32.join('C:/Program Files/dotnet', 'dotnet.exe')
    });

    expect(command.command).toBe(
      path.win32.join('C:/Program Files/dotnet', 'dotnet.exe')
    );
    expect(command.args).toEqual([
      'run',
      '--project',
      'native/win32-helper/TextBridge.Win32Helper.csproj'
    ]);
  });

  it('falls back to the default Windows dotnet install location when env vars are absent', () => {
    const defaultDotnetPath = path.win32.join(
      'C:/Program Files/dotnet',
      'dotnet.exe'
    );

    const command = resolveWin32HelperLaunch({
      isPackaged: false,
      fileExists: (candidatePath) => candidatePath === defaultDotnetPath
    });

    expect(command.command).toBe(defaultDotnetPath);
    expect(command.args).toEqual([
      'run',
      '--project',
      'native/win32-helper/TextBridge.Win32Helper.csproj'
    ]);
  });

  it('uses the packaged helper executable path in production', () => {
    const command = resolveWin32HelperLaunch({
      isPackaged: true,
      resourcesPath: 'C:/Program Files/TextBridge/resources'
    });

    expect(command.command).toBe(
      path.win32.join(
        'C:/Program Files/TextBridge/resources',
        'native',
        'win32-helper',
        'TextBridge.Win32Helper.exe'
      )
    );
    expect(command.args).toEqual([]);
  });

  it('falls back to process.resourcesPath when resourcesPath is omitted', () => {
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath =
      'C:/Program Files/TextBridge/process-resources';

    const command = resolveWin32HelperLaunch({
      isPackaged: true
    });

    expect(command.command).toBe(
      path.win32.join(
        'C:/Program Files/TextBridge/process-resources',
        'native',
        'win32-helper',
        'TextBridge.Win32Helper.exe'
      )
    );
    expect(command.args).toEqual([]);
  });

  it('throws when neither resourcesPath nor process.resourcesPath is available', () => {
    delete (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

    expect(() => resolveWin32HelperLaunch({ isPackaged: true })).toThrow(
      'A resourcesPath value is required to resolve the packaged win32 helper path.'
    );
  });
});
