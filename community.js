import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const USER_NAME_KEY = "jobhunting-user-name";

const communityForm = document.getElementById("communityForm");
const communityNameInput = document.getElementById("communityName");
const communityTextInput = document.getElementById("communityText");
const communityFeed = document.getElementById("communityFeed");
const communityEmpty = document.getElementById("communityEmpty");

communityNameInput.value = localStorage.getItem(USER_NAME_KEY) || "";

function relativeTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderFeed(docs) {
  communityFeed.innerHTML = "";
  if (docs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "community-empty";
    empty.textContent = "No messages yet — be the first to say hi.";
    communityFeed.appendChild(empty);
    return;
  }
  docs.forEach((doc) => {
    const data = doc.data();
    const card = document.createElement("div");
    card.className = "community-card";

    const head = document.createElement("div");
    head.className = "community-card-head";
    const name = document.createElement("span");
    name.className = "community-name";
    name.textContent = data.name || "Anonymous";
    const time = document.createElement("span");
    time.className = "community-time";
    time.textContent = relativeTime(data.createdAt);
    head.appendChild(name);
    head.appendChild(time);

    const text = document.createElement("div");
    text.className = "community-text";
    text.textContent = data.text || "";

    card.appendChild(head);
    card.appendChild(text);
    communityFeed.appendChild(card);
  });
}

function isConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
}

if (!isConfigured()) {
  communityEmpty.textContent = "Community wall isn't configured yet.";
  communityForm.classList.add("hidden");
} else {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const messagesQuery = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(100));

    onSnapshot(
      messagesQuery,
      (snap) => renderFeed(snap.docs),
      (err) => {
        console.error("community listen error", err);
        communityEmpty.textContent = "Couldn't load the community wall right now.";
      }
    );

    communityForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = communityNameInput.value.trim();
      const text = communityTextInput.value.trim();
      if (!name || !text) return;
      const submitBtn = communityForm.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      try {
        localStorage.setItem(USER_NAME_KEY, name);
        if (typeof window.renderUserGreeting === "function") window.renderUserGreeting();
        await addDoc(collection(db, "messages"), { name, text, createdAt: Date.now() });
        communityTextInput.value = "";
      } catch (err) {
        console.error(err);
        if (typeof window.showToast === "function") window.showToast("Couldn't post your message. Please try again.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  } catch (err) {
    console.error("Firebase init failed", err);
    communityEmpty.textContent = "Couldn't connect to the community wall.";
    communityForm.classList.add("hidden");
  }
}
