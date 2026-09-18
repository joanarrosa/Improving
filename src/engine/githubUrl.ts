import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { PreparedProject } from "./extract";

export interface ParsedGitHubUrl {
  cloneUrl: string;
  /** branch name, or the "tree" segment still needing disambiguation against real branches (may contain slashes) */
  branchOrPath?: string;
  /** subfolder within the repo to analyze, e.g. when the URL points at a module folder, not the repo root */
  subpath: string;
}

const TREE_URL_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/tree\/(.+?)\/?$/;
const REPO_URL_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/;

/**
 * Accepts a plain GitHub repo URL (analyzes the default branch's root) or a
 * "tree" URL that names a branch and, optionally, a subfolder (e.g. when a
 * monorepo holds the exported module a few levels down). Falls back to
 * treating the input as a direct git remote URL (e.g. GitLab/Bitbucket/a
 * bare .git URL) for anything that isn't github.com.
 *
 * Branch names can themselves contain slashes (e.g. "claude/foo"), which
 * makes "/tree/<branch>/<path>" ambiguous from the URL text alone - the
 * whole segment after "/tree/" is returned as `branchOrPath` and resolved
 * against the repo's real branches by the caller (see resolveBranchAndSubpath).
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  const treeMatch = url.match(TREE_URL_RE);
  if (treeMatch) {
    const [, owner, repo, branchOrPath] = treeMatch;
    return { cloneUrl: `https://github.com/${owner}/${repo}.git`, branchOrPath, subpath: "" };
  }

  const repoMatch = url.match(REPO_URL_RE);
  if (repoMatch) {
    const [, owner, repo] = repoMatch;
    return { cloneUrl: `https://github.com/${owner}/${repo}.git`, subpath: "" };
  }

  return { cloneUrl: url, subpath: "" };
}

/**
 * Given the ambiguous "<branch>/<subpath>" text from a tree URL, finds
 * which of the repo's real remote branches it starts with (preferring the
 * longest/most specific match) and splits off the remainder as the subpath.
 */
function resolveBranchAndSubpath(cloneUrl: string, branchOrPath: string): { branch: string; subpath: string } {
  const output = execFileSync("git", ["ls-remote", "--heads", cloneUrl], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const branches = output
    .split("\n")
    .map((line) => line.split("refs/heads/")[1])
    .filter((name): name is string => Boolean(name && name.trim()))
    .map((name) => name.trim());

  const matches = branches
    .filter((name) => branchOrPath === name || branchOrPath.startsWith(`${name}/`))
    .sort((a, b) => b.length - a.length);

  if (matches.length === 0) {
    throw new Error(`No branch on the remote matches "${branchOrPath}".`);
  }

  const branch = matches[0];
  const subpath = branchOrPath === branch ? "" : branchOrPath.slice(branch.length + 1);
  return { branch, subpath };
}

/**
 * Shallow-clones the given repo URL (public repos only - no credentials are
 * ever passed) into a fresh temp directory and resolves to the requested
 * subpath within it.
 */
export function cloneRepoToTemp(rawUrl: string): PreparedProject {
  const parsed = parseGitHubUrl(rawUrl.trim());
  const { cloneUrl } = parsed;
  let { subpath } = parsed;
  let branch: string | undefined;

  if (parsed.branchOrPath) {
    try {
      const resolved = resolveBranchAndSubpath(cloneUrl, parsed.branchOrPath);
      branch = resolved.branch;
      subpath = resolved.subpath;
    } catch (err) {
      throw new Error(
        `Couldn't resolve "${parsed.branchOrPath}" to a branch on "${cloneUrl}": ` +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }

  const tempDir = path.join(os.tmpdir(), "outsystems-analyzer", crypto.randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });

  const cleanup = () => fs.rmSync(tempDir, { recursive: true, force: true });

  const args = ["clone", "--depth", "1"];
  if (branch) args.push("--branch", branch);
  args.push(cloneUrl, tempDir);

  try {
    execFileSync("git", args, {
      stdio: "pipe",
      timeout: 60_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (err) {
    cleanup();
    const stderr = err instanceof Error && "stderr" in err ? String((err as any).stderr) : "";
    const reason = /could not read Username|Authentication failed|not found/i.test(stderr)
      ? "it doesn't exist, is private, or the URL is wrong"
      : stderr.trim().split("\n").slice(-1)[0] || "unknown error";
    throw new Error(
      `Failed to clone "${cloneUrl}"${branch ? ` (branch "${branch}")` : ""}: ${reason}. ` +
        "Only public repositories are supported."
    );
  }

  const rootDir = subpath ? path.join(tempDir, subpath) : tempDir;
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    cleanup();
    throw new Error(`Cloned the repo but couldn't find the folder "${subpath}" inside it.`);
  }

  return { rootDir, cleanup };
}
