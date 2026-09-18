import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";

export interface PreparedProject {
  rootDir: string;
  /** call after analysis to remove any temp directory created for this project */
  cleanup: () => void;
}

/**
 * Extracts an uploaded zip buffer into a fresh temp directory.
 */
export function extractZipToTemp(zipBuffer: Buffer): PreparedProject {
  const tempDir = path.join(os.tmpdir(), "outsystems-analyzer", crypto.randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(tempDir, true);

  return {
    rootDir: tempDir,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

/**
 * Uses an existing local folder path directly - no temp copy, nothing to
 * clean up afterwards.
 */
export function useLocalFolder(localPath: string): PreparedProject {
  const resolved = path.resolve(localPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Local path does not exist or is not a directory: ${resolved}`);
  }
  return { rootDir: resolved, cleanup: () => {} };
}

const SKIP_DIRS = new Set(["bin", "obj", "node_modules", ".git", ".vs"]);

export function walkCsFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".cs")) {
        results.push(path.join(dir, entry.name));
      }
    }
  }

  walk(rootDir);
  return results;
}
