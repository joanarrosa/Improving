# OutSystems Performance Analyzer

A small local web app that statically analyzes an **exported .NET project**
(from Service Studio for O11, or ODC Studio for ODC) to flag common
OutSystems performance issues before they hit production — N+1 queries,
duplicate/redundant integration calls, missing timeout/retry, unbounded
data fetches, and cacheable repeated action calls.

This is pattern-based (regex + light brace-matching, not a full C#
compiler/AST), by design: it's meant to be fast, obvious to extend, and
good enough to catch the common cases, not a perfect semantic analyzer.

> Input is the **read-only .NET code export** of a module, not the raw
> `.oml` file. In Service Studio / ODC Studio: export the module, unzip it
> (or point the tool at the unzipped folder directly).

## Stack

- Backend: Node.js + Express + TypeScript
- Frontend: plain HTML/CSS/vanilla JS (no build step, no framework)
- Storage: in-memory, per server run (this is a local single-user dev
  tool — restart the server and past runs are gone; export the Markdown
  report if you want to keep one)

## Setup

Requires the `git` CLI on your PATH (only needed for the "GitHub URL" input mode below - it shells out to `git clone`).

```bash
npm install
npm run dev      # starts the server on http://localhost:4310 (via tsx, no build step)
```

Or, for a compiled run:

```bash
npm run build
npm start
```

Set `PORT` to change the port.

## Using it

1. Open `http://localhost:4310`.
2. Pick one input mode:
   - **GitHub URL** — paste a public repo URL (`https://github.com/owner/repo`)
     or a "tree" URL naming a branch and/or subfolder
     (`https://github.com/owner/repo/tree/branch/path/to/module`) and the
     server shallow-clones it for you. Public repos only - no credentials
     are ever sent.
   - **Upload .zip** — the exported .NET project, zipped.
   - **Local folder path** — an absolute path to an already-unzipped
     project already on this machine.
3. Optionally attach a `metrics.json` (see **Runtime metrics** below).
4. Click **Analyze** → you're taken to the dashboard, findings grouped by
   module → screen/action, each with a severity tag.
5. Filter by severity, or click **Export Markdown report** to download the
   current findings as a `.md` file.

A synthetic sample project that deliberately trips every rule lives in
`samples/sample-export/` in this repo. Try it via the GitHub URL field:
`https://github.com/joanarrosa/Improving/tree/claude/affectionate-ptolemy-wvad9y/samples/sample-export`
(or via "local folder path" if you already have this repo cloned).

## What it checks

| Rule ID | What it flags | Default severity |
|---|---|---|
| `OS-N1-001` | A DB/aggregate/entity call executed inside a `for`/`foreach`/`while` loop (N+1 pattern) | High |
| `OS-DUP-002` | The same external integration/API call made ≥2× with identical arguments in one method | Medium |
| `OS-TIMEOUT-003` | An `HttpClient`/`RestClient`/`SoapClient`/`WebRequest` created with no visible timeout and/or retry handling | Medium |
| `OS-UNBOUND-004` | A list/aggregate fetch with no arguments and no paging/filter keywords anywhere in the method | High |
| `OS-CACHE-005` | The same internal action called ≥2× with identical arguments and no visible caching | Low |

Each finding includes: file + approximate line + method, a plain-language
explanation of the risk, and a suggested fix.

These are naming/shape heuristics tuned for what OutSystems-generated
.NET code tends to look like (namespaced per module, one class per
screen/action, query/entity/integration calls with recognizable naming).
Real exports vary — expect to tune the regexes in `src/rules/patterns.ts`
against your own exports.

## Architecture

```
src/
  types.ts                 Finding/Rule/AnalysisResult shared types
  parseCSharp.ts            brace-matching method/loop/call extraction (the "mini-parser")
  rules/                    one file per rule - see "Adding a rule" below
    patterns.ts             shared regex heuristics (DB calls, integration names, etc.)
    n1Query.ts
    duplicateApiCall.ts
    missingTimeoutRetry.ts
    unboundedFetch.ts
    repeatedInternalAction.ts
    index.ts                 rule registry
  engine/
    extract.ts              zip extraction / local folder walk
    githubUrl.ts             GitHub URL parsing + shallow clone to a temp dir
    deriveNames.ts           module & screen/action name heuristics
    grouping.ts              group findings by module -> screen, build summary
    analyzer.ts               orchestrates: walk files -> run rules -> group -> return result
  metrics/metricsLoader.ts    optional metrics.json merge (phase-2 extension point, see below)
  report/markdown.ts          Markdown report renderer
  store.ts                    in-memory run store
  server.ts                   Express app & routes
public/                       static frontend (upload screen + dashboard)
samples/                      synthetic OutSystems-style C# project + example metrics.json
```

### Adding a rule

Rules are self-contained and registered in one place:

1. Create `src/rules/myRule.ts` exporting an object implementing the
   `Rule` interface from `src/types.ts` (`id`, `name`, `description`,
   `defaultSeverity`, and an `analyze(ctx)` function returning `Finding[]`).
2. Add it to the array in `src/rules/index.ts`.

`ctx` gives you the file's raw source, its relative path, the derived
module/screen names, and pre-extracted method boundaries
(`extractMethods`). Use the helpers in `src/parseCSharp.ts`
(`extractLoops`, `extractCalls`, `lineForOffset`, `snippetAround`) to stay
consistent with the existing rules. Nothing in the engine, server, or
frontend needs to change.

## Runtime metrics (phase 2 extension point)

Static analysis can tell you a pattern *exists*; it can't tell you how hot
it actually runs in production. That's planned as phase 2 (pulling real
execution counts/timings from Service Center / LifeTime) — **not built
here**. What exists today is the merge point: optionally attach a
`metrics.json` when analyzing, shaped like:

```json
{
  "actions": [
    {
      "module": "CatalogModule",
      "action": "RefreshProductPrices",
      "avgExecutionsPerRequest": 18,
      "avgResponseTimeMs": 640
    }
  ]
}
```

Entries are matched by `(module, action == screen/action name)`. When a
match is found with a high `avgExecutionsPerRequest`, low/medium findings
for that action are escalated to `high` and the finding carries the
runtime numbers alongside the static explanation, both in the dashboard
and the Markdown export. A working example is in
`samples/metrics.sample.json`. When the real Service Center/LifeTime
integration is built later, it just needs to produce this same shape (or
`applyMetrics` in `src/metrics/metricsLoader.ts` adjusted) — nothing else
in the pipeline changes.

## Known limitations

- The C# "parsing" is regex + brace-counting, not a real compiler front
  end. It handles common formatting well but can miss unusual styles
  (e.g. loops without braces, heavily obfuscated generated code).
- Rules match on naming conventions (e.g. `GetById`, `Integration`,
  `HttpClient`) rather than true semantics — expect some false
  positives/negatives on unfamiliar codebases, and tune
  `src/rules/patterns.ts` accordingly.
- Findings are in-memory only; restarting the server clears history.
  Export the Markdown report for anything you want to keep.
