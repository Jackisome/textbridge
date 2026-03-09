import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDiagnosticLogService } from './diagnostic-log-service';

describe('createDiagnosticLogService', () => {
  const originalLogLevel = process.env.TEXTBRIDGE_LOG_LEVEL;
  let temporaryDirectories: string[] = [];

  beforeEach(() => {
    delete process.env.TEXTBRIDGE_LOG_LEVEL;
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    if (originalLogLevel === undefined) {
      delete process.env.TEXTBRIDGE_LOG_LEVEL;
    } else {
      process.env.TEXTBRIDGE_LOG_LEVEL = originalLogLevel;
    }

    await Promise.all(
      temporaryDirectories.map((directoryPath) =>
        rm(directoryPath, { recursive: true, force: true })
      )
    );

    temporaryDirectories = [];
    vi.restoreAllMocks();
  });

  async function createTemporaryDirectory(): Promise<string> {
    const directoryPath = await mkdtemp(
      path.join(os.tmpdir(), 'textbridge-diagnostic-log-service-')
    );

    temporaryDirectories.push(directoryPath);
    return directoryPath;
  }

  it('defaults to debug when app is not packaged', () => {
    const service = createDiagnosticLogService({ isPackaged: false });

    expect(service.getLevel()).toBe('debug');
  });

  it('falls back to the default level when TEXTBRIDGE_LOG_LEVEL is invalid or blank', () => {
    process.env.TEXTBRIDGE_LOG_LEVEL = '   ';

    const blankService = createDiagnosticLogService({ isPackaged: false });

    expect(blankService.getLevel()).toBe('debug');

    process.env.TEXTBRIDGE_LOG_LEVEL = 'verbose';

    const invalidService = createDiagnosticLogService({ isPackaged: true });

    expect(invalidService.getLevel()).toBe('info');
  });

  it('uses TEXTBRIDGE_LOG_LEVEL to override the default and writes matching entries to console and file', async () => {
    process.env.TEXTBRIDGE_LOG_LEVEL = 'warn';

    const logsDirectoryPath = await createTemporaryDirectory();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const service = createDiagnosticLogService({
      isPackaged: false,
      logsDirectoryPath
    });

    expect(service.getLevel()).toBe('warn');

    await service.debug('debug details');
    await service.warn('warn details');
    await service.error('error details');

    const logContents = await readFile(
      path.join(logsDirectoryPath, 'diagnostic.log'),
      'utf-8'
    );

    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] warn details')
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] error details')
    );
    expect(logContents).not.toContain('[DEBUG] debug details');
    expect(logContents).toContain('[WARN] warn details');
    expect(logContents).toContain('[ERROR] error details');
  });

  it('uses a logs directory under baseDirectoryPath when logsDirectoryPath is omitted', async () => {
    const baseDirectoryPath = await createTemporaryDirectory();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const service = createDiagnosticLogService({
      isPackaged: true,
      baseDirectoryPath
    });

    expect(service.getLevel()).toBe('info');

    await service.info('base directory log');

    const logContents = await readFile(
      path.join(baseDirectoryPath, 'logs', 'diagnostic.log'),
      'utf-8'
    );

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] base directory log')
    );
    expect(logContents).toContain('[INFO] base directory log');
  });

  it('does not reject and still logs to console when file output fails', async () => {
    const baseDirectoryPath = await createTemporaryDirectory();
    const blockedLogsPath = path.join(baseDirectoryPath, 'blocked-log-target');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await writeFile(blockedLogsPath, 'occupied', 'utf-8');

    const service = createDiagnosticLogService({
      isPackaged: false,
      logsDirectoryPath: blockedLogsPath
    });

    await expect(service.warn('warn despite file failure')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] warn despite file failure')
    );
  });
});
