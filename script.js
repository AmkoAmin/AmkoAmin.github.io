// ---------- typed tagline ----------
const phrases = [
  "systems programming in C/C++",
  "RAG pipelines & LLM integration",
  "autonomous robots with ROS 2",
  "distributed systems & real-time data",
];

const typedEl = document.getElementById("typed");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reduceMotion) {
  typedEl.textContent = phrases[0];
} else {
  let phrase = 0;
  let pos = 0;
  let deleting = false;

  function tick() {
    const current = phrases[phrase];

    if (!deleting) {
      pos++;
      typedEl.textContent = current.slice(0, pos);
      if (pos === current.length) {
        deleting = true;
        setTimeout(tick, 2200);
        return;
      }
      setTimeout(tick, 55);
    } else {
      pos--;
      typedEl.textContent = current.slice(0, pos);
      if (pos === 0) {
        deleting = false;
        phrase = (phrase + 1) % phrases.length;
      }
      setTimeout(tick, 28);
    }
  }

  tick();
}

// ---------- pdf lab ----------
// Local preview (file:// or localhost) talks to the dev backend directly;
// the deployed site goes through the Cloudflare Tunnel.
const API_BASE = ["localhost", "127.0.0.1", ""].includes(location.hostname)
  ? "http://localhost:8000"
  : "https://api.aminskenderi.me";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const badge = document.getElementById("uplink-badge");
const offlinePanel = document.getElementById("lab-offline");
const labUi = document.getElementById("lab-ui");
const retryBtn = document.getElementById("retry-uplink");
const dropzone = document.getElementById("dropzone");
const dropzoneText = document.getElementById("dropzone-text");
const fileInput = document.getElementById("file-input");
const askForm = document.getElementById("ask-form");
const questionInput = document.getElementById("question");
const askBtn = document.getElementById("ask-btn");
const log = document.getElementById("lab-log");

let documentIndexed = false;

function setBadge(state, text) {
  badge.className = `uplink-badge ${state}`;
  badge.innerHTML = "";
  const dot = document.createElement("span");
  dot.className = "uplink-dot";
  badge.append(dot, text);
}

function logLine(cls, text) {
  const p = document.createElement("p");
  p.className = cls;
  p.textContent = text;
  log.prepend(p);
  return p;
}

function logSources(sources) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = `sources [${sources.length}]`;
  details.append(summary);
  for (const src of sources) {
    const chunk = document.createElement("p");
    chunk.className = "source-chunk";
    const origin = src.metadata && src.metadata.source ? `${src.metadata.source}: ` : "";
    chunk.textContent = origin + src.content;
    details.append(chunk);
  }
  log.prepend(details);
}

async function apiErrorMessage(response) {
  let detail = "";
  try {
    detail = (await response.json()).detail || "";
  } catch {
    // non-JSON error body
  }
  switch (response.status) {
    case 429:
      return "rate limit hit — easy on my anthropic credits :) try again in a minute";
    case 409:
      return "the index is empty — upload a document first";
    case 413:
      return "file too large (max 10 MB)";
    case 422:
      return detail || "couldn't read that document — is it a real pdf/txt?";
    default:
      return detail || `backend error (${response.status})`;
  }
}

async function checkUplink() {
  setBadge("", "checking uplink…");
  try {
    const response = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error();
    setBadge("online", "uplink online");
    offlinePanel.classList.add("hidden");
    labUi.classList.remove("hidden");
  } catch {
    setBadge("offline", "uplink offline");
    labUi.classList.add("hidden");
    offlinePanel.classList.remove("hidden");
  }
}

function setAskEnabled(enabled) {
  questionInput.disabled = !enabled;
  askBtn.disabled = !enabled;
}

async function ingest(file) {
  if (!file) return;
  if (file.size > MAX_UPLOAD_BYTES) {
    logLine("log-err", `! ${file.name}: file too large (max 10 MB)`);
    return;
  }

  dropzone.classList.add("busy");
  dropzoneText.textContent = `[ indexing ${file.name} … ]`;
  const busy = logLine("log-busy", `# uploading + embedding ${file.name} …`);

  try {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API_BASE}/rag/ingest`, {
      method: "POST",
      body: form,
    });
    busy.remove();
    if (!response.ok) {
      dropzoneText.textContent = "[ drop a pdf here — or click to upload ]";
      logLine("log-err", `! ${await apiErrorMessage(response)}`);
      return;
    }
    const data = await response.json();
    documentIndexed = true;
    questionInput.placeholder = "ask the document anything…";
    dropzone.classList.add("indexed");
    dropzoneText.textContent = `[ ${data.filename} — ${data.chunks_indexed} chunks indexed. drop another file to add more ]`;
    logLine("log-info", `# ${data.filename} indexed (${data.chunks_indexed} chunks) — ask away`);
    setAskEnabled(true);
    questionInput.focus();
  } catch {
    busy.remove();
    dropzoneText.textContent = "[ drop a pdf here — or click to upload ]";
    logLine("log-err", "! connection lost — uplink may have gone down");
    checkUplink();
  } finally {
    dropzone.classList.remove("busy");
  }
}

async function ask(question) {
  setAskEnabled(false);
  logLine("log-q", `> ${question}`);
  const busy = logLine("log-busy", "# querying claude …");

  try {
    const response = await fetch(`${API_BASE}/rag/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, top_k: 4 }),
    });
    busy.remove();
    if (!response.ok) {
      logLine("log-err", `! ${await apiErrorMessage(response)}`);
      return;
    }
    const data = await response.json();
    logSources(data.sources);
    logLine("log-a", data.answer);
  } catch {
    busy.remove();
    logLine("log-err", "! connection lost — uplink may have gone down");
    checkUplink();
  } finally {
    setAskEnabled(true);
  }
}

if (badge) {
  retryBtn.addEventListener("click", checkUplink);

  fileInput.addEventListener("change", () => {
    ingest(fileInput.files[0]);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((event) =>
    dropzone.addEventListener(event, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((event) =>
    dropzone.addEventListener(event, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    ingest(e.dataTransfer.files[0]);
  });

  askForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();
    if (!question || !documentIndexed) return;
    questionInput.value = "";
    ask(question);
  });

  checkUplink();
}
