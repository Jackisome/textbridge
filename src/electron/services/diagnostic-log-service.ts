import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DiagnosticLogService {
  getLevel(): DiagnosticLogLevel;
  debug(message: string): Promise<void>;
  info(message: string): Promise<void>;
  warn(message: string): Promise<void>;
  error(message: string): Promise<void>;
}

export interface CreateDiagnosticLogServiceOptions {
  isPackaged: boolean;
  logsDirectoryPath?: string;
  baseDirectoryPath?: string;
  environment?: NodeJS.ProcessEnv;
}

const DIAGNOSTIC_LOG_LEVELS: DiagnosticLogLevel[] = [
  'debug',
  'info',
  'warn',
  'error'
];

const DIAGNOSTIC_LOG_FILE_NAME = 'diagnostic.log';
const DIAGNOSTIC_LOG_PRIORITIES: Record<DiagnosticLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function isDiagnosticLogLevel(value: string | undefined): value is DiagnosticLogLevel {
  return DIAGNOSTIC_LOG_LEVELS.includes(value as DiagnosticLogLevel);
}

function resolveDiagnosticLogLevel({
  isPackaged,
  environment
}: Pick<CreateDiagnosticLogServiceOptions, 'isPackaged' | 'environment'>): DiagnosticLogLevel {
  const configuredLevel = environment?.TEXTBRIDGE_LOG_LEVEL?.trim().toLowerCase();

  if (isDiagnosticLogLevel(configuredLevel)) {
    return configuredLevel;
  }

  return isPackaged ? 'info' : 'debug';
}

function resolveLogsDirectoryPath({
  logsDirectoryPath,
  baseDirectoryPath
}: Pick<CreateDiagnosticLogServiceOptions, 'logsDirectoryPath' | 'baseDirectoryPath'>): string {
  if (logsDirectoryPath) {
    return logsDirectoryPath;
  }

  if (baseDirectoryPath) {
    return path.join(baseDirectoryPath, 'logs');
  }

  return path.join(process.cwd(), 'logs');
}

function formatLogEntry(level: DiagnosticLogLevel, message: string): string {
  return `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
}

export function createDiagnosticLogService({
  isPackaged,
  logsDirectoryPath,
  baseDirectoryPath,
  environment = process.env
}: CreateDiagnosticLogServiceOptions): DiagnosticLogService {
  const level = resolveDiagnosticLogLevel({ isPackaged, environment });
  const outputDirectoryPath = resolveLogsDirectoryPath({
    logsDirectoryPath,
    baseDirectoryPath
  });
  const logFilePath = path.join(outputDirectoryPath, DIAGNOSTIC_LOG_FILE_NAME);

  function writeToConsole(levelToWrite: DiagnosticLogLevel, entry: string): void {
    if (levelToWrite === 'debug') {
      console.debug(entry);
      return;
    }

    if (levelToWrite === 'info') {
      console.info(entry);
      return;
    }

    if (levelToWrite === 'warn') {
      console.warn(entry);
      return;
    }

    console.error(entry);
  }

  async function write(levelToWrite: DiagnosticLogLevel, message: string): Promise<void> {
    if (DIAGNOSTIC_LOG_PRIORITIES[levelToWrite] < DIAGNOSTIC_LOG_PRIORITIES[level]) {
      return;
    }

    const entry = formatLogEntry(levelToWrite, message);

    writeToConsole(levelToWrite, entry);

    try {
      await mkdir(outputDirectoryPath, { recursive: true });
      await appendFile(logFilePath, `${entry}\n`, 'utf-8');
    } catch {
      // Diagnostic file output must never break the caller path.
    }
  }

  return {
    getLevel() {
      return level;
    },
    async debug(message: string) {
      await write('debug', message);
    },
    async info(message: string) {
      await write('info', message);
    },
    async warn(message: string) {
      await write('warn', message);
    },
    async error(message: string) {
      await write('error', message);
    }
  };
}
