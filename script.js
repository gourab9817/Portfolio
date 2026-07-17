const body = document.body;
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".nav-links a");
const commandOpeners = document.querySelectorAll("[data-command-open]");
const commandMenu = document.querySelector("[data-command-menu]");
const commandInput = document.querySelector("[data-command-input]");
const commandLinks = document.querySelectorAll(".command-list a");

const currentPage = body.dataset.page;
document.querySelectorAll(`[data-nav="${currentPage}"]`).forEach((link) => {
  link.classList.add("active");
});

navToggle?.addEventListener("click", () => {
  const isOpen = body.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    body.classList.remove("nav-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

function openCommandMenu() {
  if (!commandMenu) return;
  commandMenu.hidden = false;
  body.classList.add("command-open");
  commandInput?.focus();
}

function closeCommandMenu() {
  if (!commandMenu) return;
  commandMenu.hidden = true;
  body.classList.remove("command-open");
  if (commandInput) commandInput.value = "";
  commandLinks.forEach((link) => {
    link.hidden = false;
  });
}

commandOpeners.forEach((button) => button.addEventListener("click", openCommandMenu));

commandLinks.forEach((link) => {
  link.addEventListener("click", () => {
    closeCommandMenu();
  });
});

commandMenu?.addEventListener("click", (event) => {
  if (event.target === commandMenu) closeCommandMenu();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandMenu();
  }
  if (event.key === "Escape") closeCommandMenu();
});

commandInput?.addEventListener("input", () => {
  const value = commandInput.value.trim().toLowerCase();
  commandLinks.forEach((link) => {
    link.hidden = value.length > 0 && !link.textContent.toLowerCase().includes(value);
  });
});

const glossTerms = document.querySelectorAll(".gloss-term");
glossTerms.forEach((term) => {
  term.addEventListener("click", (event) => {
    event.stopPropagation();
    const wasActive = term.classList.contains("is-active");
    glossTerms.forEach((other) => other.classList.remove("is-active"));
    if (!wasActive) term.classList.add("is-active");
  });
});

document.addEventListener("click", () => {
  glossTerms.forEach((term) => term.classList.remove("is-active"));
});
