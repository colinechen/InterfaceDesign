document.addEventListener("DOMContentLoaded", () => {

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
  const strongWords = [
    "töten", "hasse dich", "bitch", "hurensohn",
    "fick dich", "bring dich um", "versager",
    "nichtsnutz", "kys", "kill yourself"
  ];

  const MODERATION_API = "https://speakkind.lucahemmi007.workers.dev";



  // ===============================
  // STATE
  // ===============================
  let strikeCount = 0;
  let isLocked = false;
  let lockEnd = 0;

  const MEDIUM_THRESHOLD = 10;
  const STRONG_THRESHOLD = 3;

  // ===============================
  // DOM
  // ===============================
  const strikeBadge = document.getElementById("strike-badge");
  const resourceModal = document.getElementById("resource-modal");
  const resourceBody = document.getElementById("resource-body");
  const closeResourceBtn = document.getElementById("close-resource");
  const lockOverlay = document.getElementById("lock-overlay");
  const resetStrikesBtn = document.getElementById("reset-strikes");

  // ===============================
  // STRIKE DISPLAY
  // ===============================
  function updateStrikeDisplay() {
    if (!strikeBadge) return;

    strikeBadge.textContent = `Strikes: ${strikeCount}`;
    strikeBadge.style.display = "inline-block";

    requestAnimationFrame(() => {
      strikeBadge.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.08)" },
          { transform: "scale(1)" }
        ],
        { duration: 380, easing: "ease-out" }
      );
    });
  }

  // ===============================
  // SMALL HELPERS
  // ===============================
  function shake(el) {
    if (!el) return;
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 300, easing: "ease-in-out" }
    );
  }

  function disableTemporarily(sendBtn, input, ms = 2500) {
    sendBtn.disabled = true;
    input.disabled = true;

    setTimeout(() => {
      sendBtn.disabled = false;
      input.disabled = false;
    }, ms);
  }

  // ===============================
  // ALERT UI
  // ===============================
  function showAlertInBox(box, message, addWhy = false, section = null, originalText = "", timeoutSeconds = 0, level = "") {
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
        populateResourceModal(level, originalText);
        toggleModal(resourceModal, true);
      };
      box.appendChild(whyBtn);
    }

    box.animate(
      [
        { opacity: 0, transform: "translateY(-6px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      { duration: 260, easing: "ease-out" }
    );

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
        box.animate(
          [
            { opacity: 1 },
            { opacity: 0 }
          ],
          { duration: 200 }
        );
        setTimeout(() => box.style.display = "none", 200);
      }, 2200);
    }
  }

  // ===============================
  // RESOURCE MODAL
  // ===============================
  function populateResourceModal(level, text) {
    if (!resourceBody) return;

    let explanation = {
      strong: "Gewaltvolle oder extrem beleidigende Sprache kann Menschen ernsthaft schaden.",
      medium: "Abwertende Sprache verschlechtert das Diskussionsklima.",
      soft: "Auch scheinbar harmlose Worte können verletzend wirken."
    }[level] || "";

    resourceBody.innerHTML = `
      <p>${explanation}</p>
      <p><strong>Kommentar:</strong> "${escapeHtml(text)}"</p>
      <ul>
        <li><a href="https://hateaid.org/" target="_blank">HateAid</a></li>
        <li><a href="https://www.bpb.de/" target="_blank">bpb</a></li>
        <li><a href="https://www.amnesty.de/" target="_blank">Amnesty</a></li>
      </ul>
    `;
  }

  function toggleModal(modal, show) {
    if (!modal) return;
    modal.classList.toggle("hidden", !show);
  }

  // ===============================
  // LOCK LOGIC
  // ===============================
  function checkForLock(level) {
    if (
      (level === "strong" && strikeCount >= STRONG_THRESHOLD) ||
      (level === "medium" && strikeCount >= MEDIUM_THRESHOLD)
    ) {
      isLocked = true;
      lockEnd = Date.now() + 8000;

      toggleLockOverlay(true);
      document.querySelectorAll(".comment-input, .send-btn")
        .forEach(el => el.disabled = true);
    }
  }

  function toggleLockOverlay(show) {
    if (!lockOverlay) return;
    lockOverlay.classList.toggle("hidden", !show);
  }

  async function moderateWithAI(text) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 6000);

      const res = await fetch(MODERATION_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error("AI request failed");
      }

      const data = await res.json();
      const result = data.results?.[0];

      console.groupCollapsed("KI Moderationsergebnis");
      console.log("Eingabe:", text);
      console.log("Kategorien:", result.categories);
      console.log("Flags:", result.flagged);
      console.groupEnd();


      if (!result) return { level: "none" };

      const c = result.categories;

      if (c.violence || c.threat || c.self_harm) {
        return { level: "strong", raw: result };
      }

      if (
        c.harassment ||
        c.harassment_threatening ||
        c.hate ||
        c.hate_threatening
      ) {
        return { level: "medium", raw: result };
      }

      if (c.sexual || c.profanity) {
        return { level: "soft", raw: result };
      }

      return { level: "none", raw: result };

    } catch (e) {
      console.warn("AI moderation unavailable, fallback active");
      return { level: "fallback" };
    }
  }



  // ===============================
  // SEND HANDLER
  // ===============================
  async function handleSendClick(button) {
    const post = button.closest(".post");
    if (!post) return;

    const section = post.querySelector(".comment-section");
    const input = section.querySelector(".comment-input");
    const alertBox = section.querySelector(".alert");
    const comments = section.querySelector(".comments");

    const raw = input.value.trim();
    const text = raw.toLowerCase();
    button.disabled = true;
    button.textContent = "Prüfe…";

    const aiResult = await moderateWithAI(raw);

    button.disabled = false;
    button.textContent = "Senden";

    if (aiResult.level === "strong") {
      strikeCount++;
      updateStrikeDisplay();
      shake(input);
      showAlertInBox(alertBox, "Stopp! Gewaltvolle Sprache (KI erkannt).", true, section, raw, 60, "strong");
      disableTemporarily(button, input, 60000);
      checkForLock("strong");
      input.value = "";
      return;
    }

    if (aiResult.level === "medium") {
      strikeCount++;
      updateStrikeDisplay();
      showAlertInBox(alertBox, "Bitte respektvoll bleiben (KI erkannt).", true, section, raw, 20, "medium");
      disableTemporarily(button, input, 20000);
      checkForLock("medium");
      input.value = "";
      return;
    }

    if (aiResult.level === "soft") {
      showAlertInBox(alertBox, "Willst du das wirklich so sagen?", true, section, raw, 0, "soft");
      disableTemporarily(button, input, 2500);
      return;
    }



    if (!raw) return;

    if (isLocked) {
      shake(input);
      showAlertInBox(alertBox, "Dein Konto ist gesperrt.", false);
      return;
    }

    // STRONG
    if (matchesAny(strongWords, text)) {
      strikeCount++;
      updateStrikeDisplay();
      shake(input);
      showAlertInBox(alertBox, "Stopp! Gewaltvolle Sprache.", true, section, raw, 60, "strong");
      disableTemporarily(button, input, 60000);
      checkForLock("strong");
      return;
    }

    // MEDIUM
    if (matchesAny(mediumWords, text)) {
      strikeCount++;
      updateStrikeDisplay();
      showAlertInBox(alertBox, "Bitte respektvoll bleiben.", true, section, raw, 20, "medium");
      disableTemporarily(button, input, 20000);
      checkForLock("medium");
      return;
    }

    // SOFT
    if (matchesAny(hateWords, text)) {
      showAlertInBox(alertBox, "Willst du das wirklich so sagen?", true, section, raw, 0, "soft");
      disableTemporarily(button, input, 2500);
      return;
    }

    // NEUTRAL COMMENT
    const p = document.createElement("p");
    p.innerHTML = `<strong>Du:</strong> ${escapeHtml(raw)}`;
    comments.appendChild(p);

    p.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      { duration: 240, easing: "ease-out" }
    );

    input.value = "";
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
  // EVENT BINDINGS
  // ===============================
  document.querySelectorAll(".send-btn")
    .forEach(btn => btn.addEventListener("click", () => handleSendClick(btn)));

  document.querySelectorAll(".like-btn")
    .forEach(btn => btn.addEventListener("click", () => {
      btn.classList.toggle("liked");
      btn.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.25)" },
          { transform: "scale(1)" }
        ],
        { duration: 260, easing: "ease-out" }
      );
    }));

  if (closeResourceBtn) {
    closeResourceBtn.onclick = () => toggleModal(resourceModal, false);
  }

  if (resetStrikesBtn) {
    resetStrikesBtn.onclick = () => {
      strikeCount = 0;
      isLocked = false;
      updateStrikeDisplay();
      toggleLockOverlay(false);
      document.querySelectorAll("input, button").forEach(el => el.disabled = false);
    };
  }
  document.querySelectorAll(".comment-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const post = btn.closest(".post");
      const commentSection = post.querySelector(".comment-section");

      // Toggle visibility
      commentSection.classList.toggle("hidden");

      // Fokus direkt ins Inputfeld
      if (!commentSection.classList.contains("hidden")) {
        commentSection.querySelector(".comment-input").focus();
      }
    });
  });


  // ===============================
  // SHARE OVERLAY
  // ===============================
  const shareOverlay = document.getElementById("share-overlay");
  const closeShareBtn = document.getElementById("close-share");
  const sendShareBtn = document.getElementById("send-share");
  const shareMessageInput = document.getElementById("share-message");

  document.querySelectorAll(".share-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleModal(shareOverlay, true);
      shareMessageInput.value = "";
      shareMessageInput.focus();
    });
  });

  if (closeShareBtn) {
    closeShareBtn.addEventListener("click", () => {
      toggleModal(shareOverlay, false);
    });
  }




  updateStrikeDisplay();
});
