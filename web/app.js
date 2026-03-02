const state = {
  files: [],
  mode: "demo",
};

const $ = (id) => document.getElementById(id);
const fileInput = $("fileInput");
const dropzone = $("dropzone");
const fileList = $("fileList");
const fileCount = $("fileCount");
const runBtn = $("runBtn");
const runMode = $("runMode");
const modeBadge = $("modeBadge");
const statusLabel = $("statusLabel");
const progressBar = $("progressBar");
const phaseList = $("phaseList");
const runMessage = $("runMessage");

const xlsxLink = $("xlsxLink");
const jsonLink = $("jsonLink");
const finalLink = $("finalLink");

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function renderFiles() {
  fileList.innerHTML = "";
  fileCount.textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"}`;

  for (const file of state.files) {
    const li = document.createElement("li");
    li.className = "file-item";

    const name = document.createElement("p");
    name.className = "file-name";
    name.textContent = file.name;

    const meta = document.createElement("p");
    meta.className = "file-meta";
    meta.textContent = `${formatBytes(file.size)} • ${file.type || "unknown type"}`;

    li.append(name, meta);
    fileList.appendChild(li);
  }
}

function setMode(mode) {
  state.mode = mode;
  modeBadge.textContent = mode === "demo" ? "Demo Mode" : "API Mode";
}

function setProgress(percent, label) {
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  statusLabel.textContent = label;
}

function resetExports() {
  for (const link of [xlsxLink, jsonLink, finalLink]) {
    link.classList.add("disabled");
    link.removeAttribute("download");
    link.href = "#";
  }
}

function enableDownload(link, filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.classList.remove("disabled");
}

function updatePhases(phases, doneCount) {
  phaseList.innerHTML = "";
  phases.forEach((phase, index) => {
    const li = document.createElement("li");
    li.textContent = phase;
    if (index < doneCount) li.classList.add("done");
    phaseList.appendChild(li);
  });
}

async function runDemo() {
  const phases = [
    "Ingesting files",
    "Extracting rows",
    "Running reconciliation",
    "Classifying transactions",
    "Applying underwriting",
    "Preparing workbook",
  ];

  setProgress(0, "Starting");
  updatePhases(phases, 0);

  for (let i = 0; i < phases.length; i += 1) {
    await new Promise((r) => setTimeout(r, 550));
    setProgress(((i + 1) / phases.length) * 100, phases[i]);
    updatePhases(phases, i + 1);
  }

  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const entity = ($("entityName").value || "Entity").replace(/\s+/g, "_");

  enableDownload(
    xlsxLink,
    `${entity}_MoneyLenderStatementAnalyser_${stamp}.txt`,
    "Demo run complete. Replace demo mode with API mode to fetch real workbook bytes.",
  );
  enableDownload(
    jsonLink,
    `${entity}_canonical_demo_${stamp}.json`,
    JSON.stringify(
      {
        status: "DEMO",
        files: state.files.map((f) => ({ name: f.name, size: f.size })),
        generated_at: now.toISOString(),
      },
      null,
      2,
    ),
    "application/json",
  );
  enableDownload(
    finalLink,
    `${entity}_FINAL_demo_${stamp}.txt`,
    "Street Verdict: HOLD\nReason: Demo mode output placeholder",
  );

  runMessage.textContent = "Demo run completed. Switch to API mode for real backend execution.";
}

async function runApi() {
  const apiBase = ($("apiBase").value || "").trim().replace(/\/$/, "");
  if (!apiBase) {
    throw new Error("API base URL is required for API mode.");
  }

  const fd = new FormData();
  fd.append("entity", $("entityName").value || "Entity");
  fd.append("strict_recon", String($("strictRecon").checked));
  fd.append("include_underwriting", String($("includeUnderwriting").checked));
  for (const file of state.files) {
    fd.append("inputs", file);
  }

  setProgress(15, "Submitting job");
  updatePhases(["Submitting to backend", "Processing", "Downloading outputs"], 1);

  const response = await fetch(`${apiBase}/analyze`, {
    method: "POST",
    body: fd,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const analysisId = data.analysis_id;
  if (!analysisId) {
    throw new Error("Backend did not return analysis_id.");
  }
  setProgress(35, "Job submitted");
  updatePhases(["Submitting to backend", "Processing", "Downloading outputs"], 1);

  const resolveApiUrl = (u) => {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return `${apiBase}${u.startsWith("/") ? "" : "/"}${u}`;
  };

  const statusUrl = resolveApiUrl(data.status_url || `/status/${analysisId}`);
  const terminal = new Set(["PASS", "WARN_OR_FAIL", "FAIL"]);
  let statusData = null;

  for (let i = 0; i < 120; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const sres = await fetch(statusUrl);
    if (!sres.ok) {
      continue;
    }
    statusData = await sres.json();
    const st = String(statusData.status || "");
    if (terminal.has(st)) {
      break;
    }
    const pct = Math.min(85, 35 + i);
    setProgress(pct, `Processing (${st || "RUNNING"})`);
    updatePhases(["Submitting to backend", "Processing", "Downloading outputs"], 2);
  }

  if (!statusData) {
    throw new Error(`Unable to fetch status for analysis ${analysisId}.`);
  }
  if (String(statusData.status) === "FAIL") {
    throw new Error(statusData.error || `Analysis ${analysisId} failed.`);
  }

  const xlsxUrl = statusData.xlsx_url || data.xlsx_url;
  const jsonUrl = statusData.json_url || data.json_url;
  const finalUrl = statusData.final_url || data.final_url;

  if (xlsxUrl) {
    xlsxLink.href = resolveApiUrl(xlsxUrl);
    xlsxLink.classList.remove("disabled");
  }
  if (jsonUrl) {
    jsonLink.href = resolveApiUrl(jsonUrl);
    jsonLink.classList.remove("disabled");
  }
  if (finalUrl) {
    finalLink.href = resolveApiUrl(finalUrl);
    finalLink.classList.remove("disabled");
  }

  setProgress(100, "Done");
  updatePhases(["Submitting to backend", "Processing", "Downloading outputs"], 3);
  runMessage.textContent = `Analysis completed. ID: ${analysisId}`;
}

async function onRun() {
  resetExports();
  runMessage.textContent = "";

  if (!state.files.length) {
    runMessage.textContent = "Upload at least one statement file first.";
    return;
  }

  runBtn.disabled = true;
  runBtn.textContent = "Running...";

  try {
    if (state.mode === "demo") {
      await runDemo();
    } else {
      await runApi();
    }
  } catch (err) {
    setProgress(0, "Failed");
    runMessage.textContent = err instanceof Error ? err.message : "Unknown run failure";
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Run Analysis";
  }
}

fileInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  state.files = files;
  renderFiles();
});

runMode.addEventListener("change", (event) => {
  setMode(event.target.value);
});

runBtn.addEventListener("click", onRun);

["dragenter", "dragover"].forEach((name) => {
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((name) => {
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer?.files || []);
  state.files = files.filter((f) => /\.(pdf|csv|xls|xlsx)$/i.test(f.name));
  renderFiles();
});

setMode("demo");
setProgress(0, "Idle");
updatePhases([], 0);
