document.querySelectorAll(".send-btn").forEach(button => {
  button.addEventListener("click", () => {
    const section = button.closest(".comment-section");
    const input = section.querySelector(".comment-input");
    const alertBox = section.querySelector(".alert");
    const comment = input.value.trim().toLowerCase();

    const hateWords = ["dumm", "idiot", "hass", "behindert", "blöd"];
    const mediumWords = ["nervig", "scheiße", "freak", "abschaum"];
    const strongWords = ["töten", "hasse dich", "bitch", "hurensohn", "fick dich"];

    if (strongWords.some(w => comment.includes(w))) {
      showAlert(alertBox, "strong", "Stopp! Diese Sprache verletzt. Schreibpause 60s.", input, 60);
    } else if (mediumWords.some(w => comment.includes(w))) {
      showAlert(alertBox, "medium", "Atme kurz durch. Schreibpause 20s.", input, 20);
    } else if (hateWords.some(w => comment.includes(w))) {
      showAlert(alertBox, "soft", "Bist du sicher, dass du das so sagen willst?");
    } else if (comment !== "") {
      section.querySelector(".comments").innerHTML += `<p><strong>Du:</strong> ${input.value}</p>`;
      input.value = "";
    }
  });
});

function showAlert(box, level, msg, input = null, seconds = 0) {
  box.className = "alert " + level;
  box.innerHTML = msg;
  box.style.display = "block";

  if (seconds > 0 && input) {
    input.disabled = true;
    let remaining = seconds;
    const countdown = document.createElement("div");
    countdown.className = "countdown";
    box.appendChild(countdown);

    const interval = setInterval(() => {
      remaining--;
      countdown.textContent = `Noch ${remaining}s...`;
      if (remaining <= 0) {
        clearInterval(interval);
        box.style.display = "none";
        input.disabled = false;
      }
    }, 1000);
  }
}   
