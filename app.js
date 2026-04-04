const storageKey = "magaluf-shortlist";

const ui = {
  searchInput: document.querySelector("#searchInput"),
  categoryFilters: document.querySelector("#categoryFilters"),
  cocktailGrid: document.querySelector("#cocktailGrid"),
  resultsMeta: document.querySelector("#resultsMeta"),
  shortlist: document.querySelector(".shortlist"),
  shortlistBody: document.querySelector("#shortlistBody"),
  toggleShortlistMobile: document.querySelector("#toggleShortlistMobile"),
  shortlistContent: document.querySelector("#shortlistContent"),
  clearShortlist: document.querySelector("#clearShortlist"),
  cardTemplate: document.querySelector("#cocktailCardTemplate")
};

const state = {
  cocktails: [],
  activeCategory: "Alle",
  searchText: "",
  mobileShortlistExpanded: false,
  shortlist: new Set(loadShortlistFromStorage())
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
      category: "Andet"
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

    item.category = detectCategory(item);
    drinks.push(item);
  }

  return drinks;
}

function extractInlineField(line, key) {
  const regex = new RegExp(`${key}\\s*:\\s*([^\\.]+)`, "i");
  const match = line.match(regex);
  return match ? match[1].trim() : "";
}

function detectCategory(cocktail) {
  const text = `${cocktail.name} ${cocktail.ingredients}`.toLowerCase();

  if (text.includes("vodka")) return "Vodka";
  if (text.includes("gin")) return "Gin";
  if (text.includes("rom") || text.includes("cacha") || text.includes("cuba")) return "Rom";
  if (text.includes("bourbon") || text.includes("whiskey") || text.includes("rye") || text.includes("jack daniels")) return "Whiskey";
  if (text.includes("tequila")) return "Tequila";
  if (text.includes("cognac") || text.includes("amaretto")) return "Cognac/Likor";
  if (text.includes("aperol") || text.includes("campari") || text.includes("vermouth")) return "Aperitif";
  return "Andet";
}

function getFilteredCocktails() {
  const filtered = state.cocktails.filter((item) => {
    const categoryMatch = state.activeCategory === "Alle" || item.category === state.activeCategory;
    if (!categoryMatch) return false;

    if (!state.searchText) return true;

    const blob = `${item.name} ${item.glass} ${item.ice} ${item.method} ${item.garnish} ${item.ingredients}`.toLowerCase();
    return blob.includes(state.searchText);
  });

  return sortCocktailsByName(filtered);
}

function renderCategoryFilters() {
  const categories = ["Alle", ...new Set(state.cocktails.map((item) => item.category))];
  ui.categoryFilters.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip ${state.activeCategory === category ? "active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      state.activeCategory = category;
      renderCategoryFilters();
      renderCocktails();
    });
    ui.categoryFilters.appendChild(button);
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
