const STORAGE_KEY = "jobhunting-candidatures";
const THEME_KEY = "jobhunting-theme";
const LAST_NOTIFIED_KEY = "jobhunting-last-notified-date";
const USER_NAME_KEY = "jobhunting-user-name";
const STATUSES = ["to-apply", "sent", "interview", "response"];
const STATUS_LABELS = {
  "to-apply": "To Apply",
  sent: "Sent",
  interview: "Interview",
  response: "Response",
};
const FOLLOW_UP_DAYS = 10;
const DEADLINE_WARNING_DAYS = 3;
const LEGACY_STATUS_MAP = {
  "a-postuler": "to-apply",
  envoye: "sent",
  entretien: "interview",
  reponse: "response",
};

const TAG_PRESETS = [
  { id: "remote", label: "Remote", cls: "tag-remote" },
  { id: "hybrid", label: "Hybrid", cls: "tag-hybrid" },
  { id: "onsite", label: "On-site", cls: "tag-onsite" },
  { id: "urgent", label: "Urgent", cls: "tag-urgent" },
  { id: "dream-job", label: "Dream Job", cls: "tag-dream" },
  { id: "contract", label: "Contract", cls: "tag-contract" },
];
const CUSTOM_TAG_CLASSES = [
  "tag-custom-0", "tag-custom-1", "tag-custom-2", "tag-custom-3",
  "tag-custom-4", "tag-custom-5", "tag-custom-6", "tag-custom-7",
];

const QUOTES = [
  "The only way to do great work is to love what you do. — Steve Jobs",
  "Success is the sum of small efforts repeated day in and day out.",
  "Opportunities don't happen, you create them. — Chris Grosser",
  "Your work is going to fill a large part of your life; keep looking until you find what you love.",
  "It always seems impossible until it's done. — Nelson Mandela",
  "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
  "Every rejection is one step closer to the right yes.",
  "The expert in anything was once a beginner.",
  "Persistence guarantees that results are inevitable.",
  "A little progress each day adds up to big results.",
  "Rejection is redirection.",
  "You don't have to be great to start, but you have to start to be great. — Zig Ziglar",
  "Believe you can and you're halfway there. — Theodore Roosevelt",
  "The comeback is always stronger than the setback.",
  "Consistency is what transforms average into excellence.",
  "Every application is practice for the one that says yes.",
  "Confidence comes from preparation.",
  "Small steps every day lead to big changes.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Doubt kills more dreams than failure ever will.",
  "You are one interview away from a completely different life.",
  "Focus on progress, not perfection.",
  "Keep going. Everything you need will come to you at the perfect time.",
  "Great things never came from comfort zones.",
];

let candidatures = loadCandidatures();
let editingId = null;
let editingTags = [];
let filters = { search: "", tag: "all", attentionOnly: false };

const cardsContainers = Object.fromEntries(
  STATUSES.map((s) => [s, document.getElementById(`cards-${s}`)])
);
const counts = Object.fromEntries(
  STATUSES.map((s) => [s, document.getElementById(`count-${s}`)])
);

const sentStat = document.getElementById("sentStat");
const followUpBanner = document.getElementById("followUpBanner");
const quoteText = document.getElementById("quoteText");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const userGreeting = document.getElementById("userGreeting");

const searchInput = document.getElementById("searchInput");
const tagFilterSelect = document.getElementById("tagFilterSelect");
const attentionCheckbox = document.getElementById("attentionCheckbox");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const importJsonBtn = document.getElementById("importJsonBtn");
const importJsonInput = document.getElementById("importJsonInput");

const statTotal = document.getElementById("statTotal");
const statSent = document.getElementById("statSent");
const statInterviewRate = document.getElementById("statInterviewRate");
const statResponseRate = document.getElementById("statResponseRate");
const statOfferRate = document.getElementById("statOfferRate");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const cardForm = document.getElementById("cardForm");
const fieldCompany = document.getElementById("fieldCompany");
const fieldRole = document.getElementById("fieldRole");
const fieldLink = document.getElementById("fieldLink");
const fieldAppliedDate = document.getElementById("fieldAppliedDate");
const fieldDeadline = document.getElementById("fieldDeadline");
const fieldSalary = document.getElementById("fieldSalary");
const fieldStatus = document.getElementById("fieldStatus");
const outcomeField = document.getElementById("outcomeField");
const fieldOutcome = document.getElementById("fieldOutcome");
const deleteBtn = document.getElementById("deleteBtn");
const notesSection = document.getElementById("notesSection");
const notesHint = document.getElementById("notesHint");
const notesList = document.getElementById("notesList");
const newNoteText = document.getElementById("newNoteText");
const addNoteBtn = document.getElementById("addNoteBtn");
const tagsChips = document.getElementById("tagsChips");
const tagPresets = document.getElementById("tagPresets");
const customTagInput = document.getElementById("customTagInput");
const addCustomTagBtn = document.getElementById("addCustomTagBtn");

const dialogOverlay = document.getElementById("dialogOverlay");
const dialogTitle = document.getElementById("dialogTitle");
const dialogMessage = document.getElementById("dialogMessage");
const dialogInput = document.getElementById("dialogInput");
const dialogCancelBtn = document.getElementById("dialogCancelBtn");
const dialogConfirmBtn = document.getElementById("dialogConfirmBtn");
const toast = document.getElementById("toast");

/* ---------- dialog & toast ---------- */

let dialogResolve = null;

function openDialog({ title = "", message = "", withInput = false, inputValue = "", confirmLabel = "OK", showCancel = true }) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogMessage.classList.toggle("hidden", !message);
    dialogInput.classList.toggle("hidden", !withInput);
    dialogInput.value = inputValue;
    dialogConfirmBtn.textContent = confirmLabel;
    dialogCancelBtn.classList.toggle("hidden", !showCancel);
    dialogOverlay.classList.remove("hidden");
    if (withInput) {
      dialogInput.focus();
      dialogInput.select();
    } else {
      dialogConfirmBtn.focus();
    }
  });
}

function closeDialog(result) {
  dialogOverlay.classList.add("hidden");
  if (dialogResolve) {
    dialogResolve(result);
    dialogResolve = null;
  }
}

dialogCancelBtn.addEventListener("click", () => closeDialog(null));
dialogConfirmBtn.addEventListener("click", () => closeDialog(dialogInput.classList.contains("hidden") ? true : dialogInput.value));
dialogInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); closeDialog(dialogInput.value); }
});
dialogOverlay.addEventListener("click", (e) => { if (e.target === dialogOverlay) closeDialog(null); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !dialogOverlay.classList.contains("hidden")) closeDialog(null);
});

let toastTimer = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
}

/* ---------- data ---------- */

function loadCandidatures() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map(migrateCandidature);
  } catch {
    return [];
  }
}

function normalizeStatus(status) {
  if (STATUSES.includes(status)) return status;
  if (LEGACY_STATUS_MAP[status]) return LEGACY_STATUS_MAP[status];
  return "to-apply";
}

function migrateCandidature(c) {
  const status = normalizeStatus(c.status);
  let notes = c.notes;
  if (typeof notes === "string") {
    notes = notes ? [{ id: crypto.randomUUID(), text: notes, date: c.createdAt || Date.now(), status }] : [];
  } else if (!Array.isArray(notes)) {
    notes = [];
  } else {
    notes = notes.map((n) => ({ ...n, status: normalizeStatus(n.status) }));
  }
  return {
    id: c.id || crypto.randomUUID(),
    company: c.company || "",
    role: c.role || "",
    link: c.link || "",
    appliedDate: c.appliedDate || "",
    deadline: c.deadline || "",
    salary: c.salary || "",
    tags: Array.isArray(c.tags) ? c.tags : [],
    status,
    outcome: c.outcome || "pending",
    notes,
    createdAt: c.createdAt || Date.now(),
  };
}

function saveCandidatures() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(candidatures));
}

/* ---------- dates & reminders ---------- */

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const applied = new Date(dateStr + "T00:00:00");
  return Math.floor((startOfToday() - applied) / 86400000);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  return Math.floor((target - startOfToday()) / 86400000);
}

function needsFollowUp(item) {
  if (item.status !== "sent" && item.status !== "interview") return false;
  const days = daysSince(item.appliedDate);
  return days !== null && days >= FOLLOW_UP_DAYS;
}

function needsDeadlineAttention(item) {
  if (item.status !== "to-apply" || !item.deadline) return false;
  const days = daysUntil(item.deadline);
  return days !== null && days <= DEADLINE_WARNING_DAYS;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatNoteDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function normalizeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/* ---------- tags ---------- */

function resolveTag(tagId) {
  const preset = TAG_PRESETS.find((t) => t.id === tagId);
  if (preset) return { id: preset.id, label: preset.label, cls: preset.cls };
  let hash = 0;
  for (const ch of tagId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const cls = CUSTOM_TAG_CLASSES[hash % CUSTOM_TAG_CLASSES.length];
  return { id: tagId, label: tagId, cls };
}

function allKnownTags() {
  const set = new Set(TAG_PRESETS.map((t) => t.id));
  candidatures.forEach((c) => c.tags.forEach((t) => set.add(t)));
  return [...set];
}

function renderTagFilterOptions() {
  const current = tagFilterSelect.value || "all";
  tagFilterSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All tags";
  tagFilterSelect.appendChild(allOpt);
  allKnownTags().forEach((tagId) => {
    const opt = document.createElement("option");
    opt.value = tagId;
    opt.textContent = resolveTag(tagId).label;
    tagFilterSelect.appendChild(opt);
  });
  tagFilterSelect.value = [...tagFilterSelect.options].some((o) => o.value === current) ? current : "all";
}

function renderTagEditorUI() {
  tagsChips.innerHTML = "";
  editingTags.forEach((tagId) => {
    const tag = resolveTag(tagId);
    const chip = document.createElement("span");
    chip.className = `tag-badge tag-chip ${tag.cls}`;
    chip.textContent = tag.label;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      editingTags = editingTags.filter((t) => t !== tagId);
      renderTagEditorUI();
    });
    chip.appendChild(removeBtn);
    tagsChips.appendChild(chip);
  });

  tagPresets.innerHTML = "";
  TAG_PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-preset-btn";
    btn.textContent = (editingTags.includes(preset.id) ? "✓ " : "+ ") + preset.label;
    btn.classList.toggle("active", editingTags.includes(preset.id));
    btn.addEventListener("click", () => {
      if (editingTags.includes(preset.id)) {
        editingTags = editingTags.filter((t) => t !== preset.id);
      } else {
        editingTags = [...editingTags, preset.id];
      }
      renderTagEditorUI();
    });
    tagPresets.appendChild(btn);
  });
}

function addCustomTag() {
  const value = customTagInput.value.trim();
  if (!value) return;
  const exists = editingTags.some((t) => t.toLowerCase() === value.toLowerCase());
  if (!exists) editingTags = [...editingTags, value];
  customTagInput.value = "";
  renderTagEditorUI();
}

/* ---------- render ---------- */

function matchesFilters(item) {
  if (filters.tag !== "all" && !item.tags.includes(filters.tag)) return false;
  if (filters.attentionOnly && !needsFollowUp(item) && !needsDeadlineAttention(item)) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    if (!item.company.toLowerCase().includes(q) && !item.role.toLowerCase().includes(q)) return false;
  }
  return true;
}

function render() {
  const filtered = candidatures.filter(matchesFilters);

  STATUSES.forEach((status) => {
    const container = cardsContainers[status];
    container.innerHTML = "";
    const items = filtered.filter((c) => c.status === status);
    counts[status].textContent = items.length;

    if (items.length === 0) {
      const hint = document.createElement("div");
      hint.className = "empty-hint";
      hint.textContent = "No applications";
      container.appendChild(hint);
      return;
    }

    items.forEach((item) => {
      container.appendChild(buildCard(item));
    });
  });

  const sentCount = candidatures.filter((c) => !!c.appliedDate).length;
  sentStat.textContent = `${sentCount} application${sentCount === 1 ? "" : "s"} sent`;

  renderTagFilterOptions();
  updateStats();
  updateFollowUpBanner();
}

function updateStats() {
  const total = candidatures.length;
  const sent = candidatures.filter((c) => !!c.appliedDate).length;
  const reachedInterview = candidatures.filter((c) => c.status === "interview" || c.status === "response").length;
  const reachedResponse = candidatures.filter((c) => c.status === "response").length;
  const accepted = candidatures.filter((c) => c.status === "response" && c.outcome === "accepted").length;

  statTotal.textContent = total;
  statSent.textContent = sent;
  statInterviewRate.textContent = sent ? `${Math.round((reachedInterview / sent) * 100)}%` : "0%";
  statResponseRate.textContent = sent ? `${Math.round((reachedResponse / sent) * 100)}%` : "0%";
  statOfferRate.textContent = reachedResponse ? `${Math.round((accepted / reachedResponse) * 100)}%` : "0%";
}

function updateFollowUpBanner() {
  const overdue = candidatures.filter(needsFollowUp);
  const deadlines = candidatures.filter(needsDeadlineAttention);

  if (overdue.length === 0 && deadlines.length === 0) {
    followUpBanner.classList.add("hidden");
    followUpBanner.innerHTML = "";
  } else {
    followUpBanner.classList.remove("hidden");
    const lines = [];
    if (overdue.length > 0) {
      lines.push(`⏰ ${overdue.length} application${overdue.length === 1 ? "" : "s"} due for a follow-up: ${overdue.map((c) => c.company).join(", ")}`);
    }
    if (deadlines.length > 0) {
      lines.push(`📅 ${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} coming up: ${deadlines.map((c) => c.company).join(", ")}`);
    }
    followUpBanner.innerHTML = lines.join("<br>");
  }
  maybeNotify(overdue, deadlines);
}

function maybeNotify(overdueItems, deadlineItems) {
  const total = overdueItems.length + deadlineItems.length;
  if (total === 0) return;
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    Notification.requestPermission().then(() => maybeNotify(overdueItems, deadlineItems));
    return;
  }
  if (Notification.permission !== "granted") return;

  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(LAST_NOTIFIED_KEY) === today) return;
  localStorage.setItem(LAST_NOTIFIED_KEY, today);

  const parts = [];
  if (overdueItems.length > 0) {
    parts.push(`Follow-up needed: ${overdueItems.map((c) => c.company).join(", ")}`);
  }
  if (deadlineItems.length > 0) {
    parts.push(`Deadline soon: ${deadlineItems.map((c) => c.company).join(", ")}`);
  }
  new Notification("JobHunt Xpert", { body: parts.join(" · ") });
}

function updateQuote() {
  if (!quoteText) return;
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  quoteText.textContent = `“${QUOTES[dayIndex % QUOTES.length]}”`;
}

function buildCard(item) {
  const card = document.createElement("div");
  card.className = "card";
  card.draggable = true;
  card.dataset.id = item.id;

  if (item.status === "response") {
    card.classList.add(`outcome-${item.outcome}`);
  }

  const company = document.createElement("div");
  company.className = "company";
  company.textContent = item.company;
  card.appendChild(company);

  const role = document.createElement("div");
  role.className = "role";
  role.textContent = item.role;
  card.appendChild(role);

  const metaRow = document.createElement("div");
  metaRow.className = "meta-row";

  if (item.appliedDate) {
    const applied = document.createElement("span");
    applied.className = "applied-date";
    applied.textContent = `Applied ${formatDate(item.appliedDate)}`;
    metaRow.appendChild(applied);
  }

  if (item.salary) {
    const salary = document.createElement("span");
    salary.className = "salary-chip";
    salary.textContent = `💰 ${item.salary}`;
    metaRow.appendChild(salary);
  }

  if (item.status === "response") {
    const badge = document.createElement("span");
    badge.className = `outcome-badge ${item.outcome}`;
    badge.textContent = item.outcome === "accepted" ? "Accepted" : item.outcome === "rejected" ? "Rejected" : "Pending";
    metaRow.appendChild(badge);
  }

  if (needsFollowUp(item)) {
    const reminder = document.createElement("span");
    reminder.className = "reminder-badge";
    reminder.textContent = `Follow up · ${daysSince(item.appliedDate)}d`;
    metaRow.appendChild(reminder);
  }

  if (item.status === "to-apply" && item.deadline) {
    const days = daysUntil(item.deadline);
    const badge = document.createElement("span");
    badge.className = "deadline-badge";
    if (days < 0) {
      badge.textContent = "Deadline passed";
      badge.classList.add("deadline-passed");
    } else if (days === 0) {
      badge.textContent = "Deadline today";
      badge.classList.add("deadline-passed");
    } else {
      badge.textContent = `Deadline in ${days}d`;
    }
    metaRow.appendChild(badge);
  }

  if (item.notes.length > 0) {
    const notesCount = document.createElement("span");
    notesCount.className = "notes-count";
    notesCount.textContent = `📝 ${item.notes.length}`;
    metaRow.appendChild(notesCount);
  }

  if (metaRow.children.length > 0) card.appendChild(metaRow);

  if (item.tags.length > 0) {
    const tagsRow = document.createElement("div");
    tagsRow.className = "tags-row";
    item.tags.forEach((tagId) => {
      const tag = resolveTag(tagId);
      const badge = document.createElement("span");
      badge.className = `tag-badge ${tag.cls}`;
      badge.textContent = tag.label;
      tagsRow.appendChild(badge);
    });
    card.appendChild(tagsRow);
  }

  if (item.link) {
    const link = document.createElement("a");
    link.className = "link";
    link.href = normalizeUrl(item.link);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View posting ↗";
    link.addEventListener("click", (e) => e.stopPropagation());
    card.appendChild(link);
  }

  card.addEventListener("click", () => openModal(item));

  card.addEventListener("dragstart", () => {
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });

  return card;
}

function renderNotesList(item) {
  notesList.innerHTML = "";
  if (!item || item.notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "notes-empty";
    empty.textContent = "No notes yet.";
    notesList.appendChild(empty);
    return;
  }
  [...item.notes].reverse().forEach((note) => {
    const el = document.createElement("div");
    el.className = "note-item";

    const meta = document.createElement("div");
    meta.className = "note-meta";

    const stage = document.createElement("span");
    stage.className = "note-stage";
    stage.textContent = STATUS_LABELS[note.status] || note.status;
    meta.appendChild(stage);

    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = formatNoteDate(note.date);
    meta.appendChild(date);

    el.appendChild(meta);

    const text = document.createElement("div");
    text.className = "note-text";
    text.textContent = note.text;
    el.appendChild(text);

    notesList.appendChild(el);
  });
}

/* ---------- modal ---------- */

function updateOutcomeVisibility() {
  outcomeField.classList.toggle("hidden", fieldStatus.value !== "response");
}

function openModal(item) {
  editingId = item ? item.id : null;
  editingTags = item ? [...item.tags] : [];
  modalTitle.textContent = item ? "Edit Application" : "New Application";
  fieldCompany.value = item ? item.company : "";
  fieldRole.value = item ? item.role : "";
  fieldLink.value = item ? item.link || "" : "";
  fieldAppliedDate.value = item ? item.appliedDate || "" : "";
  fieldDeadline.value = item ? item.deadline || "" : "";
  fieldSalary.value = item ? item.salary || "" : "";
  fieldStatus.value = item ? item.status : "to-apply";
  fieldOutcome.value = item ? item.outcome || "pending" : "pending";
  updateOutcomeVisibility();
  deleteBtn.classList.toggle("hidden", !item);

  renderTagEditorUI();

  notesSection.classList.toggle("hidden", !item);
  notesHint.classList.toggle("hidden", !!item);
  newNoteText.value = "";
  if (item) renderNotesList(item);

  modalOverlay.classList.remove("hidden");
  fieldCompany.focus();
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  cardForm.reset();
  editingId = null;
  editingTags = [];
}

document.getElementById("addBtn").addEventListener("click", () => openModal(null));
document.getElementById("cancelBtn").addEventListener("click", closeModal);
fieldStatus.addEventListener("change", updateOutcomeVisibility);
addCustomTagBtn.addEventListener("click", addCustomTag);
customTagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addCustomTag();
  }
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) closeModal();
});

cardForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    company: fieldCompany.value.trim(),
    role: fieldRole.value.trim(),
    link: fieldLink.value.trim(),
    appliedDate: fieldAppliedDate.value,
    deadline: fieldDeadline.value,
    salary: fieldSalary.value.trim(),
    tags: [...editingTags],
    status: fieldStatus.value,
    outcome: fieldStatus.value === "response" ? fieldOutcome.value : "pending",
  };
  if (!data.company || !data.role) return;

  if (editingId) {
    const idx = candidatures.findIndex((c) => c.id === editingId);
    if (idx !== -1) candidatures[idx] = { ...candidatures[idx], ...data };
  } else {
    candidatures.push({ id: crypto.randomUUID(), ...data, notes: [], createdAt: Date.now() });
  }

  saveCandidatures();
  render();
  closeModal();
});

addNoteBtn.addEventListener("click", () => {
  if (!editingId) return;
  const text = newNoteText.value.trim();
  if (!text) return;
  const idx = candidatures.findIndex((c) => c.id === editingId);
  if (idx === -1) return;
  candidatures[idx].notes.push({
    id: crypto.randomUUID(),
    text,
    date: Date.now(),
    status: fieldStatus.value,
  });
  saveCandidatures();
  newNoteText.value = "";
  renderNotesList(candidatures[idx]);
  render();
});

deleteBtn.addEventListener("click", () => {
  if (!editingId) return;
  candidatures = candidatures.filter((c) => c.id !== editingId);
  saveCandidatures();
  render();
  closeModal();
});

STATUSES.forEach((status) => {
  const container = cardsContainers[status];

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    container.classList.add("drag-over");
  });

  container.addEventListener("dragleave", () => {
    container.classList.remove("drag-over");
  });

  container.addEventListener("drop", (e) => {
    e.preventDefault();
    container.classList.remove("drag-over");
    const dragging = document.querySelector(".card.dragging");
    if (!dragging) return;
    const id = dragging.dataset.id;
    const item = candidatures.find((c) => c.id === id);
    if (item) {
      item.status = status;
      if (status === "response" && !item.outcome) item.outcome = "pending";
      saveCandidatures();
      render();
    }
  });
});

/* ---------- toolbar: search / filter ---------- */

searchInput.addEventListener("input", () => {
  filters.search = searchInput.value;
  render();
});
tagFilterSelect.addEventListener("change", () => {
  filters.tag = tagFilterSelect.value;
  render();
});
attentionCheckbox.addEventListener("change", () => {
  filters.attentionOnly = attentionCheckbox.checked;
  render();
});

/* ---------- export / import ---------- */

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

exportJsonBtn.addEventListener("click", () => {
  downloadBlob(JSON.stringify(candidatures, null, 2), "job-applications-backup.json", "application/json");
});

exportCsvBtn.addEventListener("click", () => {
  const header = ["Company", "Role", "Status", "Outcome", "Applied On", "Deadline", "Salary", "Tags", "Link", "Notes"];
  const rows = candidatures.map((c) => [
    c.company,
    c.role,
    STATUS_LABELS[c.status] || c.status,
    c.status === "response" ? c.outcome : "",
    c.appliedDate,
    c.deadline,
    c.salary,
    c.tags.map((t) => resolveTag(t).label).join("; "),
    c.link,
    c.notes.map((n) => `[${STATUS_LABELS[n.status] || n.status}] ${n.text}`).join(" | "),
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(csv, "job-applications.csv", "text/csv");
});

importJsonBtn.addEventListener("click", () => importJsonInput.click());

importJsonInput.addEventListener("change", () => {
  const file = importJsonInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      const imported = parsed.map((c) => migrateCandidature({ ...c, id: undefined }));
      const ok = await openDialog({
        title: "Import applications?",
        message: `Import ${imported.length} application${imported.length === 1 ? "" : "s"}? They will be added to your current list.`,
        confirmLabel: "Import",
      });
      if (ok) {
        candidatures = [...candidatures, ...imported];
        saveCandidatures();
        render();
        showToast(`Imported ${imported.length} application${imported.length === 1 ? "" : "s"}.`);
      }
    } catch {
      showToast("This file doesn't look like a valid JobHunt Xpert JSON backup.");
    } finally {
      importJsonInput.value = "";
    }
  };
  reader.readAsText(file);
});

/* ---------- dark mode ---------- */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const preferred = stored || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferred);
}

themeToggleBtn.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

/* ---------- user name ---------- */

function renderUserGreeting() {
  const name = localStorage.getItem(USER_NAME_KEY) || "";
  userGreeting.textContent = name ? `👋 ${name}` : "+ Add your name";
  userGreeting.classList.toggle("is-set", !!name);
}

userGreeting.addEventListener("click", async () => {
  const current = localStorage.getItem(USER_NAME_KEY) || "";
  const next = await openDialog({ title: "Your name", message: "Shown here and prefilled on the Community Wall.", withInput: true, inputValue: current, confirmLabel: "Save" });
  if (next === null) return;
  const trimmed = next.trim();
  if (trimmed) localStorage.setItem(USER_NAME_KEY, trimmed); else localStorage.removeItem(USER_NAME_KEY);
  renderUserGreeting();
});

/* ---------- init ---------- */

initTheme();
renderUserGreeting();
updateQuote();
setInterval(updateQuote, 60 * 1000);

render();
