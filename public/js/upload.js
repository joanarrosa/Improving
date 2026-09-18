(function () {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  let activeTab = "url";

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
      tabPanels.forEach((p) => p.classList.toggle("active", p.dataset.tabPanel === activeTab));
    });
  });

  const form = document.getElementById("analyze-form");
  const statusEl = document.getElementById("status");
  const submitBtn = document.getElementById("submit-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const urlInput = document.getElementById("repoUrl");
    const zipInput = document.getElementById("projectZip");
    const pathInput = document.getElementById("localPath");
    const metricsInput = document.getElementById("metricsJson");

    const formData = new FormData();
    if (activeTab === "url") {
      if (!urlInput.value.trim()) {
        setStatus("Paste a GitHub repo URL first.", true);
        return;
      }
      formData.append("repoUrl", urlInput.value.trim());
    } else if (activeTab === "zip") {
      if (!zipInput.files[0]) {
        setStatus("Choose a .zip file first.", true);
        return;
      }
      formData.append("projectZip", zipInput.files[0]);
    } else {
      if (!pathInput.value.trim()) {
        setStatus("Enter a local folder path first.", true);
        return;
      }
      formData.append("localPath", pathInput.value.trim());
    }
    if (metricsInput.files[0]) {
      formData.append("metricsJson", metricsInput.files[0]);
    }

    submitBtn.disabled = true;
    setStatus(activeTab === "url" ? "Cloning and analyzing repo…" : "Analyzing project…", false);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Analysis failed.", true);
        submitBtn.disabled = false;
        return;
      }
      setStatus(`Found ${data.summary.totalFindings} finding(s). Opening dashboard…`, false);
      window.location.href = `dashboard.html?runId=${encodeURIComponent(data.runId)}`;
    } catch (err) {
      setStatus("Request failed: " + err.message, true);
      submitBtn.disabled = false;
    }
  });

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", Boolean(isError));
  }
})();
