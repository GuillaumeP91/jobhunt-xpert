import { auth, db, googleProvider } from "./firebase-init.js";
import {
  signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

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

let candidatures = [];
let currentUid = null;
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

const signInBtn = document.getElementById("signInBtn");
const userMenu = document.getElementById("userMenu");
const userAvatar = document.getElementById("userAvatar");
const userDisplayName = document.getElementById("userDisplayName");
const signOutBtn = document.getElementById("signOutBtn");
const heroSection = document.getElementById("heroSection");
const gateUnpaid = document.getElementById("gateUnpaid");
const trackerRoot = document.getElementById("trackerRoot");
const heroCtaBtn = document.getElementById("heroCtaBtn");
const unlockBtn = document.getElementById("unlockBtn");
const addBtn = document.getElementById("addBtn");

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

const insightsSection = document.getElementById("insightsSection");
const insightSource = document.getElementById("insightSource");
const insightSourceRows = document.getElementById("insightSourceRows");
const insightCv = document.getElementById("insightCv");
const insightCvRows = document.getElementById("insightCvRows");
const insightMatch = document.getElementById("insightMatch");
const insightMatchText = document.getElementById("insightMatchText");
const insightTailored = document.getElementById("insightTailored");
const insightTailoredRows = document.getElementById("insightTailoredRows");

const toolbarEl = document.getElementById("toolbarEl");
const statsBarEl = document.getElementById("statsBar");
const onboardingSection = document.getElementById("onboardingSection");
const onboardTargetRole = document.getElementById("onboardTargetRole");
const onboardWeeklyGoal = document.getElementById("onboardWeeklyGoal");
const onboardSearchingToggle = document.getElementById("onboardSearchingToggle");
const onboardImportBtn = document.getElementById("onboardImportBtn");
const onboardFreshBtn = document.getElementById("onboardFreshBtn");
const recommendationsBanner = document.getElementById("recommendationsBanner");
const recommendationsText = document.getElementById("recommendationsText");
const dismissRecommendations = document.getElementById("dismissRecommendations");
const boardEl = document.getElementById("board");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const cardForm = document.getElementById("cardForm");
const fieldCompany = document.getElementById("fieldCompany");
const fieldRole = document.getElementById("fieldRole");
const fieldLink = document.getElementById("fieldLink");
const fieldAppliedDate = document.getElementById("fieldAppliedDate");
const fieldDeadline = document.getElementById("fieldDeadline");
const fieldSalary = document.getElementById("fieldSalary");
const fieldContact = document.getElementById("fieldContact");
const fieldSource = document.getElementById("fieldSource");
const fieldCvVersion = document.getElementById("fieldCvVersion");
const matchScorePicker = document.getElementById("matchScorePicker");
const interestScorePicker = document.getElementById("interestScorePicker");
const fieldReferral = document.getElementById("fieldReferral");
const fieldTailoredCv = document.getElementById("fieldTailoredCv");
const fieldCoverLetter = document.getElementById("fieldCoverLetter");
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
    contactPerson: c.contactPerson || "",
    source: c.source || "",
    cvVersion: c.cvVersion || "",
    matchScore: Number(c.matchScore) || 0,
    interestScore: Number(c.interestScore) || 0,
    referral: !!c.referral,
    tailoredCv: !!c.tailoredCv,
    coverLetter: !!c.coverLetter,
    tags: Array.isArray(c.tags) ? c.tags : [],
    status,
    outcome: c.outcome || "pending",
    notes,
    createdAt: c.createdAt || Date.now(),
  };
}

function candidaturesCollection(uid) {
  return collection(db, "users", uid, "candidatures");
}

let candidaturesUnsub = null;
let localImportOffered = false;

function subscribeCandidatures(uid) {
  if (candidaturesUnsub) candidaturesUnsub();
  candidaturesUnsub = onSnapshot(
    candidaturesCollection(uid),
    (snap) => {
      candidatures = snap.docs.map((d) => migrateCandidature({ id: d.id, ...d.data() }));
      render();
      maybeOfferLocalImport(uid);
    },
    (err) => console.error("candidatures listen error", err)
  );
}

function unsubscribeCandidatures() {
  if (candidaturesUnsub) {
    candidaturesUnsub();
    candidaturesUnsub = null;
  }
}

async function upsertCandidature(uid, item) {
  await setDoc(doc(db, "users", uid, "candidatures", item.id), item);
}

async function removeCandidature(uid, id) {
  await deleteDoc(doc(db, "users", uid, "candidatures", id));
}

async function importCandidaturesBatch(uid, items) {
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      batch.set(doc(db, "users", uid, "candidatures", item.id), item);
    });
    await batch.commit();
  }
}

async function maybeOfferLocalImport(uid) {
  if (localImportOffered) return;
  localImportOffered = true;
  if (candidatures.length > 0) return;

  let localItems;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) return;
    localItems = parsed.map(migrateCandidature);
  } catch {
    return;
  }

  const ok = await openDialog({
    title: "Import your saved applications?",
    message: `We found ${localItems.length} application${localItems.length === 1 ? "" : "s"} saved on this device. Import them into your JobHunt Xpert account?`,
    confirmLabel: "Import",
  });
  if (!ok) return;

  try {
    await importCandidaturesBatch(uid, localItems);
    showToast(`Imported ${localItems.length} application${localItems.length === 1 ? "" : "s"}.`);
  } catch (err) {
    console.error(err);
    showToast("Couldn't import your saved applications. Please try again.");
  }
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
  updateInsights();
  updateOnboardingVisibility();
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

function reachedInterview(item) {
  return item.status === "interview" || item.status === "response";
}

function buildInsightRow(label, sentCount, interviewCount) {
  const row = document.createElement("div");
  row.className = "insight-row";

  const left = document.createElement("div");
  left.className = "insight-row-left";
  const labelSpan = document.createElement("span");
  labelSpan.className = "insight-row-label";
  labelSpan.textContent = label;
  const detailSpan = document.createElement("span");
  detailSpan.className = "insight-row-detail";
  detailSpan.textContent = `${sentCount} application${sentCount === 1 ? "" : "s"} → ${interviewCount} interview${interviewCount === 1 ? "" : "s"}`;
  left.appendChild(labelSpan);
  left.appendChild(detailSpan);

  const rate = document.createElement("span");
  rate.className = "insight-row-rate";
  const pct = sentCount ? (interviewCount / sentCount) * 100 : 0;
  rate.textContent = `${pct % 1 === 0 ? pct : pct.toFixed(1)}%`;

  row.appendChild(left);
  row.appendChild(rate);
  return row;
}

function groupBy(items, keyFn) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

function updateInsights() {
  const sent = candidatures.filter((c) => !!c.appliedDate);

  // Where are your interviews coming from?
  const bySource = groupBy(sent, (c) => c.source);
  insightSourceRows.innerHTML = "";
  if (bySource.size > 0) {
    [...bySource.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([source, items]) => {
        const interviews = items.filter(reachedInterview).length;
        insightSourceRows.appendChild(buildInsightRow(source, items.length, interviews));
      });
    insightSource.classList.remove("hidden");
  } else {
    insightSource.classList.add("hidden");
  }

  // Which CV performs best?
  const byCv = groupBy(sent, (c) => c.cvVersion);
  insightCvRows.innerHTML = "";
  if (byCv.size >= 2) {
    [...byCv.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([cv, items]) => {
        const interviews = items.filter(reachedInterview).length;
        insightCvRows.appendChild(buildInsightRow(cv, items.length, interviews));
      });
    insightCv.classList.remove("hidden");
  } else {
    insightCv.classList.add("hidden");
  }

  // Insights that need a meaningful sample size
  const unlocked = candidatures.length >= 50;

  if (unlocked) {
    const highMatch = sent.filter((c) => c.matchScore >= 4);
    const lowMatch = sent.filter((c) => c.matchScore > 0 && c.matchScore < 4);
    const highRate = highMatch.length ? highMatch.filter(reachedInterview).length / highMatch.length : 0;
    const lowRate = lowMatch.length ? lowMatch.filter(reachedInterview).length / lowMatch.length : 0;
    if (highMatch.length > 0 && lowMatch.length > 0 && lowRate > 0) {
      const multiplier = highRate / lowRate;
      insightMatchText.innerHTML = `Your high-match applications generate <strong>${multiplier % 1 === 0 ? multiplier : multiplier.toFixed(1)}×</strong> more interviews.`;
      insightMatch.classList.remove("hidden");
    } else {
      insightMatch.classList.add("hidden");
    }

    const tailored = sent.filter((c) => c.tailoredCv);
    const generic = sent.filter((c) => !c.tailoredCv);
    insightTailoredRows.innerHTML = "";
    if (tailored.length > 0 && generic.length > 0) {
      insightTailoredRows.appendChild(buildInsightRow("Tailored CVs", tailored.length, tailored.filter(reachedInterview).length));
      insightTailoredRows.appendChild(buildInsightRow("Generic CV", generic.length, generic.filter(reachedInterview).length));
      insightTailored.classList.remove("hidden");
    } else {
      insightTailored.classList.add("hidden");
    }
  } else {
    insightMatch.classList.add("hidden");
    insightTailored.classList.add("hidden");
  }

  const anyVisible = !insightSource.classList.contains("hidden")
    || !insightCv.classList.contains("hidden")
    || !insightMatch.classList.contains("hidden")
    || !insightTailored.classList.contains("hidden");
  insightsSection.classList.toggle("hidden", !anyVisible);
}

function updateOnboardingVisibility() {
  const empty = candidatures.length === 0;
  onboardingSection.classList.toggle("hidden", !empty);
  toolbarEl.classList.toggle("hidden", empty);
  statsBarEl.classList.toggle("hidden", empty);
  boardEl.classList.toggle("hidden", empty);
  if (!empty) recommendationsBanner.classList.add("hidden");
}

async function saveOnboardingInfo() {
  if (!currentUid) return;
  const targetRole = onboardTargetRole.value.trim();
  const weeklyGoal = parseInt(onboardWeeklyGoal.value, 10) || 0;
  const alreadySearching = onboardSearchingToggle.dataset.value || "";
  await setDoc(doc(db, "users", currentUid), {
    targetRole, weeklyGoal, alreadySearching,
  }, { merge: true });
  return { targetRole, weeklyGoal, alreadySearching };
}

function showRecommendations(targetRole, weeklyGoal) {
  const lines = [];
  if (weeklyGoal > 0) {
    lines.push(`🎯 Aim for <strong>${weeklyGoal} application${weeklyGoal === 1 ? "" : "s"}</strong> this week${targetRole ? ` as ${targetRole}` : ""}.`);
  } else if (targetRole) {
    lines.push(`🎯 Tracking your search for <strong>${targetRole}</strong> roles.`);
  }
  lines.push(`📍 Tag each application's Source so you can see where your interviews come from.`);
  lines.push(`📄 Note the CV version you used — after a few applications you'll see which one performs best.`);
  recommendationsText.innerHTML = lines.join("<br>");
  recommendationsBanner.classList.remove("hidden");
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

  if (item.contactPerson) {
    const contact = document.createElement("span");
    contact.className = "salary-chip";
    contact.textContent = `🧑 ${item.contactPerson}`;
    metaRow.appendChild(contact);
  }

  if (item.source) {
    const source = document.createElement("span");
    source.className = "salary-chip";
    source.textContent = `📍 ${item.source}`;
    metaRow.appendChild(source);
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

function setScalePicker(picker, value) {
  picker.dataset.value = String(value);
  picker.querySelectorAll(".scale-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.score) === value);
  });
}

function getScalePickerValue(picker) {
  return Number(picker.dataset.value) || 0;
}

function initScalePicker(picker) {
  picker.querySelectorAll(".scale-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const score = Number(btn.dataset.score);
      const current = getScalePickerValue(picker);
      setScalePicker(picker, current === score ? 0 : score);
    });
  });
}

initScalePicker(matchScorePicker);
initScalePicker(interestScorePicker);

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
  fieldContact.value = item ? item.contactPerson || "" : "";
  fieldSource.value = item ? item.source || "" : "";
  fieldCvVersion.value = item ? item.cvVersion || "" : "";
  setScalePicker(matchScorePicker, item ? item.matchScore || 0 : 0);
  setScalePicker(interestScorePicker, item ? item.interestScore || 0 : 0);
  fieldReferral.checked = item ? !!item.referral : false;
  fieldTailoredCv.checked = item ? !!item.tailoredCv : false;
  fieldCoverLetter.checked = item ? !!item.coverLetter : false;
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

addBtn.addEventListener("click", () => openModal(null));
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

cardForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    company: fieldCompany.value.trim(),
    role: fieldRole.value.trim(),
    link: fieldLink.value.trim(),
    appliedDate: fieldAppliedDate.value,
    deadline: fieldDeadline.value,
    salary: fieldSalary.value.trim(),
    contactPerson: fieldContact.value.trim(),
    source: fieldSource.value,
    cvVersion: fieldCvVersion.value.trim(),
    matchScore: getScalePickerValue(matchScorePicker),
    interestScore: getScalePickerValue(interestScorePicker),
    referral: fieldReferral.checked,
    tailoredCv: fieldTailoredCv.checked,
    coverLetter: fieldCoverLetter.checked,
    tags: [...editingTags],
    status: fieldStatus.value,
    outcome: fieldStatus.value === "response" ? fieldOutcome.value : "pending",
  };
  if (!data.company || !data.role) return;

  let fullItem;
  if (editingId) {
    const idx = candidatures.findIndex((c) => c.id === editingId);
    fullItem = idx !== -1 ? { ...candidatures[idx], ...data } : { id: editingId, ...data, notes: [], createdAt: Date.now() };
    if (idx !== -1) candidatures[idx] = fullItem; else candidatures.push(fullItem);
  } else {
    fullItem = { id: crypto.randomUUID(), ...data, notes: [], createdAt: Date.now() };
    candidatures.push(fullItem);
  }

  render();
  closeModal();

  try {
    await upsertCandidature(currentUid, fullItem);
  } catch (err) {
    console.error(err);
    showToast("Couldn't save your changes. Please try again.");
  }
});

addNoteBtn.addEventListener("click", async () => {
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
  newNoteText.value = "";
  renderNotesList(candidatures[idx]);
  render();

  try {
    await upsertCandidature(currentUid, candidatures[idx]);
  } catch (err) {
    console.error(err);
    showToast("Couldn't save your note. Please try again.");
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!editingId) return;
  const idToDelete = editingId;
  candidatures = candidatures.filter((c) => c.id !== idToDelete);
  render();
  closeModal();

  try {
    await removeCandidature(currentUid, idToDelete);
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete. Please try again.");
  }
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

  container.addEventListener("drop", async (e) => {
    e.preventDefault();
    container.classList.remove("drag-over");
    const dragging = document.querySelector(".card.dragging");
    if (!dragging) return;
    const id = dragging.dataset.id;
    const item = candidatures.find((c) => c.id === id);
    if (item) {
      item.status = status;
      if (status === "response" && !item.outcome) item.outcome = "pending";
      render();
      try {
        await upsertCandidature(currentUid, item);
      } catch (err) {
        console.error(err);
        showToast("Couldn't save your changes. Please try again.");
      }
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
  const header = ["Company", "Role", "Status", "Outcome", "Applied On", "Deadline", "Salary", "Contact", "Source", "CV Version", "Match Score", "Interest Score", "Referral", "Tailored CV", "Cover Letter", "Tags", "Link", "Notes"];
  const rows = candidatures.map((c) => [
    c.company,
    c.role,
    STATUS_LABELS[c.status] || c.status,
    c.status === "response" ? c.outcome : "",
    c.appliedDate,
    c.deadline,
    c.salary,
    c.contactPerson,
    c.source,
    c.cvVersion,
    c.matchScore || "",
    c.interestScore || "",
    c.referral ? "Yes" : "No",
    c.tailoredCv ? "Yes" : "No",
    c.coverLetter ? "Yes" : "No",
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
        render();
        try {
          await importCandidaturesBatch(currentUid, imported);
          showToast(`Imported ${imported.length} application${imported.length === 1 ? "" : "s"}.`);
        } catch (err) {
          console.error(err);
          showToast("Couldn't save the imported applications. Please try again.");
        }
      }
    } catch {
      showToast("This file doesn't look like a valid JobHunt Xpert JSON backup.");
    } finally {
      importJsonInput.value = "";
    }
  };
  reader.readAsText(file);
});

/* ---------- onboarding ---------- */

onboardSearchingToggle.querySelectorAll(".scale-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    onboardSearchingToggle.dataset.value = btn.dataset.value;
    onboardSearchingToggle.querySelectorAll(".scale-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
  });
});

onboardFreshBtn.addEventListener("click", async () => {
  const info = await saveOnboardingInfo();
  onboardingSection.classList.add("hidden");
  if (info) showRecommendations(info.targetRole, info.weeklyGoal);
  openModal(null);
});

onboardImportBtn.addEventListener("click", async () => {
  await saveOnboardingInfo();
  importJsonInput.click();
});

dismissRecommendations.addEventListener("click", () => {
  recommendationsBanner.classList.add("hidden");
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
  // community.js owns its own reference to this field (separate module scope) — update the
  // shared DOM element directly so the Community Wall name stays in sync with the header.
  const communityNameInput = document.getElementById("communityName");
  if (communityNameInput) communityNameInput.value = trimmed;
});

/* ---------- auth ---------- */

async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error(err);
    if (err && err.code !== "auth/popup-closed-by-user") {
      showToast("Couldn't sign in. Please try again.");
    }
  }
}

async function bootstrapUserProfile(user) {
  const profileRef = doc(db, "users", user.uid);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) {
    await setDoc(profileRef, {
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      paid: false,
      createdAt: Date.now(),
      paidAt: null,
    });
  }
}

let profileUnsub = null;

function showGateState(state) {
  // state: "signed-out" | "unpaid" | "paid"
  heroSection.classList.toggle("hidden", state !== "signed-out");
  gateUnpaid.classList.toggle("hidden", state !== "unpaid");
  trackerRoot.classList.toggle("hidden", state !== "paid");
  sentStat.classList.toggle("hidden", state !== "paid");
  addBtn.classList.toggle("hidden", state !== "paid");
}

function handleAuthChange(user) {
  if (profileUnsub) {
    profileUnsub();
    profileUnsub = null;
  }
  unsubscribeCandidatures();
  candidatures = [];
  localImportOffered = false;

  if (user) {
    currentUid = user.uid;
    bootstrapUserProfile(user).catch((err) => console.error("bootstrapUserProfile failed", err));
    signInBtn.classList.add("hidden");
    userMenu.classList.remove("hidden");
    userAvatar.src = user.photoURL || "";
    userDisplayName.textContent = user.displayName || user.email || "Signed in";

    profileUnsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const paid = snap.exists() && snap.data().paid === true;
        showGateState(paid ? "paid" : "unpaid");
        if (paid) {
          subscribeCandidatures(user.uid);
        } else {
          unsubscribeCandidatures();
          candidatures = [];
          render();
        }
      },
      (err) => console.error("profile listen error", err)
    );
  } else {
    currentUid = null;
    signInBtn.classList.remove("hidden");
    userMenu.classList.add("hidden");
    userAvatar.src = "";
    userDisplayName.textContent = "";
    showGateState("signed-out");
  }
}

function requestUnlock() {
  if (!auth.currentUser) {
    signInWithGoogle();
    return;
  }
  showToast("Payments are coming soon — check back shortly!");
}

signInBtn.addEventListener("click", signInWithGoogle);
signOutBtn.addEventListener("click", () => signOut(auth).catch((err) => console.error(err)));
heroCtaBtn.addEventListener("click", requestUnlock);
unlockBtn.addEventListener("click", requestUnlock);
onAuthStateChanged(auth, handleAuthChange);

/* ---------- init ---------- */

initTheme();
renderUserGreeting();
updateQuote();
setInterval(updateQuote, 60 * 1000);

render();

// community.js runs as a separate module scope and calls these via `window`.
window.renderUserGreeting = renderUserGreeting;
window.showToast = showToast;
