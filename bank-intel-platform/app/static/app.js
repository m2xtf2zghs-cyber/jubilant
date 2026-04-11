const API = "/api";
const TYPE_OPTIONS = [
  "SALES",
  "PURCHASE",
  "EXPENSE",
  "BANK FIN",
  "PVT FIN",
  "NAMES",
  "CASH",
  "DOUBT",
  "RETURN",
  "REVERSAL",
  "INSURANCE",
  "SIS CON",
  "UNMATCH SIS CON",
  "INB TRF",
  "UNMATCH INB TRF",
  "ODD FIG",
  "PROP",
];

const state = {
  jobs: [],
  activeJobId: null,
  transactions: [],
};

const els = {
  uploadForm: document.getElementById("uploadForm"),
  uploadStatus: document.getElementById("uploadStatus"),
  jobList: document.getElementById("jobList"),
  activeJobTitle: document.getElementById("activeJobTitle"),
  jobMeta: document.getElementById("jobMeta"),
  jobRules: document.getElementById("jobRules"),
  txnTableBody: document.getElementById("txnTableBody"),
  refreshJobsBtn: document.getElementById("refreshJobsBtn"),
  saveRulesBtn: document.getElementById("saveRulesBtn"),
  reparseBtn: document.getElementById("reparseBtn"),
  exportBtn: document.getElementById("exportBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  searchInput: document.getElementById("searchInput"),
  txnRowTemplate: document.getElementById("txnRowTemplate"),
};

function buildBorrowerYaml(form) {
  const metadata = {
    account_holder: form.get("account_holder") || "",
    address: form.get("address") || "",
    email: form.get("email") || "",
    pan: form.get("pan") || "",
    mobile: form.get("mobile") || "",
    analyst_name: form.get("analyst_name") || "ANALYST",
    other_bank_note: form.get("other_bank_note") || "NO",
    feedback: form.get("feedback") || "",
  };

  const metadataYaml = [
    "case_metadata:",
    ...Object.entries(metadata).map(([key, value]) => `  ${key}: ${yamlScalar(value)}`),
  ].join("\n");

  const custom = (form.get("yaml_rules") || "").trim();
  return custom ? `${metadataYaml}\n${custom}\n` : `${metadataYaml}\n`;
}

function yamlScalar(value) {
  const text = String(value || "");
  if (!text) return '""';
  return JSON.stringify(text);
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res.text();
}

async function loadJobs() {
  state.jobs = await request(`${API}/jobs`);
  renderJobs();
  if (!state.activeJobId && state.jobs.length) {
    await openJob(state.jobs[0].id);
  }
}

function renderJobs() {
  els.jobList.innerHTML = "";
  state.jobs.forEach((job) => {
    const btn = document.createElement("button");
    btn.className = `job-card ${job.id === state.activeJobId ? "active" : ""}`;
    btn.innerHTML = `<strong>${job.name}</strong><br><small>${job.status} • ${job.id}</small>`;
    btn.addEventListener("click", () => openJob(job.id));
    els.jobList.appendChild(btn);
  });
}

async function openJob(jobId) {
  state.activeJobId = jobId;
  renderJobs();
  const [job, transactions, rules] = await Promise.all([
    request(`${API}/jobs/${jobId}`),
    request(`${API}/jobs/${jobId}/transactions`),
    request(`${API}/jobs/${jobId}/rules`),
  ]);
  state.transactions = transactions;
  els.activeJobTitle.textContent = `${job.name} (${job.status})`;
  els.jobRules.value = rules.borrower_rules_yaml || "";
  els.jobMeta.textContent = [
    `Job ID: ${job.id}`,
    `Inputs: ${job.input_count}`,
    `Updated: ${new Date(job.updated_at).toLocaleString()}`,
  ].join("\n");
  renderTransactions();
}

function renderTransactions() {
  const needle = els.searchInput.value.trim().toLowerCase();
  els.txnTableBody.innerHTML = "";
  state.transactions
    .filter((txn) => {
      if (!needle) return true;
      return [
        txn.raw_narration,
        txn.normalized_party,
        txn.classification_primary,
        txn.source_account_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .slice(0, 300)
    .forEach((txn) => {
      const row = els.txnRowTemplate.content.firstElementChild.cloneNode(true);
      row.querySelector('[data-cell="id"]').textContent = txn.id;
      row.querySelector('[data-cell="date"]').textContent = txn.txn_date || "";
      row.querySelector('[data-cell="account"]').textContent = `${txn.source_bank}-${(txn.source_account_no || "").slice(-4)}-${txn.source_account_type || ""}`;
      row.querySelector('[data-cell="dr"]').textContent = Number(txn.debit || 0).toLocaleString("en-IN");
      row.querySelector('[data-cell="cr"]').textContent = Number(txn.credit || 0).toLocaleString("en-IN");
      row.querySelector('[data-cell="desc"]').textContent = txn.raw_narration;

      const select = row.querySelector('[data-field="classification_primary"]');
      TYPE_OPTIONS.forEach((type) => {
        const opt = document.createElement("option");
        opt.value = type;
        opt.textContent = type;
        if (type === txn.classification_primary) opt.selected = true;
        select.appendChild(opt);
      });

      row.querySelector('[data-field="normalized_party"]').value = txn.normalized_party || "";
      row.querySelector('[data-field="analyst_notes"]').value = txn.analyst_notes || "";
      row.querySelector('[data-action="save"]').addEventListener("click", async () => {
        await saveOverride(txn.id, {
          classification_primary: select.value,
          normalized_party: row.querySelector('[data-field="normalized_party"]').value,
          analyst_notes: row.querySelector('[data-field="analyst_notes"]').value,
        });
      });
      els.txnTableBody.appendChild(row);
    });
}

async function saveOverride(transactionId, patch) {
  if (!state.activeJobId) return;
  await request(`${API}/overrides/${state.activeJobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_id: transactionId,
      classification_primary: patch.classification_primary,
      normalized_party: patch.normalized_party,
      analyst_notes: patch.analyst_notes,
    }),
  });
  await openJob(state.activeJobId);
}

els.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(els.uploadForm);
  const payload = new FormData();
  payload.append("job_name", form.get("job_name"));
  payload.append("borrower_rules_yaml", buildBorrowerYaml(form));
  for (const file of document.getElementById("fileInput").files) {
    payload.append("files", file);
  }
  els.uploadStatus.textContent = "Uploading and parsing...";
  try {
    const res = await request(`${API}/parse/upload`, {
      method: "POST",
      body: payload,
    });
    els.uploadStatus.textContent = `Parsed ${res.job_id}`;
    await loadJobs();
    await openJob(res.job_id);
  } catch (err) {
    els.uploadStatus.textContent = err.message;
  }
});

els.refreshJobsBtn.addEventListener("click", () => loadJobs());
els.searchInput.addEventListener("input", () => renderTransactions());

els.saveRulesBtn.addEventListener("click", async () => {
  if (!state.activeJobId) return;
  await request(`${API}/jobs/${state.activeJobId}/rules`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ borrower_rules_yaml: els.jobRules.value }),
  });
  await openJob(state.activeJobId);
});

els.reparseBtn.addEventListener("click", async () => {
  if (!state.activeJobId) return;
  await request(`${API}/parse/${state.activeJobId}`, { method: "POST" });
  await openJob(state.activeJobId);
});

els.exportBtn.addEventListener("click", async () => {
  if (!state.activeJobId) return;
  await request(`${API}/exports/${state.activeJobId}`, { method: "POST" });
});

els.downloadBtn.addEventListener("click", () => {
  if (!state.activeJobId) return;
  window.open(`${API}/exports/${state.activeJobId}/latest`, "_blank");
});

loadJobs().catch((err) => {
  els.uploadStatus.textContent = err.message;
});
