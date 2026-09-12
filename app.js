import { auth, db, functions, googleProvider } from "./firebase-init.js";
import {
  signInWithPopup, signOut, onAuthStateChanged, deleteUser,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-functions.js";

const isDemoMode = new URLSearchParams(location.search).get("demo") === "1";

const STORAGE_KEY = "jobhunting-candidatures";
const THEME_KEY = "jobhunting-theme";
const LAST_NOTIFIED_KEY = "jobhunting-last-notified-date";
const USER_NAME_KEY = "jobhunting-user-name";
const STATUSES = ["to-apply", "applied", "interview", "offer"];
const STATUS_LABELS = {
  "to-apply": "To Apply",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
};
const CLOSED_REASON_LABELS = {
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
};
const FOLLOW_UP_DAYS = 10;
const DEADLINE_WARNING_DAYS = 3;
const INACTIVE_DAYS = 14;
// Raw status aliases: old internal keys (English "sent"/"response" used before the
// pipeline rename, and the original French keys) that need resolving before a
// candidature's real status/closed state can be derived. "response" isn't a 1:1
// rename — see migrateCandidature() for how it maps to status+closed+closedReason.
const RAW_STATUS_ALIASES = {
  "a-postuler": "to-apply",
  envoye: "sent",
  entretien: "interview",
  reponse: "response",
  sent: "sent",
  response: "response",
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
let viewingId = null;
let editingTags = [];
let filters = { search: "", tag: "all", attentionOnly: false, showClosed: false };

const BOARD_COLUMNS = [...STATUSES, "closed"];
const cardsContainers = Object.fromEntries(
  BOARD_COLUMNS.map((s) => [s, document.getElementById(`cards-${s}`)])
);
const counts = Object.fromEntries(
  BOARD_COLUMNS.map((s) => [s, document.getElementById(`count-${s}`)])
);
const closedColumn = document.getElementById("closedColumn");
const showClosedCheckbox = document.getElementById("showClosedCheckbox");

const sentStat = document.getElementById("sentStat");
const followUpBanner = document.getElementById("followUpBanner");
const quoteText = document.getElementById("quoteText");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const userGreeting = document.getElementById("userGreeting");

const demoModeLabel = document.getElementById("demoModeLabel");
const demoBanner = document.getElementById("demoBanner");
const demoBannerCta = document.getElementById("demoBannerCta");
const signInBtn = document.getElementById("signInBtn");
const userMenu = document.getElementById("userMenu");
const userAvatar = document.getElementById("userAvatar");
const userDisplayName = document.getElementById("userDisplayName");
const signOutBtn = document.getElementById("signOutBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
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
const insightSourceText = document.getElementById("insightSourceText");
const insightCv = document.getElementById("insightCv");
const insightCvRows = document.getElementById("insightCvRows");
const insightCvText = document.getElementById("insightCvText");
const insightTailored = document.getElementById("insightTailored");
const insightTailoredRows = document.getElementById("insightTailoredRows");
const insightTailoredText = document.getElementById("insightTailoredText");
const insightReferral = document.getElementById("insightReferral");
const insightReferralRows = document.getElementById("insightReferralRows");
const insightReferralText = document.getElementById("insightReferralText");

const toolbarEl = document.getElementById("toolbarEl");
const statsBarEl = document.getElementById("statsBar");
const onboardingSection = document.getElementById("onboardingSection");
const onboardTargetRole = document.getElementById("onboardTargetRole");
const onboardLocation = document.getElementById("onboardLocation");
const onboardWeeklyGoal = document.getElementById("onboardWeeklyGoal");
const onboardStartDate = document.getElementById("onboardStartDate");
const onboardSearchingToggle = document.getElementById("onboardSearchingToggle");
const onboardImportBtn = document.getElementById("onboardImportBtn");
const onboardFreshBtn = document.getElementById("onboardFreshBtn");
const recommendationsBanner = document.getElementById("recommendationsBanner");
const recommendationsText = document.getElementById("recommendationsText");
const nextActionsSection = document.getElementById("nextActionsSection");
const actionFollowUps = document.getElementById("actionFollowUps");
const actionFollowUpsCount = document.getElementById("actionFollowUpsCount");
const actionFollowUpsLabel = document.getElementById("actionFollowUpsLabel");
const actionInterviewsCount = document.getElementById("actionInterviewsCount");
const actionInterviewsLabel = document.getElementById("actionInterviewsLabel");
const actionInactiveCount = document.getElementById("actionInactiveCount");
const actionInactiveLabel = document.getElementById("actionInactiveLabel");
const dismissRecommendations = document.getElementById("dismissRecommendations");
const boardEl = document.getElementById("board");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const cardForm = document.getElementById("cardForm");
const fieldCompany = document.getElementById("fieldCompany");
const fieldRole = document.getElementById("fieldRole");
const fieldLink = document.getElementById("fieldLink");
const fieldJobDescription = document.getElementById("fieldJobDescription");
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
const fieldHadInterview = document.getElementById("fieldHadInterview");
const fieldClosed = document.getElementById("fieldClosed");
const closedReasonField = document.getElementById("closedReasonField");
const fieldClosedReason = document.getElementById("fieldClosedReason");
const fieldFollowUpDate = document.getElementById("fieldFollowUpDate");
const fieldFollowUpType = document.getElementById("fieldFollowUpType");
const fieldFollowUpDone = document.getElementById("fieldFollowUpDone");
const templateSelect = document.getElementById("templateSelect");
const templatePreview = document.getElementById("templatePreview");
const copyTemplateBtn = document.getElementById("copyTemplateBtn");
const deleteBtn = document.getElementById("deleteBtn");
const followUpListPanel = document.getElementById("followUpListPanel");
const followUpListItems = document.getElementById("followUpListItems");
const followUpActionOverlay = document.getElementById("followUpActionOverlay");
const followUpActionTitle = document.getElementById("followUpActionTitle");
const followUpActionContact = document.getElementById("followUpActionContact");
const faTemplateSelect = document.getElementById("faTemplateSelect");
const faTemplatePreview = document.getElementById("faTemplatePreview");
const faCopyTemplateBtn = document.getElementById("faCopyTemplateBtn");
const faSnooze3Btn = document.getElementById("faSnooze3Btn");
const faSnooze7Btn = document.getElementById("faSnooze7Btn");
const faCloseBtn = document.getElementById("faCloseBtn");
const faMarkDoneBtn = document.getElementById("faMarkDoneBtn");
const interviewsList = document.getElementById("interviewsList");
const addInterviewBtn = document.getElementById("addInterviewBtn");
const notesList = document.getElementById("notesList");
const newNoteText = document.getElementById("newNoteText");
const addNoteBtn = document.getElementById("addNoteBtn");
const tagsChips = document.getElementById("tagsChips");
const tagPresets = document.getElementById("tagPresets");
const customTagInput = document.getElementById("customTagInput");
const addCustomTagBtn = document.getElementById("addCustomTagBtn");

const detailModalOverlay = document.getElementById("detailModalOverlay");
const detailCompany = document.getElementById("detailCompany");
const detailRole = document.getElementById("detailRole");
const detailTimeline = document.getElementById("detailTimeline");
const detailContact = document.getElementById("detailContact");
const detailJobDescription = document.getElementById("detailJobDescription");
const detailCvVersion = document.getElementById("detailCvVersion");
const detailCloseBtn = document.getElementById("detailCloseBtn");
const detailEditBtn = document.getElementById("detailEditBtn");

const interviewModalOverlay = document.getElementById("interviewModalOverlay");
const interviewModalTitle = document.getElementById("interviewModalTitle");
const interviewForm = document.getElementById("interviewForm");
const ivDate = document.getElementById("ivDate");
const ivTime = document.getElementById("ivTime");
const ivType = document.getElementById("ivType");
const ivPeople = document.getElementById("ivPeople");
const ivNotes = document.getElementById("ivNotes");
const ivQuestionsAsked = document.getElementById("ivQuestionsAsked");
const ivQuestionsToAsk = document.getElementById("ivQuestionsToAsk");
const ivImpression = document.getElementById("ivImpression");
const ivNextStep = document.getElementById("ivNextStep");
const ivDeleteBtn = document.getElementById("ivDeleteBtn");
const ivCancelBtn = document.getElementById("ivCancelBtn");

const dialogOverlay = document.getElementById("dialogOverlay");
const dialogTitle = document.getElementById("dialogTitle");
const dialogMessage = document.getElementById("dialogMessage");
const dialogInput = document.getElementById("dialogInput");
const dialogSelect = document.getElementById("dialogSelect");
const dialogCancelBtn = document.getElementById("dialogCancelBtn");
const dialogConfirmBtn = document.getElementById("dialogConfirmBtn");
const toast = document.getElementById("toast");

/* ---------- dialog & toast ---------- */

let dialogResolve = null;

function openDialog({ title = "", message = "", withInput = false, inputValue = "", withSelect = false, selectOptions = [], confirmLabel = "OK", showCancel = true }) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogMessage.classList.toggle("hidden", !message);
    dialogInput.classList.toggle("hidden", !withInput);
    dialogInput.value = inputValue;
    dialogSelect.classList.toggle("hidden", !withSelect);
    if (withSelect) {
      dialogSelect.innerHTML = "";
      selectOptions.forEach((opt) => {
        const el = document.createElement("option");
        el.value = opt.value;
        el.textContent = opt.label;
        dialogSelect.appendChild(el);
      });
    }
    dialogConfirmBtn.textContent = confirmLabel;
    dialogCancelBtn.classList.toggle("hidden", !showCancel);
    dialogOverlay.classList.remove("hidden");
    if (withInput) {
      dialogInput.focus();
      dialogInput.select();
    } else if (withSelect) {
      dialogSelect.focus();
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

function confirmDialogResult() {
  if (!dialogSelect.classList.contains("hidden")) return dialogSelect.value;
  if (!dialogInput.classList.contains("hidden")) return dialogInput.value;
  return true;
}

dialogCancelBtn.addEventListener("click", () => closeDialog(null));
dialogConfirmBtn.addEventListener("click", () => closeDialog(confirmDialogResult()));
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

function resolveRawStatus(status) {
  return RAW_STATUS_ALIASES[status] || status;
}

function normalizeNoteStatus(status) {
  const raw = resolveRawStatus(status);
  if (raw === "sent") return "applied";
  // A note logged back when "Response" was a single status can't be mapped to a
  // precise stage anymore (no outcome/hadInterview context on a note) — "interview"
  // is the closest honest label, since notes were almost always added after interviewing.
  if (raw === "response") return "interview";
  if (STATUSES.includes(raw)) return raw;
  return "to-apply";
}

function migrateInterview(iv) {
  return {
    id: iv.id || crypto.randomUUID(),
    date: iv.date || "",
    time: iv.time || "",
    type: iv.type || "",
    people: iv.people || "",
    notes: iv.notes || "",
    questionsAsked: iv.questionsAsked || "",
    questionsToAsk: iv.questionsToAsk || "",
    impression: iv.impression || "",
    nextStep: iv.nextStep || "",
    createdAt: iv.createdAt || Date.now(),
  };
}

function migrateCandidature(c) {
  const raw = resolveRawStatus(c.status);

  // "sent"/"response" are pre-rename statuses (Sent -> Applied, Response -> Offer).
  // "response" isn't a straight rename: it used to conflate every terminal outcome,
  // so it's derived from the outcome/hadInterview that existed at the time.
  let status;
  let closed = !!c.closed;
  let closedReason = c.closedReason || "";
  if (raw === "response") {
    if (c.outcome === "accepted") {
      status = "offer";
      closed = c.closed ?? false;
    } else if (c.outcome === "rejected") {
      status = c.hadInterview ? "interview" : "applied";
      closed = c.closed ?? true;
      closedReason = c.closedReason || "rejected";
    } else {
      status = "interview";
      closed = c.closed ?? false;
    }
  } else if (raw === "sent") {
    status = "applied";
  } else if (STATUSES.includes(raw)) {
    status = raw;
  } else {
    status = "to-apply";
  }

  let notes = c.notes;
  if (typeof notes === "string") {
    notes = notes ? [{ id: crypto.randomUUID(), text: notes, date: c.createdAt || Date.now(), status }] : [];
  } else if (!Array.isArray(notes)) {
    notes = [];
  } else {
    notes = notes.map((n) => ({ ...n, status: normalizeNoteStatus(n.status) }));
  }

  let followUpDate = c.followUpDate || "";
  let followUpType = c.followUpType || "";
  if (!followUpDate && c.followUpDate === undefined && (status === "applied" || status === "interview") && c.appliedDate) {
    // Existing candidature saved before follow-up tracking existed: backfill the same
    // suggestion the old fixed-10-day reminder used to give, so today's banner keeps working.
    followUpDate = addDays(c.appliedDate, FOLLOW_UP_DAYS);
    followUpType = "check-in";
  }

  const createdAt = c.createdAt || Date.now();
  const statusHistory = Array.isArray(c.statusHistory) && c.statusHistory.length > 0
    ? c.statusHistory
    : [{ status, date: createdAt }];

  return {
    id: c.id || crypto.randomUUID(),
    company: c.company || "",
    role: c.role || "",
    link: c.link || "",
    jobDescription: c.jobDescription || "",
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
    statusHistory,
    hadInterview: c.hadInterview !== undefined ? !!c.hadInterview : (status === "interview" || raw === "response"),
    closed,
    closedReason,
    closedAt: c.closedAt || null,
    followUpDate,
    followUpType,
    followUpDone: !!c.followUpDone,
    followUpDoneAt: c.followUpDoneAt || null,
    interviews: Array.isArray(c.interviews) ? c.interviews.map(migrateInterview) : [],
    notes,
    createdAt,
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
  if (isDemoMode) return;
  await setDoc(doc(db, "users", uid, "candidatures", item.id), item);
}

async function removeCandidature(uid, id) {
  if (isDemoMode) return;
  await deleteDoc(doc(db, "users", uid, "candidatures", id));
}

async function importCandidaturesBatch(uid, items) {
  if (isDemoMode) return;
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

function todayStr() {
  const d = startOfToday();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr, n) {
  const base = dateStr ? new Date(dateStr + "T00:00:00") : startOfToday();
  base.setDate(base.getDate() + n);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
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
  if (item.closed || !item.followUpDate || item.followUpDone) return false;
  if (item.status !== "applied" && item.status !== "interview") return false;
  return item.followUpDate <= todayStr();
}

function isInactive(item) {
  if (item.closed) return false;
  if (item.status !== "applied" && item.status !== "interview") return false;
  const days = daysSince(item.appliedDate);
  return days !== null && days >= INACTIVE_DAYS;
}

function needsPreparation(item) {
  if (item.status !== "interview") return false;
  const interviews = item.interviews || [];
  if (interviews.length === 0) return true;
  const today = todayStr();
  return interviews.some((iv) => iv.date && iv.date >= today);
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

function renderColumn(status, items) {
  const container = cardsContainers[status];
  container.innerHTML = "";
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
}

function render() {
  const filtered = candidatures.filter(matchesFilters);

  STATUSES.forEach((status) => {
    renderColumn(status, filtered.filter((c) => c.status === status && !c.closed));
  });
  renderColumn("closed", filtered.filter((c) => c.closed));
  closedColumn.classList.toggle("hidden", !filters.showClosed);
  boardEl.classList.toggle("board-5col", filters.showClosed);

  const sentCount = candidatures.filter((c) => c.status !== "to-apply").length;
  sentStat.textContent = `${sentCount} application${sentCount === 1 ? "" : "s"} sent`;

  renderTagFilterOptions();
  updateStats();
  updateFollowUpBanner();
  updateInsights();
  updateNextActions();
  updateOnboardingVisibility();
}

function updateNextActions() {
  const followUpsDue = candidatures.filter(needsFollowUp).length;
  const interviewsToPrepare = candidatures.filter(needsPreparation).length;
  const inactive = candidatures.filter(isInactive).length;

  actionFollowUpsCount.textContent = followUpsDue;
  actionFollowUpsLabel.textContent = `follow-up${followUpsDue === 1 ? "" : "s"} due today`;
  actionInterviewsCount.textContent = interviewsToPrepare;
  actionInterviewsLabel.textContent = `interview${interviewsToPrepare === 1 ? "" : "s"} to prepare`;
  actionInactiveCount.textContent = inactive;
  actionInactiveLabel.textContent = `application${inactive === 1 ? "" : "s"} inactive ${INACTIVE_DAYS}+ days`;

  const anyAction = followUpsDue > 0 || interviewsToPrepare > 0 || inactive > 0;
  nextActionsSection.classList.toggle("hidden", !anyAction);

  if (followUpsDue === 0) followUpListPanel.classList.add("hidden");
  if (!followUpListPanel.classList.contains("hidden")) renderFollowUpList();
}

function renderFollowUpList() {
  const overdue = candidatures.filter(needsFollowUp).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
  followUpListItems.innerHTML = "";

  if (overdue.length === 0) {
    followUpListPanel.classList.add("hidden");
    return;
  }

  overdue.forEach((item) => {
    const row = document.createElement("div");
    row.className = "follow-up-row";

    const info = document.createElement("div");
    info.className = "follow-up-row-info";
    const days = daysSince(item.followUpDate);
    const overdueText = days > 0 ? `${days}d overdue` : "due today";
    info.innerHTML = `<strong>${item.company}</strong> <span class="follow-up-row-days">${overdueText}</span>`;
    row.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "follow-up-row-actions";

    const followUpBtn = document.createElement("button");
    followUpBtn.type = "button";
    followUpBtn.className = "ghost-btn small-btn";
    followUpBtn.textContent = "Follow up";
    followUpBtn.addEventListener("click", () => openFollowUpAction(item));
    actions.appendChild(followUpBtn);

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "mark-done-btn";
    doneBtn.textContent = "✓";
    doneBtn.title = "Mark follow-up as done";
    doneBtn.addEventListener("click", () => markFollowUpDone(item));
    actions.appendChild(doneBtn);

    row.appendChild(actions);
    followUpListItems.appendChild(row);
  });
}

function updateStats() {
  const total = candidatures.length;
  const sentItems = candidatures.filter((c) => c.status !== "to-apply");
  const sent = sentItems.length;
  const interviewed = sentItems.filter(reachedInterview).length;
  const decided = candidatures.filter(reachedDecision).length;
  const offers = candidatures.filter((c) => c.status === "offer").length;

  statTotal.textContent = total;
  statSent.textContent = sent;
  statInterviewRate.textContent = sent ? `${Math.round((interviewed / sent) * 100)}%` : "0%";
  statResponseRate.textContent = sent ? `${Math.round((decided / sent) * 100)}%` : "0%";
  statOfferRate.textContent = decided ? `${Math.round((offers / decided) * 100)}%` : "0%";
}

function updateFollowUpBanner() {
  // Follow-ups due are now surfaced by the "Next Actions" card (updateNextActions) —
  // this banner is deadline-only to avoid saying the same thing twice.
  const overdue = candidatures.filter(needsFollowUp);
  const deadlines = candidatures.filter(needsDeadlineAttention);

  if (deadlines.length === 0) {
    followUpBanner.classList.add("hidden");
    followUpBanner.innerHTML = "";
  } else {
    followUpBanner.classList.remove("hidden");
    followUpBanner.innerHTML = `📅 ${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} coming up: ${deadlines.map((c) => c.company).join(", ")}`;
  }
  maybeNotify(overdue, deadlines);
}

async function markFollowUpDone(item) {
  item.followUpDone = true;
  item.followUpDoneAt = Date.now();
  render();
  try {
    await upsertCandidature(currentUid, item);
    showToast(`Marked follow-up for ${item.company} as done.`);
  } catch (err) {
    console.error(err);
    showToast("Couldn't save. Please try again.");
  }
}

function reachedInterview(item) {
  return item.status === "interview" || !!item.hadInterview;
}

function reachedDecision(item) {
  // A real response only happened for an explicit Rejected (they said no) or an
  // Offer (they said yes) — Ghosted (no reply) and Withdrawn (the candidate acted,
  // not the company) never received a response and must not count here.
  if (item.status === "offer") return true;
  return !!item.closed && item.closedReason === "rejected";
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

function rateOf(items) {
  return items.length ? items.filter(reachedInterview).length / items.length : 0;
}

function formatMultiplier(x) {
  return x % 1 === 0 ? x : x.toFixed(1);
}

function updateInsights() {
  const sent = candidatures.filter((c) => c.status !== "to-apply");

  // Where are your interviews coming from?
  const bySource = groupBy(sent, (c) => c.source);
  insightSourceRows.innerHTML = "";
  insightSourceText.classList.add("hidden");
  if (bySource.size > 0) {
    const entries = [...bySource.entries()].sort((a, b) => b[1].length - a[1].length);
    entries.forEach(([source, items]) => {
      insightSourceRows.appendChild(buildInsightRow(source, items.length, items.filter(reachedInterview).length));
    });
    const qualifying = entries.filter(([, items]) => items.length >= 2);
    if (qualifying.length >= 2) {
      const best = qualifying.reduce((a, b) => (rateOf(b[1]) > rateOf(a[1]) ? b : a));
      if (rateOf(best[1]) > 0) {
        insightSourceText.innerHTML = `<strong>${best[0]}</strong> applications are currently performing best.`;
        insightSourceText.classList.remove("hidden");
      }
    }
    insightSource.classList.remove("hidden");
  } else {
    insightSource.classList.add("hidden");
  }

  // Which CV performs best?
  const byCv = groupBy(sent, (c) => c.cvVersion);
  insightCvRows.innerHTML = "";
  insightCvText.classList.add("hidden");
  if (byCv.size >= 2) {
    const entries = [...byCv.entries()].sort((a, b) => b[1].length - a[1].length);
    entries.forEach(([cv, items]) => {
      insightCvRows.appendChild(buildInsightRow(cv, items.length, items.filter(reachedInterview).length));
    });
    const qualifying = entries.filter(([, items]) => items.length >= 2);
    if (qualifying.length >= 2) {
      const best = qualifying.reduce((a, b) => (rateOf(b[1]) > rateOf(a[1]) ? b : a));
      if (rateOf(best[1]) > 0) {
        insightCvText.innerHTML = `<strong>${best[0]}</strong> is currently your best-performing CV.`;
        insightCvText.classList.remove("hidden");
      }
    }
    insightCv.classList.remove("hidden");
  } else {
    insightCv.classList.add("hidden");
  }

  // Tailored CV vs. generic
  const tailored = sent.filter((c) => c.tailoredCv);
  const generic = sent.filter((c) => !c.tailoredCv);
  insightTailoredRows.innerHTML = "";
  insightTailoredText.classList.add("hidden");
  if (tailored.length > 0 && generic.length > 0) {
    insightTailoredRows.appendChild(buildInsightRow("Tailored CVs", tailored.length, tailored.filter(reachedInterview).length));
    insightTailoredRows.appendChild(buildInsightRow("Generic CV", generic.length, generic.filter(reachedInterview).length));
    const tailoredRate = rateOf(tailored);
    const genericRate = rateOf(generic);
    if (genericRate > 0 && tailoredRate > genericRate) {
      insightTailoredText.innerHTML = `Tailored CVs generate <strong>${formatMultiplier(tailoredRate / genericRate)}×</strong> more interviews.`;
      insightTailoredText.classList.remove("hidden");
    }
    insightTailored.classList.remove("hidden");
  } else {
    insightTailored.classList.add("hidden");
  }

  // Referral vs. non-referral
  const referred = sent.filter((c) => c.referral);
  const nonReferred = sent.filter((c) => !c.referral);
  insightReferralRows.innerHTML = "";
  insightReferralText.classList.add("hidden");
  if (referred.length > 0 && nonReferred.length > 0) {
    insightReferralRows.appendChild(buildInsightRow("Referral", referred.length, referred.filter(reachedInterview).length));
    insightReferralRows.appendChild(buildInsightRow("No referral", nonReferred.length, nonReferred.filter(reachedInterview).length));
    const referredRate = rateOf(referred);
    const nonReferredRate = rateOf(nonReferred);
    if (nonReferredRate > 0 && referredRate > nonReferredRate) {
      insightReferralText.innerHTML = `Referrals generate <strong>${formatMultiplier(referredRate / nonReferredRate)}×</strong> more interviews.`;
      insightReferralText.classList.remove("hidden");
    }
    insightReferral.classList.remove("hidden");
  } else {
    insightReferral.classList.add("hidden");
  }

  const anyVisible = !insightSource.classList.contains("hidden")
    || !insightCv.classList.contains("hidden")
    || !insightTailored.classList.contains("hidden")
    || !insightReferral.classList.contains("hidden");
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
  const location = onboardLocation.value.trim();
  const weeklyGoal = parseInt(onboardWeeklyGoal.value, 10) || 0;
  const searchStartDate = onboardStartDate.value;
  const alreadySearching = onboardSearchingToggle.dataset.value || "";
  await setDoc(doc(db, "users", currentUid), {
    targetRole, location, weeklyGoal, searchStartDate, alreadySearching,
  }, { merge: true });
  return { targetRole, location, weeklyGoal, searchStartDate, alreadySearching };
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

  if (item.closed) {
    card.classList.add(`closed-${item.closedReason || "rejected"}`);
  } else if (item.status === "offer") {
    card.classList.add("status-offer");
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

  if (item.closed) {
    const badge = document.createElement("span");
    badge.className = `outcome-badge closed-${item.closedReason || "rejected"}`;
    badge.textContent = CLOSED_REASON_LABELS[item.closedReason] || "Closed";
    metaRow.appendChild(badge);
  }

  if (needsFollowUp(item)) {
    const reminder = document.createElement("span");
    reminder.className = "reminder-badge";
    const overdueDays = daysSince(item.followUpDate);
    reminder.textContent = overdueDays > 0 ? `Follow up · ${overdueDays}d overdue` : "Follow up · due today";
    metaRow.appendChild(reminder);

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "mark-done-btn";
    doneBtn.textContent = "✓";
    doneBtn.title = "Mark follow-up as done";
    doneBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      markFollowUpDone(item);
    });
    metaRow.appendChild(doneBtn);
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

  card.addEventListener("click", () => openDetailView(item));

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

function renderInterviewsList(item) {
  interviewsList.innerHTML = "";
  if (!item || item.interviews.length === 0) {
    const empty = document.createElement("div");
    empty.className = "notes-empty";
    empty.textContent = "No interviews logged yet.";
    interviewsList.appendChild(empty);
    return;
  }
  [...item.interviews]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .forEach((iv) => {
      const el = document.createElement("div");
      el.className = "note-item interview-record-item";

      const header = document.createElement("div");
      header.className = "interview-item-header";

      const title = document.createElement("span");
      title.className = "interview-item-title";
      title.textContent = iv.type || "Interview";
      header.appendChild(title);

      const meta = document.createElement("span");
      meta.className = "interview-item-meta";
      const dateLabel = iv.date ? formatDate(iv.date) : "No date";
      meta.textContent = iv.time ? `${dateLabel} · ${iv.time}` : dateLabel;
      header.appendChild(meta);

      el.appendChild(header);

      if (iv.people) {
        const people = document.createElement("div");
        people.className = "note-text";
        people.textContent = iv.people;
        el.appendChild(people);
      }

      el.addEventListener("click", () => openInterviewModal(item, iv));
      interviewsList.appendChild(el);
    });
}

function buildTimeline(item) {
  const toTs = (value) => (typeof value === "number" ? value : new Date(value + "T00:00:00").getTime());
  const entries = [];

  if (item.appliedDate) entries.push({ ts: toTs(item.appliedDate), label: "Applied" });
  if (item.followUpDate) entries.push({ ts: toTs(item.followUpDate), label: "Follow-up scheduled" });
  if (item.followUpDoneAt) entries.push({ ts: toTs(item.followUpDoneAt), label: "Follow-up sent" });

  (item.interviews || []).forEach((iv) => {
    if (iv.date) entries.push({ ts: toTs(iv.date), label: iv.type ? `Interview: ${iv.type}` : "Interview" });
  });

  (item.statusHistory || []).forEach((h) => {
    // "to-apply" isn't interesting, and "applied" is redundant with the dedicated
    // "Applied" entry above (both land on the same date in the common case).
    if (h.status === "to-apply" || h.status === "applied") return;
    entries.push({ ts: toTs(h.date), label: `Status: ${STATUS_LABELS[h.status] || h.status}` });
  });

  if (item.closedAt) {
    entries.push({ ts: toTs(item.closedAt), label: `Closed: ${CLOSED_REASON_LABELS[item.closedReason] || "Closed"}` });
  }

  entries.sort((a, b) => a.ts - b.ts);
  return entries.map((e) => ({
    dateLabel: new Date(e.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    label: e.label,
  }));
}

function renderDetailTimeline(item) {
  detailTimeline.innerHTML = "";
  const entries = buildTimeline(item);
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "notes-empty";
    empty.textContent = "No activity yet.";
    detailTimeline.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "timeline-row";
    const date = document.createElement("span");
    date.className = "timeline-date";
    date.textContent = entry.dateLabel;
    const label = document.createElement("span");
    label.className = "timeline-label";
    label.textContent = entry.label;
    row.appendChild(date);
    row.appendChild(label);
    detailTimeline.appendChild(row);
  });
}

/* ---------- modal ---------- */

function updateClosedReasonVisibility() {
  closedReasonField.classList.toggle("hidden", !fieldClosed.checked);
}

function handleStatusFieldChange() {
  if (fieldStatus.value === "interview") fieldHadInterview.checked = true;
}

const MESSAGE_TEMPLATES = {
  "check-in": ({ company, role, contactPerson }) =>
    `Hi${contactPerson ? ` ${contactPerson}` : ""},\n\nI wanted to follow up on my application for the ${role || "[role]"} position at ${company || "[company]"}. I'm still very interested in the opportunity and would love to hear about next steps whenever you have an update.\n\nThanks for your time,\n`,
  "thank-you": ({ company, role, contactPerson }) =>
    `Hi${contactPerson ? ` ${contactPerson}` : ""},\n\nThank you for taking the time to speak with me about the ${role || "[role]"} role at ${company || "[company]"}. I enjoyed our conversation and I'm even more excited about the opportunity. Please let me know if you need anything else from me.\n\nBest,\n`,
  "second-check-in": ({ company, role, contactPerson }) =>
    `Hi${contactPerson ? ` ${contactPerson}` : ""},\n\nJust checking in again on the ${role || "[role]"} position at ${company || "[company]"} — I know things can get busy, so no worries if there's nothing new yet. Still very much interested and happy to answer any questions.\n\nThanks,\n`,
};

function updateTemplatePreview() {
  const build = MESSAGE_TEMPLATES[templateSelect.value];
  if (!build) return;
  templatePreview.value = build({
    company: fieldCompany.value.trim(),
    role: fieldRole.value.trim(),
    contactPerson: fieldContact.value.trim(),
  });
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
  fieldJobDescription.value = item ? item.jobDescription || "" : "";
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
  fieldHadInterview.checked = item ? !!item.hadInterview : false;
  fieldClosed.checked = item ? !!item.closed : false;
  fieldClosedReason.value = item ? item.closedReason || "rejected" : "rejected";
  fieldFollowUpDate.value = item ? item.followUpDate || "" : "";
  fieldFollowUpType.value = item ? item.followUpType || "" : "";
  fieldFollowUpDone.checked = item ? !!item.followUpDone : false;
  updateClosedReasonVisibility();
  deleteBtn.classList.toggle("hidden", !item);

  renderTagEditorUI();
  updateTemplatePreview();

  modalOverlay.classList.remove("hidden");
  fieldCompany.focus();
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  cardForm.reset();
  editingId = null;
  editingTags = [];
}

function openDetailView(item) {
  viewingId = item.id;
  detailCompany.textContent = item.company;
  detailRole.textContent = item.role;
  renderDetailTimeline(item);
  detailContact.textContent = item.contactPerson || "No contact added yet.";
  detailJobDescription.textContent = item.jobDescription || "No description added.";
  detailCvVersion.textContent = item.cvVersion || "—";
  newNoteText.value = "";
  renderNotesList(item);
  renderInterviewsList(item);
  detailModalOverlay.classList.remove("hidden");
}

function closeDetailView() {
  detailModalOverlay.classList.add("hidden");
  viewingId = null;
}

function getViewingItem() {
  return candidatures.find((c) => c.id === viewingId) || null;
}

function refreshDetailView() {
  if (!viewingId) return;
  const item = getViewingItem();
  if (item) openDetailView(item);
}

/* ---------- interview record modal ---------- */

let editingInterviewCandidatureId = null;
let editingInterviewId = null;

function openInterviewModal(candidature, interview) {
  editingInterviewCandidatureId = candidature.id;
  editingInterviewId = interview ? interview.id : null;
  interviewModalTitle.textContent = interview ? "Edit Interview" : "Add Interview";
  ivDate.value = interview ? interview.date || "" : "";
  ivTime.value = interview ? interview.time || "" : "";
  ivType.value = interview ? interview.type || "" : "";
  ivPeople.value = interview ? interview.people || "" : "";
  ivNotes.value = interview ? interview.notes || "" : "";
  ivQuestionsAsked.value = interview ? interview.questionsAsked || "" : "";
  ivQuestionsToAsk.value = interview ? interview.questionsToAsk || "" : "";
  ivImpression.value = interview ? interview.impression || "" : "";
  ivNextStep.value = interview ? interview.nextStep || "" : "";
  ivDeleteBtn.classList.toggle("hidden", !interview);
  interviewModalOverlay.classList.remove("hidden");
  ivDate.focus();
}

function closeInterviewModal() {
  interviewModalOverlay.classList.add("hidden");
  interviewForm.reset();
  editingInterviewCandidatureId = null;
  editingInterviewId = null;
}

addInterviewBtn.addEventListener("click", () => {
  const candidature = getViewingItem();
  if (candidature) openInterviewModal(candidature, null);
});

ivCancelBtn.addEventListener("click", closeInterviewModal);
interviewModalOverlay.addEventListener("click", (e) => {
  if (e.target === interviewModalOverlay) closeInterviewModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !interviewModalOverlay.classList.contains("hidden")) closeInterviewModal();
});

interviewForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idx = candidatures.findIndex((c) => c.id === editingInterviewCandidatureId);
  if (idx === -1) return;

  const data = {
    date: ivDate.value,
    time: ivTime.value,
    type: ivType.value,
    people: ivPeople.value.trim(),
    notes: ivNotes.value.trim(),
    questionsAsked: ivQuestionsAsked.value.trim(),
    questionsToAsk: ivQuestionsToAsk.value.trim(),
    impression: ivImpression.value.trim(),
    nextStep: ivNextStep.value.trim(),
  };

  if (editingInterviewId) {
    const ivIdx = candidatures[idx].interviews.findIndex((iv) => iv.id === editingInterviewId);
    if (ivIdx !== -1) {
      candidatures[idx].interviews[ivIdx] = { ...candidatures[idx].interviews[ivIdx], ...data };
    }
  } else {
    candidatures[idx].interviews.push({ id: crypto.randomUUID(), ...data, createdAt: Date.now() });
  }

  renderInterviewsList(candidatures[idx]);
  renderDetailTimeline(candidatures[idx]);
  render();
  closeInterviewModal();

  try {
    await upsertCandidature(currentUid, candidatures[idx]);
  } catch (err) {
    console.error(err);
    showToast("Couldn't save the interview. Please try again.");
  }
});

ivDeleteBtn.addEventListener("click", async () => {
  const idx = candidatures.findIndex((c) => c.id === editingInterviewCandidatureId);
  if (idx === -1 || !editingInterviewId) return;
  candidatures[idx].interviews = candidatures[idx].interviews.filter((iv) => iv.id !== editingInterviewId);

  renderInterviewsList(candidatures[idx]);
  renderDetailTimeline(candidatures[idx]);
  render();
  closeInterviewModal();

  try {
    await upsertCandidature(currentUid, candidatures[idx]);
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete the interview. Please try again.");
  }
});

/* ---------- follow-up action drawer ---------- */

let followUpActionItem = null;

actionFollowUps.addEventListener("click", () => {
  const isHidden = followUpListPanel.classList.contains("hidden");
  if (isHidden) renderFollowUpList();
  followUpListPanel.classList.toggle("hidden", !isHidden);
});

function updateFollowUpActionPreview() {
  if (!followUpActionItem) return;
  const build = MESSAGE_TEMPLATES[faTemplateSelect.value];
  if (!build) return;
  faTemplatePreview.value = build({
    company: followUpActionItem.company,
    role: followUpActionItem.role,
    contactPerson: followUpActionItem.contactPerson,
  });
}

function openFollowUpAction(item) {
  followUpActionItem = item;
  followUpActionTitle.textContent = `Follow up — ${item.company}`;
  followUpActionContact.textContent = item.contactPerson ? `Contact: ${item.contactPerson}` : "";
  followUpActionContact.classList.toggle("hidden", !item.contactPerson);
  faTemplateSelect.value = item.followUpType === "thank-you" ? "thank-you" : "check-in";
  updateFollowUpActionPreview();
  followUpActionOverlay.classList.remove("hidden");
}

function closeFollowUpAction() {
  followUpActionOverlay.classList.add("hidden");
  followUpActionItem = null;
}

async function snoozeFollowUp(item, days) {
  item.followUpDate = addDays(todayStr(), days);
  item.followUpDone = false;
  item.followUpDoneAt = null;
  closeFollowUpAction();
  await saveCandidatureChange(item, "Couldn't save. Please try again.");
  showToast(`Snoozed ${item.company} for ${days} days.`);
}

faTemplateSelect.addEventListener("change", updateFollowUpActionPreview);
faCopyTemplateBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(faTemplatePreview.value);
    showToast("Template copied to clipboard.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't copy — select the text and copy it manually.");
  }
});
faSnooze3Btn.addEventListener("click", () => followUpActionItem && snoozeFollowUp(followUpActionItem, 3));
faSnooze7Btn.addEventListener("click", () => followUpActionItem && snoozeFollowUp(followUpActionItem, 7));
faCloseBtn.addEventListener("click", closeFollowUpAction);
faMarkDoneBtn.addEventListener("click", () => {
  if (!followUpActionItem) return;
  const item = followUpActionItem;
  closeFollowUpAction();
  markFollowUpDone(item);
});
followUpActionOverlay.addEventListener("click", (e) => {
  if (e.target === followUpActionOverlay) closeFollowUpAction();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !followUpActionOverlay.classList.contains("hidden")) closeFollowUpAction();
});

addBtn.addEventListener("click", () => openModal(null));
document.getElementById("cancelBtn").addEventListener("click", closeModal);
fieldStatus.addEventListener("change", handleStatusFieldChange);
fieldClosed.addEventListener("change", updateClosedReasonVisibility);
templateSelect.addEventListener("change", updateTemplatePreview);
fieldCompany.addEventListener("input", updateTemplatePreview);
fieldRole.addEventListener("input", updateTemplatePreview);
fieldContact.addEventListener("input", updateTemplatePreview);
copyTemplateBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(templatePreview.value);
    showToast("Template copied to clipboard.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't copy — select the text and copy it manually.");
  }
});
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
  if (e.key === "Escape" && !modalOverlay.classList.contains("hidden") && interviewModalOverlay.classList.contains("hidden")) closeModal();
});

detailCloseBtn.addEventListener("click", closeDetailView);
detailEditBtn.addEventListener("click", () => {
  const item = getViewingItem();
  closeDetailView();
  if (item) openModal(item);
});
detailModalOverlay.addEventListener("click", (e) => {
  if (e.target === detailModalOverlay) closeDetailView();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !detailModalOverlay.classList.contains("hidden") && interviewModalOverlay.classList.contains("hidden")) closeDetailView();
});

cardForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const existingItem = editingId ? candidatures.find((c) => c.id === editingId) : null;
  const hadInterview = fieldHadInterview.checked;
  const appliedDate = fieldAppliedDate.value;
  const status = fieldStatus.value;
  const closedChecked = fieldClosed.checked;
  const followUpDoneChecked = fieldFollowUpDone.checked;

  let followUpDate = fieldFollowUpDate.value;
  let followUpType = fieldFollowUpType.value;
  if (!followUpDate) {
    if (hadInterview) {
      followUpDate = addDays(todayStr(), 1);
      followUpType = "thank-you";
    } else if ((status === "applied" || status === "interview") && appliedDate) {
      followUpDate = addDays(appliedDate, FOLLOW_UP_DAYS);
      followUpType = "check-in";
    }
  }

  const statusHistory = existingItem ? [...(existingItem.statusHistory || [])] : [];
  if (!existingItem || existingItem.status !== status) {
    statusHistory.push({ status, date: Date.now() });
  }

  let closedAt = existingItem ? existingItem.closedAt : null;
  if (closedChecked) {
    if (!existingItem || !existingItem.closed) closedAt = Date.now();
  } else {
    closedAt = null;
  }

  let followUpDoneAt = existingItem ? existingItem.followUpDoneAt : null;
  if (followUpDoneChecked) {
    if (!existingItem || !existingItem.followUpDone) followUpDoneAt = Date.now();
  } else {
    followUpDoneAt = null;
  }

  const data = {
    company: fieldCompany.value.trim(),
    role: fieldRole.value.trim(),
    link: fieldLink.value.trim(),
    jobDescription: fieldJobDescription.value.trim(),
    appliedDate,
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
    status,
    statusHistory,
    hadInterview,
    followUpDate,
    followUpType,
    followUpDone: followUpDoneChecked,
    followUpDoneAt,
    closed: closedChecked,
    closedReason: closedChecked ? fieldClosedReason.value : "",
    closedAt,
  };
  if (!data.company || !data.role) return;

  let fullItem;
  if (editingId) {
    const idx = candidatures.findIndex((c) => c.id === editingId);
    fullItem = idx !== -1 ? { ...candidatures[idx], ...data } : { id: editingId, ...data, notes: [], interviews: [], createdAt: Date.now() };
    if (idx !== -1) candidatures[idx] = fullItem; else candidatures.push(fullItem);
  } else {
    fullItem = { id: crypto.randomUUID(), ...data, notes: [], interviews: [], createdAt: Date.now() };
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
  if (!viewingId) return;
  const text = newNoteText.value.trim();
  if (!text) return;
  const idx = candidatures.findIndex((c) => c.id === viewingId);
  if (idx === -1) return;
  candidatures[idx].notes.push({
    id: crypto.randomUUID(),
    text,
    date: Date.now(),
    status: candidatures[idx].status,
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

function appendStatusHistory(item, newStatus) {
  if (item.status === newStatus) return;
  item.statusHistory = [...(item.statusHistory || []), { status: newStatus, date: Date.now() }];
}

async function saveCandidatureChange(item, errorMessage) {
  render();
  try {
    await upsertCandidature(currentUid, item);
  } catch (err) {
    console.error(err);
    showToast(errorMessage);
  }
}

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
    if (!item) return;

    const prevStatus = item.status;
    appendStatusHistory(item, status);
    item.status = status;
    item.closed = false;
    item.closedReason = "";
    if (status === "interview") {
      item.hadInterview = true;
    } else if (status === "offer" && prevStatus !== "interview") {
      // Dropped straight into Offer without passing through Interview:
      // this specific move means no interview happened, even if the card
      // was flagged as interviewed at some earlier point.
      item.hadInterview = false;
    }
    saveCandidatureChange(item, "Couldn't save your changes. Please try again.");
  });
});

const closedCardsContainer = cardsContainers.closed;
closedCardsContainer.addEventListener("dragover", (e) => {
  e.preventDefault();
  closedCardsContainer.classList.add("drag-over");
});
closedCardsContainer.addEventListener("dragleave", () => {
  closedCardsContainer.classList.remove("drag-over");
});
closedCardsContainer.addEventListener("drop", async (e) => {
  e.preventDefault();
  closedCardsContainer.classList.remove("drag-over");
  const dragging = document.querySelector(".card.dragging");
  if (!dragging) return;
  const id = dragging.dataset.id;
  const item = candidatures.find((c) => c.id === id);
  if (!item) return;

  const reason = await openDialog({
    title: `Close ${item.company}?`,
    message: "Why is this application closed?",
    withSelect: true,
    selectOptions: [
      { value: "rejected", label: "Rejected" },
      { value: "withdrawn", label: "Withdrawn" },
      { value: "ghosted", label: "Ghosted (no response)" },
    ],
    confirmLabel: "Close application",
  });
  if (!reason) {
    render();
    return;
  }
  item.closed = true;
  item.closedReason = reason;
  item.closedAt = Date.now();
  saveCandidatureChange(item, "Couldn't save your changes. Please try again.");
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
showClosedCheckbox.addEventListener("change", () => {
  filters.showClosed = showClosedCheckbox.checked;
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

const CSV_HEADER = ["Company", "Role", "Status", "Closed", "Closed Reason", "Applied On", "Deadline", "Salary", "Contact", "Source", "CV Version", "Match Score", "Interest Score", "Referral", "Tailored CV", "Cover Letter", "Follow-up Date", "Follow-up Done", "Interviews", "Tags", "Link", "Notes"];

function summarizeInterviews(interviews) {
  if (!interviews || interviews.length === 0) return "0";
  const lastDate = [...interviews].map((iv) => iv.date).filter(Boolean).sort().pop();
  return lastDate ? `${interviews.length} (last: ${lastDate})` : String(interviews.length);
}

exportCsvBtn.addEventListener("click", () => {
  const rows = candidatures.map((c) => [
    c.company,
    c.role,
    STATUS_LABELS[c.status] || c.status,
    c.closed ? "Yes" : "No",
    c.closed ? (CLOSED_REASON_LABELS[c.closedReason] || c.closedReason) : "",
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
    c.followUpDate,
    c.followUpDone ? "Yes" : "No",
    summarizeInterviews(c.interviews),
    c.tags.map((t) => resolveTag(t).label).join("; "),
    c.link,
    c.notes.map((n) => `[${STATUS_LABELS[n.status] || n.status}] ${n.text}`).join(" | "),
  ]);
  const csv = [CSV_HEADER, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(csv, "job-applications.csv", "text/csv");
});

importJsonBtn.addEventListener("click", () => importJsonInput.click());

const LABEL_TO_STATUS = Object.fromEntries(Object.entries(STATUS_LABELS).map(([k, v]) => [v.toLowerCase(), k]));
const LABEL_TO_TAG_ID = Object.fromEntries(TAG_PRESETS.map((t) => [t.label.toLowerCase(), t.id]));
const LABEL_TO_CLOSED_REASON = Object.fromEntries(Object.entries(CLOSED_REASON_LABELS).map(([k, v]) => [v.toLowerCase(), k]));

function parseCsvText(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/\r\n/g, "\n");
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); field = ""; row = []; i++; continue; }
    field += ch; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}

function csvRowsToCandidatures(rows) {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name.toLowerCase());
  const get = (row, name) => {
    const i = idx(name);
    return i === -1 ? "" : (row[i] || "").trim();
  };
  return rows.slice(1).map((row) => {
    const tagsRaw = get(row, "Tags");
    return migrateCandidature({
      company: get(row, "Company"),
      role: get(row, "Role"),
      status: LABEL_TO_STATUS[get(row, "Status").toLowerCase()] || "to-apply",
      closed: get(row, "Closed").toLowerCase() === "yes",
      closedReason: LABEL_TO_CLOSED_REASON[get(row, "Closed Reason").toLowerCase()] || "",
      appliedDate: get(row, "Applied On"),
      deadline: get(row, "Deadline"),
      salary: get(row, "Salary"),
      contactPerson: get(row, "Contact"),
      source: get(row, "Source"),
      cvVersion: get(row, "CV Version"),
      matchScore: get(row, "Match Score"),
      interestScore: get(row, "Interest Score"),
      referral: get(row, "Referral").toLowerCase() === "yes",
      tailoredCv: get(row, "Tailored CV").toLowerCase() === "yes",
      coverLetter: get(row, "Cover Letter").toLowerCase() === "yes",
      followUpDate: get(row, "Follow-up Date"),
      followUpDone: get(row, "Follow-up Done").toLowerCase() === "yes",
      tags: tagsRaw ? tagsRaw.split(";").map((t) => t.trim()).filter(Boolean).map((t) => LABEL_TO_TAG_ID[t.toLowerCase()] || t) : [],
      link: get(row, "Link"),
    });
  });
}

async function handleImportedItems(imported) {
  const ok = await openDialog({
    title: "Import applications?",
    message: `Import ${imported.length} application${imported.length === 1 ? "" : "s"}? They will be added to your current list.`,
    confirmLabel: "Import",
  });
  if (!ok) return;
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

importJsonInput.addEventListener("change", () => {
  const file = importJsonInput.files[0];
  if (!file) return;
  const isCsv = /\.csv$/i.test(file.name);
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      let imported;
      if (isCsv) {
        const rows = parseCsvText(reader.result);
        imported = csvRowsToCandidatures(rows);
        if (imported.length === 0) throw new Error("empty");
      } else {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        imported = parsed.map((c) => migrateCandidature({ ...c, id: undefined }));
      }
      await handleImportedItems(imported);
    } catch {
      showToast(isCsv
        ? "This file doesn't look like a valid JobHunt Xpert CSV export."
        : "This file doesn't look like a valid JobHunt Xpert JSON backup.");
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

async function deleteAccount() {
  if (isDemoMode || !auth.currentUser) return;
  const user = auth.currentUser;

  const typed = await openDialog({
    title: "Delete your account?",
    message: "This permanently deletes your account and every application you've tracked. This cannot be undone. Type DELETE to confirm.",
    withInput: true,
    confirmLabel: "Delete forever",
  });
  if (typed !== "DELETE") {
    if (typed !== null) showToast("Account not deleted — you must type DELETE exactly.");
    return;
  }

  try {
    const snap = await getDocs(candidaturesCollection(user.uid));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = writeBatch(db);
      docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);
    showToast("Your account has been deleted.");
  } catch (err) {
    console.error(err);
    if (err && err.code === "auth/requires-recent-login") {
      showToast("For your security, please sign out and sign back in, then try deleting your account again.");
    } else {
      showToast("Couldn't delete your account. Please try again.");
    }
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

let checkoutInFlight = false;

async function requestUnlock() {
  if (!auth.currentUser) {
    signInWithGoogle();
    return;
  }
  if (checkoutInFlight) return;
  checkoutInFlight = true;
  unlockBtn.disabled = true;
  heroCtaBtn.disabled = true;
  try {
    const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
    const result = await createCheckoutSession();
    if (result.data && result.data.url) {
      location.href = result.data.url;
      return; // leaving the page — no need to reset the in-flight flag
    }
    showToast("Couldn't start checkout. Please try again.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't start checkout. Please try again.");
  }
  checkoutInFlight = false;
  unlockBtn.disabled = false;
  heroCtaBtn.disabled = false;
}

function handleCheckoutRedirect() {
  const params = new URLSearchParams(location.search);
  const checkout = params.get("checkout");
  if (checkout === "success") {
    showToast("Payment received — activating your account…");
  } else if (checkout === "cancelled") {
    showToast("Checkout cancelled — no charge was made.");
  }
  if (checkout) {
    params.delete("checkout");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
  }
}

/* ---------- demo mode ---------- */

function buildDemoCandidatures() {
  const today = todayStr();
  const mk = (company, role, status, opts = {}) => ({
    id: crypto.randomUUID(),
    company, role, status,
    appliedDate: opts.appliedDate ?? addDays(today, -5),
    source: opts.source || "LinkedIn",
    cvVersion: opts.cvVersion || "",
    contactPerson: opts.contactPerson || "",
    salary: opts.salary || "",
    followUpDate: opts.followUpDate ?? "",
    followUpDone: opts.followUpDone ?? true,
    hadInterview: opts.hadInterview ?? false,
    closed: opts.closed || false,
    closedReason: opts.closedReason || "",
    referral: opts.referral || false,
    tailoredCv: opts.tailoredCv || false,
    interviews: opts.interviews || [],
    tags: opts.tags || [],
  });

  return [
    mk("Notion", "Product Manager", "to-apply", { appliedDate: "" }),
    mk("Airbnb", "Frontend Engineer", "to-apply", { appliedDate: "" }),

    mk("Vercel", "Growth Manager", "applied", { appliedDate: addDays(today, -11), followUpDate: addDays(today, -1), followUpDone: false, source: "LinkedIn", contactPerson: "Priya Shah" }),
    mk("Dropbox", "Account Executive", "applied", { appliedDate: addDays(today, -10), followUpDate: today, followUpDone: false, source: "Referral" }),
    mk("Spotify", "Data Analyst", "applied", { appliedDate: addDays(today, -10), followUpDate: today, followUpDone: false, source: "Company website" }),
    mk("Figma", "UX Researcher", "applied", { appliedDate: addDays(today, -16), followUpDone: true, source: "LinkedIn", cvVersion: "CV Success", tailoredCv: true }),
    mk("Linear", "Backend Engineer", "applied", { appliedDate: addDays(today, -18), followUpDone: true, source: "Referral", cvVersion: "CV Sales" }),
    mk("Miro", "Partnerships Lead", "applied", { appliedDate: addDays(today, -20), followUpDone: true, source: "LinkedIn", referral: true }),

    mk("Stripe", "Sales Engineer", "interview", { appliedDate: addDays(today, -9), hadInterview: true, followUpDone: true, source: "LinkedIn", cvVersion: "CV Sales", contactPerson: "Daniel Kim", tailoredCv: true,
      interviews: [{ id: crypto.randomUUID(), date: addDays(today, 2), time: "14:00", type: "Video call" }] }),
    mk("Asana", "Customer Success Manager", "interview", { appliedDate: addDays(today, -7), hadInterview: true, followUpDone: true, source: "Referral", cvVersion: "CV Success", referral: true, tailoredCv: true,
      interviews: [{ id: crypto.randomUUID(), date: addDays(today, 1), time: "10:30", type: "On-site" }] }),

    mk("Canva", "Marketing Manager", "offer", { appliedDate: addDays(today, -25), hadInterview: true, followUpDone: true, source: "LinkedIn", cvVersion: "CV Success", referral: true, tailoredCv: true }),

    mk("Slack", "Recruiter", "interview", { appliedDate: addDays(today, -19), hadInterview: true, followUpDone: true, source: "Company website", cvVersion: "CV Sales", closed: true, closedReason: "rejected" }),
    mk("Webflow", "Product Designer", "applied", { appliedDate: addDays(today, -22), followUpDone: true, source: "Recruiter", closed: true, closedReason: "ghosted" }),
    mk("Zapier", "Solutions Engineer", "applied", { appliedDate: addDays(today, -15), followUpDone: true, source: "Indeed", closed: true, closedReason: "withdrawn" }),
  ];
}

function startDemoMode() {
  demoModeLabel.classList.remove("hidden");
  signInBtn.classList.add("hidden");
  userMenu.classList.add("hidden");
  demoBanner.classList.remove("hidden");
  showGateState("paid");
  candidatures = buildDemoCandidatures().map(migrateCandidature);
  render();
}

demoBannerCta.addEventListener("click", () => {
  location.href = "app.html";
});

signInBtn.addEventListener("click", signInWithGoogle);
signOutBtn.addEventListener("click", () => signOut(auth).catch((err) => console.error(err)));
deleteAccountBtn.addEventListener("click", deleteAccount);
heroCtaBtn.addEventListener("click", requestUnlock);
unlockBtn.addEventListener("click", requestUnlock);
if (isDemoMode) {
  startDemoMode();
} else {
  onAuthStateChanged(auth, handleAuthChange);
}

/* ---------- init ---------- */

initTheme();
renderUserGreeting();
updateQuote();
setInterval(updateQuote, 60 * 1000);
handleCheckoutRedirect();

render();

// community.js runs as a separate module scope and calls these via `window`.
window.renderUserGreeting = renderUserGreeting;
window.showToast = showToast;
