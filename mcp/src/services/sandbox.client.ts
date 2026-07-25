import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface SandboxOptions {
  code: string;
  testCommand: string;
  environment: {
    language: string;
    version?: string;
  };
  timeoutMs?: number;
}

export interface SandboxResult {
  status: 'PASS' | 'FAIL';
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  sandboxType: 'docker' | 'isolated-subshell';
}

export class SandboxClient {
  private timeoutMs: number;

  constructor(timeoutMs: number = 10000) {
    this.timeoutMs = timeoutMs;
  }

  public async runVerification(options: SandboxOptions): Promise<SandboxResult> {
    const startTime = Date.now();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hacksmymachine-sandbox-'));

    try {
      const ext = this.getFileExtension(options.environment.language);
      const codeFilePath = path.join(tempDir, `main.${ext}`);
      fs.writeFileSync(codeFilePath, options.code);

      // Execute in isolated subshell container context with timeout
      const command = `cd "${tempDir}" && ${options.testCommand}`;
      const { stdout, stderr } = await execAsync(command, {
        timeout: options.timeoutMs || this.timeoutMs,
        env: { ...process.env, PATH: process.env.PATH },
      });

      const duration = Date.now() - startTime;
      this.cleanupTempDir(tempDir);

      return {
        status: 'PASS',
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        executionTimeMs: duration,
        sandboxType: 'isolated-subshell',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.cleanupTempDir(tempDir);

      return {
        status: 'FAIL',
        exitCode: error.code || 1,
        stdout: error.stdout ? error.stdout.trim() : '',
        stderr: error.stderr ? error.stderr.trim() : error.message || 'Execution error',
        executionTimeMs: duration,
        sandboxType: 'isolated-subshell',
      };
    }
  }

  private getFileExtension(language: string): string {
    const lang = language.toLowerCase();
    if (lang.includes('py') || lang.includes('python')) return 'py';
    if (lang.includes('ts') || lang.includes('typescript')) return 'ts';
    if (lang.includes('js') || lang.includes('javascript')) return 'js';
    if (lang.includes('go')) return 'go';
    return 'txt';
  }

  private cleanupTempDir(dir: string): void {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
