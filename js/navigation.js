//switching between the four forms/islands.

import { dom } from "./dom.js";
import { loadActiveView, saveActiveView } from "./storage.js";
import { loadInventoryReport } from "./inventory-report.js";
import { loadSalesReport } from "./sales-report.js";

function getValidViewNames() {
  return dom.navButtons.map((button) => button.dataset.view).filter(Boolean);
}

function isValidView(viewName) {
  return getValidViewNames().includes(viewName);
}

function getViewFromHash() {
  return window.location.hash.replace("#", "").trim();
}

export function setActiveView(viewName, options = {}) {
  const { updateHash = true, saveState = true } = options;

  if (!isValidView(viewName)) {
    return;
  }

  dom.navButtons.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle("nav-button--active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  dom.appViews.forEach((view) => {
    const isActive = view.id === `${viewName}-view`;
    view.hidden = !isActive;
    view.classList.toggle("app-view--active", isActive);
  });

  if (updateHash && window.location.hash !== `#${viewName}`) {
    window.location.hash = viewName;
  }

  if (saveState) {
    saveActiveView(viewName);
  }

  if (viewName === "inventory-report") {
    loadInventoryReport({ showLoadingState: false });
  }

  if (viewName === "sales-report") {
    loadSalesReport({ showLoadingState: false });
  }
}

function handleNavigation(event) {
  const clickedButton = event.currentTarget;
  const targetView = clickedButton?.dataset?.view;

  if (!targetView) {
    return;
  }

  setActiveView(targetView);
}

function handleHashChange() {
  const hashView = getViewFromHash();

  if (!isValidView(hashView)) {
    return;
  }

  setActiveView(hashView, {
    updateHash: false,
    saveState: true,
  });
}

export function initializeNavigation() {
  dom.navButtons.forEach((button) => {
    button.addEventListener("click", handleNavigation);
  });

  window.addEventListener("hashchange", handleHashChange);

  const hashView = getViewFromHash();
  const storedView = loadActiveView();
  const defaultView = "sales";

  if (isValidView(hashView)) {
    setActiveView(hashView, {
      updateHash: false,
      saveState: true,
    });
    return;
  }

  if (isValidView(storedView)) {
    setActiveView(storedView, {
      updateHash: true,
      saveState: true,
    });
    return;
  }

  setActiveView(defaultView, {
    updateHash: true,
    saveState: true,
  });
}
