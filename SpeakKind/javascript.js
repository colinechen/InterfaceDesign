document.addEventListener("DOMContentLoaded", () => {
  // ===============================
  // UTILITIES
  // ===============================
  const escapeHtml = text => text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const matchesAny = (list, text) => list.some(w => text.includes(w));

  // ===============================
  // CONSTANTS
  // ===============================
  const HATE_WORDS = ["dumm", "idiot", "hass", "behindert", "blöd"];
  const MEDIUM_WORDS = ["nervig", "scheiße", "freak", "abschaum", "arsch", "opfer"];
  const STRONG_WORDS = [
    "töten", "hasse dich", "bitch", "hurensohn",
    "fick dich", "bring dich um", "versager",
    "nichtsnutz", "kys", "kill yourself"
  ];

  const MODERATION_API = "https://speakkind.lucahemmi007.workers.dev";
  const MAX_STRIKES = 5;

  const TIMEOUT_DURATIONS = {
    strong: 60000,
    medium: 20000,
    soft: 2500
  };

  // ===============================
  // STATE
  // ===============================
  let strikeCount = 0;
  let isLocked = false;

  // ===============================
  // DOM CACHE
  // ===============================
  const dom = {
    strikeBadge: document.getElementById("strike-badge"),
    resourceModal: document.getElementById("resource-modal"),
    resourceBody: document.getElementById("resource-body"),
    closeResourceBtn: document.getElementById("close-resource"),
    lockOverlay: document.getElementById("lock-overlay"),
    resetStrikesBtn: document.getElementById("reset-strikes"),
    shareOverlay: document.getElementById("share-overlay"),
    closeShareBtn: document.getElementById("close-share"),
    sendShareBtn: document.getElementById("send-share"),
    shareMessageInput: document.getElementById("share-message"),
    shareAlert: document.getElementById("share-alert")
  };

  // ===============================
  // AUDIO
  // ===============================
  const sounds = {
    block: new Audio("sounds/denied.mp3"),
    locked: new Audio("sounds/alarm.mp3")
  };

  sounds.block.volume = 0.6;
  sounds.locked.volume = 0.7;

  // Audio unlock (einmal)
  document.addEventListener("click", () => {
    Object.values(sounds).forEach(a => {
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
      }).catch(() => { });
    });
  }, { once: true });

  const playSound = audio => {
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => { });
  };

  // ===============================
  // ANIMATIONS
  // ===============================
  const animations = {
    pulse: [
      { transform: "scale(1)" },
      { transform: "scale(1.08)" },
      { transform: "scale(1)" }
    ],
    shake: [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0)" }
    ],
    fadeInUp: [
      { opacity: 0, transform: "translateY(6px)" },
      { opacity: 1, transform: "translateY(0)" }
    ],
    fadeInDown: [
      { opacity: 0, transform: "translateY(-6px)" },
      { opacity: 1, transform: "translateY(0)" }
    ],
    fadeOut: [
      { opacity: 1 },
      { opacity: 0 }
    ]
  };

  const animate = (el, keyframes, duration = 300) => {
    if (!el) return;
    el.animate(keyframes, { duration, easing: "ease-out" });
  };

  // ===============================
  // STRIKE DISPLAY
  // ===============================
  const updateStrikeDisplay = () => {
    if (!dom.strikeBadge) return;
    dom.strikeBadge.textContent = `Strikes: ${strikeCount}`;
    dom.strikeBadge.style.display = "inline-block";
    requestAnimationFrame(() => animate(dom.strikeBadge, animations.pulse, 380));
  };

  // ===============================
  // UI HELPERS
  // ===============================
  const disableTemporarily = (sendBtn, input, ms) => {
    sendBtn.disabled = true;
    input.disabled = true;
    setTimeout(() => {
      sendBtn.disabled = false;
      input.disabled = false;
    }, ms);
  };

  const toggleModal = (modal, show) => {
    if (!modal) return;
    modal.classList.toggle("hidden", !show);
  };

  // ===============================
  // ALERT SYSTEM (ANGEPASST)
  // ===============================
  const showAlertInBox = (box, message, addWhy = false, section = null, originalText = "", timeoutSeconds = 0, level = "", triggeredCategories = []) => {
    if (!box) return;

    box.innerHTML = "";
    box.style.display = "block";

    const msg = document.createElement("div");
    msg.className = "alert-msg";
    msg.textContent = message;
    box.appendChild(msg);

    if (addWhy) {
      const whyBtn = document.createElement("button");
      whyBtn.className = "why-btn";
      whyBtn.textContent = "Warum?";
      whyBtn.onclick = () => {
        populateResourceModal(level, originalText, triggeredCategories); // Kategorien übergeben
        toggleModal(dom.resourceModal, true);
      };
      box.appendChild(whyBtn);
    }

    animate(box, animations.fadeInDown, 260);

    if (timeoutSeconds > 0 && section) {
      const input = section.querySelector(".comment-input");
      let remaining = timeoutSeconds;

      const countdown = document.createElement("div");
      countdown.className = "countdown";
      countdown.textContent = `Noch ${remaining}s`;
      box.appendChild(countdown);

      input.disabled = true;

      const interval = setInterval(() => {
        remaining--;
        countdown.textContent = `Noch ${remaining}s`;
        if (remaining <= 0) {
          clearInterval(interval);
          box.style.display = "none";
          input.disabled = false;
        }
      }, 1000);
    } else {
      setTimeout(() => {
        animate(box, animations.fadeOut, 200);
        setTimeout(() => box.style.display = "none", 200);
      }, 2200);
    }
  };

  // ===============================
  // RESOURCE MODAL (ERWEITERT)
  // ===============================
  const explanations = {
    strong: "Gewaltvolle oder extrem beleidigende Sprache kann Menschen ernsthaft schaden.",
    medium: "Abwertende Sprache verschlechtert das Diskussionsklima.",
    soft: "Auch scheinbar harmlose Worte können verletzend wirken."
  };

  // Deutsche Übersetzungen für KI-Kategorien
  const categoryTranslations = {
    violence: "Gewalt",
    threat: "Bedrohung",
    self_harm: "Selbstverletzung",
    harassment: "Belästigung",
    harassment_threatening: "Bedrohliche Belästigung",
    hate: "Hassrede",
    hate_threatening: "Bedrohliche Hassrede",
    sexual: "Sexueller Inhalt",
    profanity: "Vulgäre Sprache"
  };

  const populateResourceModal = (level, text, triggeredCategories = []) => {
    if (!dom.resourceBody) return;

    let categoriesHtml = "";
    if (triggeredCategories && triggeredCategories.length > 0) {
      const translatedCategories = triggeredCategories
        .map(cat => categoryTranslations[cat] || cat)
        .join(", ");

      categoriesHtml = `<p><strong>Erkannte Kategorien:</strong> ${translatedCategories}</p>`;
    }

    dom.resourceBody.innerHTML = `
    <p>${explanations[level] || ""}</p>
    ${categoriesHtml}
    <p><strong>Kommentar:</strong> "${escapeHtml(text)}"</p>
    <ul>
      <li><a href="https://hateaid.org/" target="_blank">HateAid</a></li>
      <li><a href="https://www.bpb.de/" target="_blank">bpb</a></li>
      <li><a href="https://www.amnesty.de/" target="_blank">Amnesty</a></li>
    </ul>
  `;
  };

  // ===============================
  // LOCK LOGIC
  // ===============================
  const checkForLock = () => {
    if (strikeCount < MAX_STRIKES || isLocked) return;

    isLocked = true;
    toggleModal(dom.lockOverlay, true);
    playSound(sounds.locked);

    document.querySelectorAll(".comment-input, .send-btn").forEach(el => el.disabled = true);

    if (dom.shareMessageInput) {
      dom.shareMessageInput.disabled = true;
      dom.shareMessageInput.placeholder = "Konto gesperrt (Demo)";
    }

    if (dom.sendShareBtn) {
      dom.sendShareBtn.disabled = true;
      dom.sendShareBtn.textContent = "Gesperrt";
    }
  };

  // ===============================
  // AI MODERATION (ANGEPASST)
  // ===============================
  const moderateWithAI = async text => {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 6000);

      const res = await fetch(MODERATION_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });

      if (!res.ok) throw new Error("AI request failed");

      const data = await res.json();
      const result = data.results?.[0];

      console.groupCollapsed("KI Moderationsergebnis");
      console.log("Eingabe:", text);
      console.log("Kategorien:", result?.categories);
      console.log("Flags:", result?.flagged);
      console.groupEnd();

      if (!result) return { level: "none" };

      const c = result.categories;

      // WICHTIG: Triggerte Kategorien speichern
      const triggeredCategories = Object.keys(c).filter(key => c[key]);

      if (c.violence || c.threat || c.self_harm) {
        return { level: "strong", raw: result, triggeredCategories };
      }
      if (c.harassment || c.harassment_threatening || c.hate || c.hate_threatening) {
        return { level: "medium", raw: result, triggeredCategories };
      }
      if (c.sexual || c.profanity) {
        return { level: "soft", raw: result, triggeredCategories };
      }

      return { level: "none", raw: result, triggeredCategories };

    } catch (e) {
      console.warn("AI moderation unavailable, fallback active");
      return { level: "fallback" };
    }
  };

  // ===============================
  // MODERATION HANDLER (FIXES)
  // ===============================
  const handleModeration = async (raw, text, button, input, alertBox, section, comments) => {
    button.disabled = true;
    button.textContent = "Prüfe…";

    const aiResult = await moderateWithAI(raw);

    button.disabled = false;
    button.textContent = "Senden";

    // AI Moderation - STRONG
    if (aiResult.level === "strong") {
      playSound(sounds.block); // ✅ Sound hinzugefügt
      strikeCount++;
      updateStrikeDisplay();
      animate(input, animations.shake);
      showAlertInBox(
        alertBox,
        "Stopp! Gewaltvolle Sprache (KI erkannt).",
        true,
        section,
        raw,
        60,
        "strong",
        aiResult.triggeredCategories // ✅ Kategorien übergeben
      );
      disableTemporarily(button, input, TIMEOUT_DURATIONS.strong);
      checkForLock();
      input.value = ""; // ✅ Input leeren
      return true;
    }

    // AI Moderation - MEDIUM
    if (aiResult.level === "medium") {
      strikeCount++;
      playSound(sounds.block);
      updateStrikeDisplay();
      showAlertInBox(
        alertBox,
        "Bitte respektvoll bleiben (KI erkannt).",
        true,
        section,
        raw,
        20,
        "medium",
        aiResult.triggeredCategories // ✅ Kategorien übergeben
      );
      disableTemporarily(button, input, TIMEOUT_DURATIONS.medium);
      checkForLock();
      input.value = "";
      return true;
    }

    // AI Moderation - SOFT
    if (aiResult.level === "soft") {
      playSound(sounds.block);
      showAlertInBox(
        alertBox,
        "Willst du das wirklich so sagen?",
        true,
        section,
        raw,
        0,
        "soft",
        aiResult.triggeredCategories // ✅ Kategorien übergeben
      );
      disableTemporarily(button, input, TIMEOUT_DURATIONS.soft);
      return true;
    }

    // Fallback to local wordlists
    if (matchesAny(STRONG_WORDS, text)) {
      strikeCount++;
      updateStrikeDisplay();
      animate(input, animations.shake);
      showAlertInBox(alertBox, "Stopp! Gewaltvolle Sprache.", true, section, raw, 60, "strong");
      disableTemporarily(button, input, TIMEOUT_DURATIONS.strong);
      checkForLock();
      input.value = ""; // ✅ Auch hier leeren
      return true;
    }

    if (matchesAny(MEDIUM_WORDS, text)) {
      strikeCount++;
      updateStrikeDisplay();
      showAlertInBox(alertBox, "Bitte respektvoll bleiben.", true, section, raw, 20, "medium");
      disableTemporarily(button, input, TIMEOUT_DURATIONS.medium);
      checkForLock();
      input.value = ""; // ✅ Auch hier leeren
      return true;
    }

    if (matchesAny(HATE_WORDS, text)) {
      showAlertInBox(alertBox, "Willst du das wirklich so sagen?", true, section, raw, 0, "soft");
      disableTemporarily(button, input, TIMEOUT_DURATIONS.soft);
      return true;
    }

    return false;
  };

  // ===============================
  // SEND HANDLER
  // ===============================
  const handleSendClick = async button => {
    const post = button.closest(".post");
    if (!post) return;

    const section = post.querySelector(".comment-section");
    const input = section.querySelector(".comment-input");
    const alertBox = section.querySelector(".alert");
    const comments = section.querySelector(".comments");

    const raw = input.value.trim();
    const text = raw.toLowerCase();

    if (!raw) return;

    if (isLocked) {
      animate(input, animations.shake);
      showAlertInBox(alertBox, "Dein Konto ist gesperrt.", false);
      return;
    }

    const blocked = await handleModeration(raw, text, button, input, alertBox, section, comments);
    if (blocked) return;

    // Post comment
    const p = document.createElement("p");
    p.innerHTML = `<strong>Du:</strong> ${escapeHtml(raw)}`;
    comments.appendChild(p);
    animate(p, animations.fadeInUp, 240);
    input.value = "";
  };

  // ===============================
  // LIKE BUTTONS
  // ===============================
  document.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const icon = btn.querySelector("i");
      const post = btn.closest(".post");
      const numEl = post?.querySelector(".likes-number");

      let isLiked = false;

      if (icon) {
        if (icon.classList.contains("fa-regular")) {
          icon.classList.remove("fa-regular");
          icon.classList.add("fa-solid", "liked");
          isLiked = true;
        } else {
          icon.classList.remove("fa-solid", "liked");
          icon.classList.add("fa-regular");
        }
      } else {
        btn.classList.toggle("liked");
        isLiked = btn.classList.contains("liked");
      }

      animate(btn, animations.pulse, 260);

      if (numEl) {
        let val = parseInt(numEl.textContent || "0", 10);
        numEl.textContent = isLiked ? val + 1 : Math.max(0, val - 1);
      }
    });
  });

  // ===============================
  // COMMENT BUTTONS
  // ===============================
  document.querySelectorAll(".comment-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const post = btn.closest(".post");
      const commentSection = post.querySelector(".comment-section");
      commentSection.classList.toggle("hidden");

      if (!commentSection.classList.contains("hidden")) {
        commentSection.querySelector(".comment-input").focus();
      }
    });
  });

  // ===============================
  // SEND BUTTONS
  // ===============================
  document.querySelectorAll(".send-btn")
    .forEach(btn => btn.addEventListener("click", () => handleSendClick(btn)));

  // ===============================
  // MODAL CONTROLS
  // ===============================
  dom.closeResourceBtn?.addEventListener("click", () => toggleModal(dom.resourceModal, false));

  dom.resetStrikesBtn?.addEventListener("click", () => {
    location.reload();
  });

  // ===============================
  // SHARE OVERLAY
  // ===============================
  let selectedShareUser = null;

  document.querySelectorAll(".share-user").forEach(user => {
    user.addEventListener("click", () => {
      document.querySelectorAll(".share-user").forEach(u => u.classList.remove("selected"));
      user.classList.add("selected");
      selectedShareUser = user.dataset.user;
    });
  });

  document.querySelectorAll(".share-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleModal(dom.shareOverlay, true);
      dom.shareMessageInput.value = "";
      dom.shareAlert.style.display = "none";
      selectedShareUser = null;
      document.querySelectorAll(".share-user").forEach(u => u.classList.remove("selected"));
      dom.shareMessageInput.focus();
    });
  });

  dom.closeShareBtn?.addEventListener("click", () => toggleModal(dom.shareOverlay, false));

  dom.shareOverlay?.addEventListener("click", e => {
    if (e.target === dom.shareOverlay) toggleModal(dom.shareOverlay, false);
  });

  dom.sendShareBtn?.addEventListener("click", async () => {
    const raw = dom.shareMessageInput.value.trim();

    if (!raw) {
      showAlertInBox(dom.shareAlert, "Bitte gib eine Nachricht ein.", false);
      dom.shareAlert.style.display = "block";
      return;
    }

    if (!selectedShareUser) {
      showAlertInBox(dom.shareAlert, "Bitte wähle einen Empfänger aus.", false);
      dom.shareAlert.style.display = "block";
      return;
    }

    const text = raw.toLowerCase();
    const blocked = await handleModeration(raw, text, dom.sendShareBtn, dom.shareMessageInput, dom.shareAlert, null, null);

    if (blocked) {
      dom.shareAlert.style.display = "block";
      return;
    }

    showAlertInBox(dom.shareAlert, `Nachricht an @${selectedShareUser} gesendet ✔`, false);
    dom.shareMessageInput.value = "";

    setTimeout(() => {
      toggleModal(dom.shareOverlay, false);
      dom.shareAlert.style.display = "none";
    }, 1200);
  });

  updateStrikeDisplay();
});