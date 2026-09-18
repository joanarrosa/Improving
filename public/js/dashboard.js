(function () {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");
  const resultsEl = document.getElementById("results");
  const summaryRowEl = document.getElementById("summary-row");
  const sourceLabelEl = document.getElementById("source-label");

  let currentResult = null;
  let activeSeverities = new Set(["high", "medium", "low"]);

  document.getElementById("new-analysis-btn").addEventListener("click", () => {
    window.location.href = "index.html";
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    if (!runId) return;
    window.location.href = `/api/runs/${encodeURIComponent(runId)}/report.md`;
  });

  document.querySelectorAll("#severity-filters input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      activeSeverities = new Set(
        [...document.querySelectorAll("#severity-filters input[type=checkbox]:checked")].map((c) => c.value)
      );
      render();
    });
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSummary(summary) {
    summaryRowEl.innerHTML = `
      <div class="stat"><div class="num">${summary.totalFindings}</div><div>Total findings</div></div>
      <div class="stat high"><div class="num">${summary.bySeverity.high}</div><div>High</div></div>
      <div class="stat medium"><div class="num">${summary.bySeverity.medium}</div><div>Medium</div></div>
      <div class="stat low"><div class="num">${summary.bySeverity.low}</div><div>Low</div></div>
    `;
  }

  function renderFinding(f) {
    const runtime = f.runtimeData
      ? `<p><strong>Runtime data:</strong> ${f.runtimeData.avgExecutionsPerRequest ?? "?"} avg executions/request, ${
          f.runtimeData.avgResponseTimeMs ?? "?"
        }ms avg response time</p>`
      : "";
    const snippet = f.snippet ? `<div class="snippet">${escapeHtml(f.snippet)}</div>` : "";
    return `
      <div class="finding ${f.severity}">
        <div class="finding-title">
          <span class="badge ${f.severity}">${f.severity}</span>${escapeHtml(f.title)}
        </div>
        <div class="finding-loc">${escapeHtml(f.file)}:${f.line}${f.method ? " in " + escapeHtml(f.method) : ""} — ${f.ruleId}</div>
        <p>${escapeHtml(f.explanation)}</p>
        <p><strong>Suggested fix:</strong> ${escapeHtml(f.suggestion)}</p>
        ${runtime}
        ${snippet}
      </div>
    `;
  }

  function render() {
    if (!currentResult) return;

    const modulesHtml = currentResult.modules
      .map((module) => {
        const screensHtml = module.screens
          .map((screen) => {
            const findings = screen.findings.filter((f) => activeSeverities.has(f.severity));
            if (findings.length === 0) return "";
            return `
              <div class="screen-header">${escapeHtml(screen.screenOrAction)}</div>
              ${findings.map(renderFinding).join("")}
            `;
          })
          .join("");
        if (!screensHtml.trim()) return "";
        return `
          <div class="module-group">
            <div class="module-header">${escapeHtml(module.module)}</div>
            ${screensHtml}
          </div>
        `;
      })
      .join("");

    resultsEl.innerHTML = modulesHtml.trim()
      ? modulesHtml
      : `<div class="empty">No findings match the selected filters.</div>`;
  }

  async function load() {
    if (!runId) {
      resultsEl.innerHTML = `<div class="empty">No run selected. <a href="index.html">Start a new analysis</a>.</div>`;
      return;
    }
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        resultsEl.innerHTML = `<div class="empty">${escapeHtml(data.error || "Run not found.")} <a href="index.html">Start a new analysis</a>.</div>`;
        return;
      }
      currentResult = await res.json();
      sourceLabelEl.textContent = `Source: ${currentResult.sourceLabel} — generated ${new Date(
        currentResult.generatedAt
      ).toLocaleString()}${currentResult.metricsApplied ? " — runtime metrics merged" : ""}`;
      renderSummary(currentResult.summary);
      render();
    } catch (err) {
      resultsEl.innerHTML = `<div class="empty">Failed to load run: ${escapeHtml(err.message)}</div>`;
    }
  }

  load();
})();
