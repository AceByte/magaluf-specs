const storageKey = "magaluf-shortlist";

const ui = {
  searchInput: document.querySelector("#searchInput"),
  showAllFiltersBtn: document.querySelector("#showAllFiltersBtn"),
  alcoholMenuBtn: document.querySelector("#alcoholMenuBtn"),
  glassMenuBtn: document.querySelector("#glassMenuBtn"),
  methodMenuBtn: document.querySelector("#methodMenuBtn"),
  alcoholMenu: document.querySelector("#alcoholMenu"),
  glassMenu: document.querySelector("#glassMenu"),
  methodMenu: document.querySelector("#methodMenu"),
  alcoholFilters: document.querySelector("#alcoholFilters"),
  glassFilters: document.querySelector("#glassFilters"),
  methodFilters: document.querySelector("#methodFilters"),
  cocktailGrid: document.querySelector("#cocktailGrid"),
  resultsMeta: document.querySelector("#resultsMeta"),
  shortlist: document.querySelector(".shortlist"),
  shortlistBody: document.querySelector("#shortlistBody"),
  toggleShortlistMobile: document.querySelector("#toggleShortlistMobile"),
  shortlistContent: document.querySelector("#shortlistContent"),
  clearShortlist: document.querySelector("#clearShortlist"),
  cardTemplate: document.querySelector("#cocktailCardTemplate"),
  catalogViewBtn: document.querySelector("#catalogViewBtn"),
  quizViewBtn: document.querySelector("#quizViewBtn"),
  quizView: document.querySelector("#quizView"),
  layout: document.querySelector(".layout"),
  quizStartBtn: document.querySelector("#quizStartBtn"),
  quizRetryBtn: document.querySelector("#quizRetryBtn"),
  quizNextBtn: document.querySelector("#quizNextBtn"),
  quizContent: document.querySelector("#quizContent"),
  quizResults: document.querySelector("#quizResults"),
  quizScore: document.querySelector("#quizScore"),
  quizTotal: document.querySelector("#quizTotal"),
  quizFinalScore: document.querySelector("#quizFinalScore"),
  quizPercentage: document.querySelector("#quizPercentage"),
  quizOptions: document.querySelector("#quizOptions")
};

const state = {
  cocktails: [],
  activeCategory: "Alle",
  searchText: "",
  mobileShortlistExpanded: false,
  shortlist: new Set(loadShortlistFromStorage()),
  quiz: {
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    answered: false,
    selectedAnswer: null
  }
};

const filterMenuDefaults = {
  alcohol: "Alkohol",
  glass: "Glas",
  method: "Metode"
};

init();

async function init() {
  try {
    const raw = await loadSpecsData();
    state.cocktails = parseSpecs(raw);
    renderCategoryFilters();
    renderCocktails();
    renderShortlist();
    wireEvents();
    setupMobileShortlistBehavior();
  } catch (error) {
    ui.cocktailGrid.innerHTML = `<p class="empty-state">Fejl: ${error.message}. Aben siden via en lokal server eller brug embedded specs-data.</p>`;
  }
}

async function loadSpecsData() {
  const embedded = document.querySelector("#embeddedSpecs")?.textContent?.trim();
  if (embedded) {
    return embedded;
  }

  const response = await fetch("specs.txt");
  if (!response.ok) {
    throw new Error("Kunne ikke hente specs.txt");
  }

  return response.text();
}

function wireEvents() {
  ui.searchInput.addEventListener("input", (event) => {
    state.searchText = event.target.value.trim().toLowerCase();
    renderCocktails();
  });

  ui.showAllFiltersBtn.addEventListener("click", () => {
    state.activeCategory = "Alle";
    renderCategoryFilters();
    renderCocktails();
    closeFilterMenus();
  });

  [ui.alcoholMenuBtn, ui.glassMenuBtn, ui.methodMenuBtn].forEach((button) => {
    button.addEventListener("click", () => {
      toggleFilterMenu(button);
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".filter-menu")) {
      closeFilterMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeFilterMenus();
    }
  });

  ui.clearShortlist.addEventListener("click", () => {
    state.shortlist.clear();
    persistShortlist();
    renderCocktails();
    renderShortlist();
  });

  ui.toggleShortlistMobile.addEventListener("click", () => {
    if (!isMobileLayout()) {
      return;
    }

    state.mobileShortlistExpanded = !state.mobileShortlistExpanded;
    syncMobileShortlistState();
  });

  ui.catalogViewBtn.addEventListener("click", () => {
    switchView("catalog");
  });

  ui.quizViewBtn.addEventListener("click", () => {
    switchView("quiz");
  });

  ui.quizStartBtn.addEventListener("click", () => {
    startQuiz();
  });

  ui.quizRetryBtn.addEventListener("click", () => {
    startQuiz();
  });

  ui.quizNextBtn.addEventListener("click", () => {
    nextQuestion();
  });
}

function parseSpecs(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const drinks = [];
  let index = 0;

  while (index < lines.length) {
    const title = lines[index];
    index += 1;

    const item = {
      name: title,
      glass: "",
      ice: "",
      method: "",
      garnish: "",
      ingredients: "",
      categories: []
    };

    while (index < lines.length && lines[index].includes(":")) {
      const line = lines[index];

      if (line.startsWith("Glas:")) {
        item.glass = extractInlineField(line, "Glas");
        item.ice = extractInlineField(line, "Is");
        item.method = extractInlineField(line, "Metode");
      } else if (line.startsWith("Garnish:")) {
        item.garnish = line.replace(/^Garnish:\s*/i, "").trim();
      } else if (line.startsWith("Ingredienser:")) {
        item.ingredients = line.replace(/^Ingredienser:\s*/i, "").trim();
      }

      index += 1;
    }

    item.categories = detectCategories(item);
    drinks.push(item);
  }

  return drinks;
}

function extractInlineField(line, key) {
  const regex = new RegExp(`${key}\\s*:\\s*(.*?)(?=\\s+(?:Glas|Is|Metode)\\s*:|\\.|$)`, "i");
  const match = line.match(regex);
  return match ? match[1].trim() : "";
}

function detectCategories(cocktail) {
  const rawText = `${cocktail.name} ${cocktail.ingredients}`;
  const text = rawText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const has = (pattern) => pattern.test(text);
  const categories = new Set();

  // Spirit-based categories
  if (has(/\bcachaca\b/)) categories.add("Rom");
  if (has(/\bvodka\b/)) categories.add("Vodka");
  if (has(/\bgin\b/)) categories.add("Gin");
  if (has(/\brom\b|\bcuba\b/)) categories.add("Rom");
  if (has(/\bbourbon\b|\bwhiskey\b|\brye\b|\bjack\s+daniels\b/)) categories.add("Whiskey");
  if (has(/\btequila\b/)) categories.add("Tequila");
  if (has(/\bcognac\b|\bamaretto\b/)) categories.add("Cognac/Likor");
  if (has(/\baperol\b|\bcampari\b|\bvermouth\b/)) categories.add("Aperitif");

  // Glass-based categories
  if (cocktail.glass) {
    const glassTypes = cocktail.glass
      .split(/\/|,/)
      .map((g) => g.trim())
      .filter(Boolean);
    glassTypes.forEach((g) => {
      if (g) categories.add(`Glass: ${g}`);
    });
  }

  // Method-based categories
  if (cocktail.method) {
    const methodCategories = detectMethodCategories(cocktail.method);
    methodCategories.forEach((method) => {
      categories.add(`Method: ${method}`);
    });
  }

  return categories.size > 0 ? Array.from(categories).sort() : ["Andet"];
}

function detectMethodCategories(methodText) {
  const normalized = methodText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const matches = new Set();

  if (/\b(shake|shakes|double\s+shake|dobbeltshake)\b/.test(normalized)) {
    matches.add("Shake");
  }

  if (/\b(build|byg)\b/.test(normalized)) {
    matches.add("Byg");
  }

  if (/\bstir\b/.test(normalized)) {
    matches.add("Stir");
  }

  if (/\bblend\b/.test(normalized)) {
    matches.add("Blend");
  }

  if (/\bfloat\b/.test(normalized)) {
    matches.add("Float");
  }

  if (/\bmuddle\b/.test(normalized)) {
    matches.add("Muddle");
  }

  if (/\bchurn\b/.test(normalized)) {
    matches.add("Churn");
  }

  if (/\bfine\s+strain\b/.test(normalized)) {
    matches.add("Fine Strain");
  }

  if (/\bstrain\b/.test(normalized) && !/\bfine\s+strain\b/.test(normalized)) {
    matches.add("Strain");
  }

  if (matches.size > 0) {
    return Array.from(matches);
  }

  const fallback = methodText.trim();
  return fallback ? [fallback] : [];
}

function getFilteredCocktails() {
  const filtered = state.cocktails.filter((item) => {
    const categoryMatch = state.activeCategory === "Alle" || item.categories.includes(state.activeCategory);
    if (!categoryMatch) return false;

    if (!state.searchText) return true;

    const blob = `${item.name} ${item.glass} ${item.ice} ${item.method} ${item.garnish} ${item.ingredients}`.toLowerCase();
    return blob.includes(state.searchText);
  });

  return sortCocktailsByName(filtered);
}

function renderCategoryFilters() {
  const allCategories = new Set(state.cocktails.flatMap((item) => item.categories));
  
  const spirits = [];
  const glasses = [];
  const methods = [];

  allCategories.forEach((cat) => {
    if (cat.startsWith("Glass: ")) {
      glasses.push(cat);
    } else if (cat.startsWith("Method: ")) {
      methods.push(cat);
    } else {
      spirits.push(cat);
    }
  });

  spirits.sort((a, b) => a.localeCompare(b, "da"));
  glasses.sort((a, b) => a.localeCompare(b, "da"));
  methods.sort((a, b) => a.localeCompare(b, "da"));

  ui.showAllFiltersBtn.classList.toggle("active", state.activeCategory === "Alle");
  updateFilterMenuLabels();

  const renderFilterGroup = (container, categories, labelFormatter = (label) => label) => {
    container.innerHTML = "";
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `filter-chip ${state.activeCategory === category ? "active" : ""}`;
      button.textContent = labelFormatter(category);
      button.addEventListener("click", () => {
        state.activeCategory = category;
        renderCategoryFilters();
        renderCocktails();
        closeFilterMenus();
      });
      container.appendChild(button);
    });
  };

  renderFilterGroup(ui.alcoholFilters, spirits);
  renderFilterGroup(ui.glassFilters, glasses, (label) => label.replace(/^Glass:\s*/i, ""));
  renderFilterGroup(ui.methodFilters, methods, (label) => label.replace(/^Method:\s*/i, ""));
}

function updateFilterMenuLabels() {
  const active = state.activeCategory;

  ui.alcoholMenuBtn.textContent = filterMenuDefaults.alcohol;
  ui.glassMenuBtn.textContent = filterMenuDefaults.glass;
  ui.methodMenuBtn.textContent = filterMenuDefaults.method;

  if (active === "Alle") {
    return;
  }

  if (active.startsWith("Glass: ")) {
    ui.glassMenuBtn.textContent = active.replace(/^Glass:\s*/i, "");
    return;
  }

  if (active.startsWith("Method: ")) {
    ui.methodMenuBtn.textContent = active.replace(/^Method:\s*/i, "");
    return;
  }

  ui.alcoholMenuBtn.textContent = active;
}

function toggleFilterMenu(targetButton) {
  const isExpanded = targetButton.getAttribute("aria-expanded") === "true";
  closeFilterMenus();

  if (!isExpanded) {
    targetButton.setAttribute("aria-expanded", "true");
    const menuId = targetButton.getAttribute("aria-controls");
    const menu = document.getElementById(menuId);
    if (menu) {
      menu.hidden = false;
    }
  }
}

function closeFilterMenus() {
  [
    [ui.alcoholMenuBtn, ui.alcoholMenu],
    [ui.glassMenuBtn, ui.glassMenu],
    [ui.methodMenuBtn, ui.methodMenu]
  ].forEach(([button, menu]) => {
    button.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  });
}

function renderCocktails() {
  const filtered = getFilteredCocktails();
  ui.resultsMeta.textContent = `${filtered.length} af ${state.cocktails.length} cocktails`;
  ui.cocktailGrid.innerHTML = "";

  if (!filtered.length) {
    ui.cocktailGrid.innerHTML = '<p class="empty-state">Ingen cocktails matcher sogningen.</p>';
    return;
  }

  filtered.forEach((cocktail) => {
    const card = ui.cardTemplate.content.firstElementChild.cloneNode(true);
    const inShortlist = state.shortlist.has(cocktail.name);

    card.classList.toggle("in-shortlist", inShortlist);
    card.querySelector(".card-hitbox").setAttribute(
      "aria-label",
      `${inShortlist ? "Fjern" : "Tilfoj"} ${cocktail.name} i short list`
    );

    card.querySelector(".cocktail-name").textContent = cocktail.name;
    card.querySelector(".spec-glass").textContent = `Glas: ${cocktail.glass || "Ukendt"}`;
    card.querySelector(".spec-ice").textContent = `Is: ${cocktail.ice || "Ukendt"}`;
    card.querySelector(".spec-method").textContent = `Metode: ${cocktail.method || "Ikke angivet"}`;
    card.querySelector(".spec-garnish").textContent = `Garnish: ${cocktail.garnish || "-"}`;

    const ingredientList = card.querySelector(".spec-ingredients-list");
    toIngredientItems(cocktail.ingredients).forEach((ingredient) => {
      const li = document.createElement("li");
      li.textContent = ingredient;
      ingredientList.appendChild(li);
    });

    card.querySelector(".card-hitbox").addEventListener("click", () => {
      toggleShortlist(cocktail.name);
    });

    ui.cocktailGrid.appendChild(card);
  });
}

function toggleShortlist(name) {
  if (state.shortlist.has(name)) {
    state.shortlist.delete(name);
  } else {
    state.shortlist.add(name);
  }

  persistShortlist();
  renderCocktails();
  renderShortlist();
}

function renderShortlist() {
  const selected = sortCocktailsByName(
    state.cocktails.filter((item) => state.shortlist.has(item.name))
  );
  ui.shortlistContent.innerHTML = "";
  updateShortlistToggleLabel(selected.length);

  if (!selected.length) {
    ui.shortlistContent.innerHTML = '<p class="empty-state">Ingen valgt endnu. Tryk pa cocktails for at bygge din short list.</p>';
    return;
  }

  selected.forEach((cocktail) => {
    const ingredientItems = toIngredientItems(cocktail.ingredients)
      .map((ingredient) => `<li>${ingredient}</li>`)
      .join("");

    const node = document.createElement("article");
    node.className = "short-item";
    node.innerHTML = `
      <h3>${cocktail.name}</h3>
      <p><strong>Glas:</strong> ${cocktail.glass || "-"}</p>
      <p><strong>Is:</strong> ${cocktail.ice || "-"}</p>
      <p><strong>Metode:</strong> ${cocktail.method || "-"}</p>
      <p><strong>Ingredienser:</strong></p>
      <ul class="short-ingredients-list">${ingredientItems}</ul>
      <p><strong>Garnish:</strong> ${cocktail.garnish || "-"}</p>
    `;
    ui.shortlistContent.appendChild(node);
  });
}

function toIngredientItems(rawIngredients) {
  if (!rawIngredients) {
    return ["-"];
  }

  const items = rawIngredients
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return items.length ? items : [rawIngredients.trim()];
}

function loadShortlistFromStorage() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistShortlist() {
  localStorage.setItem(storageKey, JSON.stringify([...state.shortlist]));
}

function sortCocktailsByName(cocktails) {
  return [...cocktails].sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
}

function setupMobileShortlistBehavior() {
  syncMobileShortlistState();

  const mediaQuery = window.matchMedia("(max-width: 920px)");
  const onLayoutChange = () => {
    syncMobileShortlistState();
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onLayoutChange);
  } else {
    mediaQuery.addListener(onLayoutChange);
  }
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 920px)").matches;
}

function syncMobileShortlistState() {
  const expanded = !isMobileLayout() || state.mobileShortlistExpanded;
  ui.shortlist.classList.toggle("mobile-collapsed", !expanded);
  ui.toggleShortlistMobile.setAttribute("aria-expanded", String(expanded));
}

function updateShortlistToggleLabel(selectedCount) {
  ui.toggleShortlistMobile.textContent = selectedCount > 0 ? `Shortlist (${selectedCount})` : "Shortlist";
}

function switchView(view) {
  const isCatalog = view === "catalog";
  ui.layout.classList.toggle("hidden", !isCatalog);
  ui.quizView.classList.toggle("hidden", isCatalog);
  ui.catalogViewBtn.classList.toggle("active", isCatalog);
  ui.quizViewBtn.classList.toggle("active", !isCatalog);
  ui.catalogViewBtn.setAttribute("aria-pressed", isCatalog);
  ui.quizViewBtn.setAttribute("aria-pressed", !isCatalog);
}

function startQuiz() {
  state.quiz.questions = generateQuestions();
  state.quiz.currentQuestionIndex = 0;
  state.quiz.score = 0;
  state.quiz.answered = false;
  state.quiz.selectedAnswer = null;

  ui.quizResults.classList.add("hidden");
  ui.quizContent.style.display = "block";
  ui.quizStartBtn.style.display = "none";
  ui.quizRetryBtn.style.display = "none";
  ui.quizNextBtn.style.display = "none";

  renderQuestion();
}

function generateQuestions() {
  const shuffled = [...state.cocktails].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(10, shuffled.length)).map((cocktail) => ({
    cocktail: cocktail,
    options: getRandomOptions(cocktail)
  }));
}

function getRandomOptions(correctCocktail) {
  const allNames = state.cocktails.map((c) => c.name);
  const wrongNames = allNames.filter((name) => name !== correctCocktail.name).sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [correctCocktail.name, ...wrongNames].sort(() => Math.random() - 0.5);
  return options;
}

function renderQuestion() {
  if (state.quiz.currentQuestionIndex >= state.quiz.questions.length) {
    endQuiz();
    return;
  }

  const question = state.quiz.questions[state.quiz.currentQuestionIndex];
  const cocktail = question.cocktail;

  ui.quizScore.textContent = state.quiz.score;
  ui.quizTotal.textContent = state.quiz.questions.length;

  document.querySelector("#quizGlass").textContent = `Glas: ${cocktail.glass || "Ukendt"}`;
  document.querySelector("#quizIce").textContent = `Is: ${cocktail.ice || "Ukendt"}`;
  document.querySelector("#quizMethod").textContent = `Metode: ${cocktail.method || "Ikke angivet"}`;
  document.querySelector("#quizGarnish").textContent = `Garnish: ${cocktail.garnish || "-"}`;

  const ingredientList = document.querySelector("#quizIngredients");
  ingredientList.innerHTML = "";
  toIngredientItems(cocktail.ingredients).forEach((ingredient) => {
    const li = document.createElement("li");
    li.textContent = ingredient;
    ingredientList.appendChild(li);
  });

  ui.quizOptions.innerHTML = "";
  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "quiz-option";
    button.type = "button";
    button.textContent = option;
    button.disabled = state.quiz.answered;

    button.addEventListener("click", () => {
      answerQuestion(option, cocktail.name);
    });

    ui.quizOptions.appendChild(button);
  });

  ui.quizNextBtn.style.display = "none";
  ui.quizRetryBtn.style.display = "none";
}

function answerQuestion(selected, correct) {
  if (state.quiz.answered) return;

  state.quiz.answered = true;
  state.quiz.selectedAnswer = selected;
  const isCorrect = selected === correct;

  if (isCorrect) {
    state.quiz.score += 1;
  }

  const options = document.querySelectorAll(".quiz-option");
  options.forEach((btn) => {
    btn.disabled = true;
    if (btn.textContent === correct) {
      btn.classList.add("correct");
    } else if (btn.textContent === selected && !isCorrect) {
      btn.classList.add("incorrect");
    }
  });

  ui.quizScore.textContent = state.quiz.score;

  if (state.quiz.currentQuestionIndex < state.quiz.questions.length - 1) {
    ui.quizNextBtn.style.display = "inline-block";
  } else {
    endQuiz();
  }
}

function nextQuestion() {
  state.quiz.currentQuestionIndex += 1;
  state.quiz.answered = false;
  state.quiz.selectedAnswer = null;
  renderQuestion();
}

function endQuiz() {
  ui.quizContent.style.display = "none";
  ui.quizResults.classList.remove("hidden");
  ui.quizNextBtn.style.display = "none";
  ui.quizRetryBtn.style.display = "inline-block";

  const total = state.quiz.questions.length;
  const percentage = Math.round((state.quiz.score / total) * 100);

  ui.quizFinalScore.textContent = `You scored ${state.quiz.score} out of ${total}`;
  ui.quizPercentage.textContent = `That's ${percentage}%`;
}
