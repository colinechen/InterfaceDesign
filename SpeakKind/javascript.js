// ===============================
// UTILITIES
// ===============================
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function matchesAny(list, text) {
  return list.some(w => text.includes(w));
}

// ===============================
// WORD LISTS
// ===============================
const hateWords = ["dumm", "idiot", "hass", "behindert", "blöd"];
const mediumWords = ["nervig", "scheiße", "freak", "abschaum", "arsch", "opfer"];
const strongWords = ["töten", "hasse dich", "bitch", "hurensohn", "fick dich", "bring dich um", "versager", "nichtsnutz", "kys", "kill yourself"];

// ===============================
// STATE
// ===============================
let strikeCount = 0;
let isLocked = false;
let lockEnd = 0;

// DOM references used globally
const strikeBadge = document.getElementById("strike-badge"); // kept from your HTML
const strikeLabelAlt = document.querySelector(".strike-count"); // fallback/class
const resourceModal = document.getElementById("resource-modal");
const resourceBody = document.getElementById("resource-body");
const closeResourceBtn = document.getElementById("close-resource");
const lockOverlay = document.getElementById("lock-overlay");
const resetStrikesBtn = document.getElementById("reset-strikes");

// thresholds (demo values you used earlier)
const MEDIUM_THRESHOLD = 10; // kept from earlier designs (not used in current simple demo)
const STRONG_THRESHOLD = 3;  // used for demo account lock

// Helper: update visual strike display
function updateStrikeDisplay() {
  const text = `Strikes: ${strikeCount}`;
  if (strikeBadge) strikeBadge.textContent = text;
  if (strikeLabelAlt) strikeLabelAlt.textContent = text;
  // small pulse animation
  if (strikeBadge) {
    strikeBadge.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(1.06)", opacity: 1 },
        { transform: "scale(1)", opacity: 1 }
      ],
      { duration: 380, easing: "ease-out" }
    );
  }
}

// ===============================
// SEND / CHECK HANDLER (per-post)
// ===============================

function disableSendTemporarily(sendBtn, input, duration = 2600) {
  sendBtn.disabled = true;          // Button blockieren
  sendBtn.classList.add("disabled"); // optional: CSS-Klasse ausgrauen

  input.disabled = true;            // Input auch blockieren
  input.classList.add("disabled");

  setTimeout(() => {
    sendBtn.disabled = false;
    sendBtn.classList.remove("disabled");
    input.disabled = false;
    input.classList.remove("disabled");
  }, duration);
}


// ===============================
// SEND / CHECK HANDLER (per-post)
// ===============================
function handleSendClick(button) {
  const sendBtn = button; // für disableSendTemporarily
  const post = button.closest(".post");
  if (!post) return;

  const section = post.querySelector(".comment-section");
  const input = section.querySelector(".comment-input");
  const alertBox = section.querySelector(".alert");
  const commentsContainer = section.querySelector(".comments");

  const raw = input.value.trim();
  const text = raw.toLowerCase();

  if (raw === "") return;

  const now = Date.now();
  if (isLocked && now < lockEnd) {
    showAlertInBox(alertBox, `Dein Konto ist gesperrt. Noch ${Math.ceil((lockEnd - now) / 1000)}s.`, false);
    shake(input);
    return;
  }

  if (isLocked && now >= lockEnd) {
    isLocked = false;
    strikeCount = 0;
    updateStrikeDisplay();
    toggleLockOverlay(false);
  }

  // --- STRONG WORDS ---
  if (matchesAny(strongWords, text)) {
    strikeCount++;
    updateStrikeDisplay();
    showAlertInBox(alertBox, "Stopp! Diese Sprache verletzt. Schreibpause 60s.", true, section, raw, 60, "strong");
    applyTypingTimeout(input, 60);
    disableSendTemporarily(sendBtn, input);
    checkForLock("strong");
    return;
  }

  // --- MEDIUM WORDS ---
  if (matchesAny(mediumWords, text)) {
    strikeCount++;
    updateStrikeDisplay();
    showAlertInBox(alertBox, "Atme kurz durch. Schreibpause 20s.", true, section, raw, 20, "medium");
    applyTypingTimeout(input, 20);
    disableSendTemporarily(sendBtn, input);
    checkForLock("medium");
    return;
  }

  // --- HATE WORDS (soft) ---
  if (matchesAny(hateWords, text)) {
    showAlertInBox(alertBox, "Bist du sicher, dass du das so sagen willst?", true, section, raw, 0, "soft");
    disableSendTemporarily(sendBtn, input);
    return;
  }

  // --- NEUTRAL: post comment ---
  const p = document.createElement("p");
  p.innerHTML = `<strong>Du:</strong> ${escapeHtml(raw)}`;
  commentsContainer.appendChild(p);
  p.animate(
    [
      { opacity: 0, transform: "translateY(6px)" },
      { opacity: 1, transform: "translateY(0)" }
    ],
    { duration: 240, easing: "ease-out" }
  );
  input.value = "";
  // neutraler Kommentar → kein Alert
}
// ===============================
// ALERT UI + "Warum?" button integration
// ===============================
// showAlertInBox(alertBox, message, addWhyButton=false, section, originalText, timeoutSeconds, level)
function showAlertInBox(box, message, addWhy = false, section = null, originalText = "", timeoutSeconds = 0, level = "") {
  if (!box) return;

  // clear previous content
  box.innerHTML = "";

  const row = document.createElement("div");
  row.className = "alert-row";

  const iconDiv = document.createElement("div");
  iconDiv.className = "alert-icon";
  iconDiv.textContent = level === "strong" ? "" : level === "medium" ? "" : "";

  const textDiv = document.createElement("div");
  textDiv.className = "alert-text";
  const msgDiv = document.createElement("div");
  msgDiv.className = "alert-msg";
  msgDiv.textContent = message;
  textDiv.appendChild(msgDiv);

  row.appendChild(iconDiv);
  row.appendChild(textDiv);
  box.appendChild(row);

  if (addWhy) {
    const whyBtn = document.createElement("button");
    whyBtn.className = "why-btn";
    whyBtn.type = "button";
    whyBtn.textContent = "Warum?";
    whyBtn.title = "Mehr erfahren, warum das problematisch ist";
    whyBtn.addEventListener("click", () => {
      populateResourceModal(level, originalText);
      toggleModal(resourceModal, true);
    });
    box.appendChild(whyBtn);
  }

  // strike info small
  const strikeInfo = document.createElement("div");
  strikeInfo.className = "strike-info";
  strikeInfo.textContent = `Strikes: ${strikeCount}`;
  box.appendChild(strikeInfo);

  // display + animation
  box.style.display = "block";
  box.classList.add("visible");
  box.animate(
    [
      { transform: "translateY(-8px)", opacity: 0 },
      { transform: "translateY(0)", opacity: 1 }
    ],
    { duration: 280, easing: "ease-out" }
  );

  // countdown handling when needed
  if (timeoutSeconds > 0 && section) {
    const input = section.querySelector(".comment-input");
    if (input) {
      input.disabled = true;
      let remaining = timeoutSeconds;
      const countdown = document.createElement("div");
      countdown.className = "countdown";
      countdown.textContent = `Noch ${remaining}s...`;
      box.appendChild(countdown);

      const interval = setInterval(() => {
        remaining--;
        if (remaining >= 0) countdown.textContent = `Noch ${remaining}s...`;
        if (remaining <= 0) {
          clearInterval(interval);
          box.style.display = "none";
          // re-enable input
          input.disabled = false;
        }
      }, 1000);
    }
  } else {
    // auto-hide after 2.2s for informational alerts (no pause)
    setTimeout(() => {
      // slide out
      box.animate(
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(-6px)", opacity: 0 }
        ],
        { duration: 200, easing: "ease-in" }
      );
      setTimeout(() => {
        box.style.display = "none";
      }, 220);
    }, 2000);
  }
}

// ===============================
// populate resource modal with contextual explanation
// ===============================
function populateResourceModal(level, text) {
  if (!resourceBody) return;
  let explanation = "";
  if (!text) text = "(Beispieltext)";

  if (level === "strong") {
    explanation = `<p>Starke Beleidigungen oder Aufforderungen zu Gewalt sind besonders verletzend und können strafrechtliche Relevanz haben.</p>`;
  } else if (level === "medium") {
    explanation = `<p>Mittlere Ausdrücke drücken Verachtung aus und verschlechtern das Diskussionsklima.</p>`;
  } else {
    explanation = `<p>Auch scheinbar harmlose Ausdrücke können in Kontexten verletzend wirken.</p>`;
  }

  const sample = `<p class="sample"><strong>Kommentar:</strong> "${escapeHtml(text)}"</p>`;
  const links = `
    <ul>
      <li><a href="https://hateaid.org/" target="_blank" rel="noopener">HateAid – Hilfe bei Hass im Netz</a></li>
      <li><a href="https://www.bpb.de/" target="_blank" rel="noopener">Bundeszentrale für politische Bildung</a></li>
      <li><a href="https://www.amnesty.de/" target="_blank" rel="noopener">Amnesty International</a></li>
    </ul>
  `;

  resourceBody.innerHTML = `<p>Kontextbasierte Erklärung:</p>${explanation}${sample}<h4>Weiterführende Ressourcen</h4>${links}`;
}

// ===============================
// small helpers (shake, typing timeout)
// ===============================
function shake(el) {
  if (!el) return;
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-8px)" },
      { transform: "translateX(8px)" },
      { transform: "translateX(0)" }
    ],
    { duration: 240, easing: "ease" }
  );
}

function applyTypingTimeout(inputEl, seconds) {
  if (!inputEl) return;
  inputEl.disabled = true;
  inputEl.classList.add("disabled");
  setTimeout(() => {
    inputEl.disabled = false;
    inputEl.classList.remove("disabled");
  }, seconds * 1000);
}

// ===============================
// LOCK / STRIKE logic
// ===============================
function checkForLock(level) {
  if (!level) return;

  if (level === "strong" && strikeCount >= STRONG_THRESHOLD) {
    isLocked = true;
    lockEnd = Date.now() + 8000; // 8s Demo
    toggleLockOverlay(true, "Mehrere starke Verstöße gegen die Community-Richtlinien.");
    document.querySelectorAll(".comment-input").forEach(i => i.disabled = true);
    const firstAlert = document.querySelector(".post .alert");
    if (firstAlert) showAlertInBox(firstAlert, "Dein Konto wurde temporär gesperrt (Demo).", false);
  }

  if (level === "medium" && strikeCount >= MEDIUM_THRESHOLD) {
    isLocked = true;
    lockEnd = Date.now() + 8000; // 8s Demo
    toggleLockOverlay(true, "Mehrere mittlere Verstöße gegen die Community-Richtlinien.");
    document.querySelectorAll(".comment-input").forEach(i => i.disabled = true);
    const firstAlert = document.querySelector(".post .alert");
    if (firstAlert) showAlertInBox(firstAlert, "Dein Konto wurde temporär gesperrt (Demo).", false);
  }
}

function toggleLockOverlay(show, reason = "") {
  if (!lockOverlay) return;
  if (show) {
    lockOverlay.classList.remove("hidden");
    const reasonEl = document.getElementById("lock-reason");
    if (reasonEl && reason) reasonEl.textContent = reason;
  } else {
    lockOverlay.classList.add("hidden");
  }
}

// reset strikes (demo button)
if (resetStrikesBtn) {
  resetStrikesBtn.addEventListener("click", () => {
    strikeCount = 0;
    isLocked = false;
    lockEnd = 0;
    updateStrikeDisplay();
    toggleLockOverlay(false);
    document.querySelectorAll(".comment-input").forEach(i => i.disabled = false);
  });
}

// ===============================
// LIKE BUTTONS
// ===============================
document.querySelectorAll(".like-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const icon = btn.querySelector("i");
    // toggle font-awesome classes if present
    if (icon) {
      if (icon.classList.contains("fa-regular")) {
        icon.classList.remove("fa-regular");
        icon.classList.add("fa-solid");
        icon.classList.add("liked");
      } else {
        icon.classList.remove("fa-solid");
        icon.classList.remove("liked");
        icon.classList.add("fa-regular");
      }
    } else {
      btn.classList.toggle("liked");
    }

    btn.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.25)" },
        { transform: "scale(1)" }
      ],
      { duration: 260, easing: "ease-out" }
    );

    // if likes number on post exists, increment/decrement
    const post = btn.closest(".post");
    if (post) {
      const numEl = post.querySelector(".likes-number");
      if (numEl) {
        let val = parseInt(numEl.textContent || "0", 10);
        if (btn.classList.contains("liked") || (icon && icon.classList.contains("liked"))) val = val + 1;
        else val = Math.max(0, val - 1);
        numEl.textContent = val;
      }
    }
  });
});

// ===============================
// SEND BUTTONS initialization
// ===============================
document.querySelectorAll(".send-btn").forEach(button => {
  button.addEventListener("click", () => handleSendClick(button));
});

// ===============================
// RESOURCE MODAL close
// ===============================
if (closeResourceBtn && resourceModal) {
  closeResourceBtn.addEventListener("click", () => toggleModal(resourceModal, false));
}

// simple modal toggle
function toggleModal(modalEl, show) {
  if (!modalEl) return;
  if (show) modalEl.classList.remove("hidden");
  else modalEl.classList.add("hidden");
}

// --- ensure initial strike display set
updateStrikeDisplay();
