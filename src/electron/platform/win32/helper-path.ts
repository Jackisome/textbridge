import fs from 'node:fs';
import path from 'node:path';

export interface Win32HelperLaunchCommand {
  command: string;
  args: string[];
}

export interface ResolveWin32HelperLaunchOptions {
  isPackaged: boolean;
  resourcesPath?: string;
  fileExists?: (candidatePath: string) => boolean;
}

const HELPER_PROJECT_PATH = 'native/win32-helper/TextBridge.Win32Helper.csproj';
const HELPER_EXECUTABLE_NAME = 'TextBridge.Win32Helper.exe';

export function resolveWin32HelperLaunch({
  isPackaged,
  resourcesPath,
  fileExists = (candidatePath) => fs.existsSync(candidatePath)
}: ResolveWin32HelperLaunchOptions): Win32HelperLaunchCommand {
  if (!isPackaged) {
    const dotnetCommand =
      resolveConfiguredDotnetPath(fileExists) ??
      resolveDotnetRootPath(fileExists) ??
      resolveDefaultWindowsDotnetPath(fileExists) ??
      'dotnet';

    return {
      command: dotnetCommand,
      args: ['run', '--project', HELPER_PROJECT_PATH]
    };
  }

  const resolvedResourcesPath =
    resourcesPath ??
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

  if (!resolvedResourcesPath) {
    throw new Error(
      'A resourcesPath value is required to resolve the packaged win32 helper path.'
    );
  }

  return {
    command: path.win32.join(
      resolvedResourcesPath,
      'native',
      'win32-helper',
      HELPER_EXECUTABLE_NAME
    ),
    args: []
  };
}

function resolveConfiguredDotnetPath(
  fileExists: (candidatePath: string) => boolean
): string | null {
  const configuredPath = process.env.TEXTBRIDGE_DOTNET_PATH;

  if (!configuredPath || !fileExists(configuredPath)) {
    return null;
  }

  return configuredPath;
}

function resolveDotnetRootPath(
  fileExists: (candidatePath: string) => boolean
): string | null {
  const dotnetRoot = process.env.DOTNET_ROOT;

  if (!dotnetRoot) {
    return null;
  }

  const candidatePath = path.win32.join(dotnetRoot, 'dotnet.exe');
  return fileExists(candidatePath) ? candidatePath : null;
}

function resolveDefaultWindowsDotnetPath(
  fileExists: (candidatePath: string) => boolean
): string | null {
  const candidatePath = path.win32.join(
    'C:/Program Files/dotnet',
    'dotnet.exe'
  );

  return fileExists(candidatePath) ? candidatePath : null;
}
