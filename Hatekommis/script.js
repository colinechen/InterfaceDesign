const hateWords = {
  soft: ["dumm", "blöd", "scheiß", "blöd"],
  medium: ["idiot", "freak", "abschaum"],
  strong: ["hasse", "verreck", "töte", "fick dich", "bitch", "hurensohn"]
};

const commentBox = document.getElementById("comment");
const alertBox = document.getElementById("alert");

let isLocked = false;
let countdownTimer = null;

// Eingabe prüfen
commentBox.addEventListener("input", () => {
  if (isLocked) return;

  const text = commentBox.value.toLowerCase();
  let level = null;

  for (const word of hateWords.strong) {
    if (text.includes(word)) level = "strong";
  }
  for (const word of hateWords.medium) {
    if (text.includes(word)) level = level || "medium";
  }
  for (const word of hateWords.soft) {
    if (text.includes(word)) level = level || "soft";
  }

  alertBox.className = "alert";
  document.body.style.background = "#f7f7f7";
  commentBox.style.borderColor = "#ccc";

  if (level === "soft") {
    showSoftAlert();
  } else if (level === "medium") {
    showMediumAlert();
  } else if (level === "strong") {
    showStrongAlert();
  } else {
    hideAlert();
  }
});

function showSoftAlert() {
  alertBox.textContent = "Willst du das wirklich so sagen?";
  alertBox.classList.add("show", "soft");
  commentBox.style.borderColor = "#f39c12";
}

function showMediumAlert() {
  startLock(20, "medium", "Atme kurz durch… Schreibpause: ");
}

function showStrongAlert() {
  startLock(60, "strong", "Diese Sprache verletzt – Schreibpause: ");
}

function startLock(seconds, level, message) {
  isLocked = true;
  commentBox.disabled = true;
  let remaining = seconds;

  updateCountdown(message, remaining, level);

  countdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      unlockField(level);
    } else {
      updateCountdown(message, remaining, level);
    }
  }, 1000);
}

function updateCountdown(message, remaining, level) {
  alertBox.textContent = `${message}${remaining}s`;
  alertBox.classList.add("show", level);
  commentBox.style.borderColor = level === "medium" ? "#e74c3c" : "#fff";
  if (level === "strong") document.body.style.background = "#e74c3c";
}

function unlockField(level) {
  isLocked = false;
  commentBox.disabled = false;
  clearInterval(countdownTimer);

  if (level === "strong") {
    commentBox.value = "";
    document.body.style.background = "#f7f7f7";
  }
  commentBox.style.borderColor = "#ccc";
  alertBox.classList.remove("show", "medium", "strong");
  alertBox.textContent = "";
}

function hideAlert() {
  alertBox.classList.remove("show");
}
