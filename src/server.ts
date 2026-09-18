import path from "path";
import express, { Request, Response } from "express";
import multer from "multer";
import { analyzeProject } from "./engine/analyzer";
import { extractZipToTemp, useLocalFolder } from "./engine/extract";
import { parseMetricsJson } from "./metrics/metricsLoader";
import { renderMarkdownReport } from "./report/markdown";
import { saveRun, getRun } from "./store";
import { rules } from "./rules";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4310;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/rules", (_req: Request, res: Response) => {
  res.json(rules.map(({ id, name, description, defaultSeverity }) => ({ id, name, description, defaultSeverity })));
});

app.post(
  "/api/analyze",
  upload.fields([
    { name: "projectZip", maxCount: 1 },
    { name: "metricsJson", maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const zipFile = files?.projectZip?.[0];
    const metricsFile = files?.metricsJson?.[0];
    const localPath = typeof req.body?.localPath === "string" ? req.body.localPath.trim() : "";

    if (!zipFile && !localPath) {
      res.status(400).json({ error: "Provide either a project zip file or a local folder path." });
      return;
    }

    let prepared;
    try {
      prepared = zipFile ? extractZipToTemp(zipFile.buffer) : useLocalFolder(localPath);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }

    try {
      const metrics = metricsFile ? parseMetricsJson(metricsFile.buffer.toString("utf8")) : undefined;
      const sourceLabel = zipFile ? zipFile.originalname : localPath;
      const result = analyzeProject(prepared.rootDir, sourceLabel, metrics);
      saveRun(result);
      res.json({ runId: result.runId, summary: result.summary });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      prepared.cleanup();
    }
  }
);

app.get("/api/runs/:id", (req: Request, res: Response) => {
  const result = getRun(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Run not found. It may have been from a previous server session." });
    return;
  }
  res.json(result);
});

app.get("/api/runs/:id/report.md", (req: Request, res: Response) => {
  const result = getRun(req.params.id);
  if (!result) {
    res.status(404).send("Run not found.");
    return;
  }
  const markdown = renderMarkdownReport(result);
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="outsystems-analysis-${result.runId}.md"`);
  res.send(markdown);
});

app.listen(PORT, () => {
  console.log(`OutSystems performance analyzer running at http://localhost:${PORT}`);
});
