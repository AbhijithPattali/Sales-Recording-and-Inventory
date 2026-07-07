//inventory form input, autofill, validation, submit.

import { dom } from "./dom.js";
import { MAX_SUGGESTIONS } from "./config.js";
import {
  saveInventoryDraft,
  restoreInventoryDraft,
  clearInventoryDraft,
} from "./storage.js";
import { fetchInventoryData, postInventory } from "./api.js";
import { showAlert } from "./ui.js";
import {
  renderInventoryReportTable,
  renderInventoryReportError,
} from "./inventory-report.js";

let inventoryData = [];
let inventoryItemNames = [];
let inventoryByItemName = new Map();
let inventoryLoadPromise = null;
let hasLoadedInventoryOnce = false;

function buildInventoryIndexes(data) {
  inventoryData = Array.isArray(data) ? data : [];
  inventoryByItemName = new Map();

  const uniqueItemNames = new Set();

  inventoryData.forEach((item) => {
    const itemName = String(item["Item Name"] || "").trim();
    if (!itemName) {
      return;
    }

    uniqueItemNames.add(itemName);

    const normalizedItemName = itemName.toLowerCase();
    if (!inventoryByItemName.has(normalizedItemName)) {
      inventoryByItemName.set(normalizedItemName, []);
    }

    inventoryByItemName.get(normalizedItemName).push(item);
  });

  inventoryItemNames = [...uniqueItemNames].sort((a, b) => a.localeCompare(b));
}

export function getInventoryData() {
  return inventoryData;
}

export function getInventoryItemNames() {
  return inventoryItemNames;
}

export function isValidInventoryItemName(value) {
  const normalizedValue = String(value).trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return inventoryItemNames.some(
    (name) => name.trim().toLowerCase() === normalizedValue,
  );
}

export function getInventoryMatchesByItemName(itemName) {
  const normalizedItemName = String(itemName).trim().toLowerCase();
  if (!normalizedItemName) {
    return [];
  }

  return inventoryByItemName.get(normalizedItemName) || [];
}

function getInventorySuggestions(query) {
  const normalizedQuery = String(query).trim().toLowerCase();

  if (!normalizedQuery) {
    return inventoryItemNames.slice(0, MAX_SUGGESTIONS);
  }

  return inventoryItemNames
    .filter((name) => name.toLowerCase().includes(normalizedQuery))
    .slice(0, MAX_SUGGESTIONS);
}

function updateInventoryActiveSuggestion() {
  if (!dom.inventoryItemSuggestions) {
    return;
  }

  const options = Array.from(
    dom.inventoryItemSuggestions.querySelectorAll(".item-suggestion"),
  );
  const activeIndex = Number(
    dom.inventoryItemSuggestions.dataset.activeSuggestionIndex ?? -1,
  );

  options.forEach((option, index) => {
    option.classList.toggle("item-suggestion--active", index === activeIndex);
  });

  const activeOption = options[activeIndex];
  if (activeOption) {
    activeOption.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "auto",
    });
  }
}

function renderInventorySuggestions(suggestions) {
  if (!dom.inventoryItemSuggestions) {
    return;
  }

  dom.inventoryItemSuggestions.innerHTML = "";

  if (!suggestions.length) {
    dom.inventoryItemSuggestions.hidden = true;
    dom.inventoryItemSuggestions.dataset.activeSuggestionIndex = "-1";
    return;
  }

  suggestions.forEach((name, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "item-suggestion";
    option.textContent = name;
    option.dataset.value = name;
    option.dataset.index = String(index);
    dom.inventoryItemSuggestions.appendChild(option);
  });

  dom.inventoryItemSuggestions.hidden = false;
  dom.inventoryItemSuggestions.dataset.activeSuggestionIndex = "0";
  updateInventoryActiveSuggestion();
}

function closeInventorySuggestions() {
  if (!dom.inventoryItemSuggestions) {
    return;
  }

  dom.inventoryItemSuggestions.hidden = true;
  dom.inventoryItemSuggestions.innerHTML = "";
  dom.inventoryItemSuggestions.dataset.activeSuggestionIndex = "-1";
}

function syncInventoryFieldsFromItemName() {
  if (
    !dom.inventoryItemNameInput ||
    !dom.inventoryCategoryInput ||
    !dom.inventoryCurrentStockInput
  ) {
    return;
  }

  const itemName = String(dom.inventoryItemNameInput.value).trim();

  if (!itemName) {
    dom.inventoryCategoryInput.value = "";
    dom.inventoryCurrentStockInput.value = "";
    return;
  }

  const matches = getInventoryMatchesByItemName(itemName);

  if (!matches.length) {
    dom.inventoryCategoryInput.value = "";
    dom.inventoryCurrentStockInput.value = "0";
    return;
  }

  const firstMatch = matches[0];
  dom.inventoryCategoryInput.value = String(
    firstMatch["Category"] || "",
  ).trim();
  dom.inventoryCurrentStockInput.value = String(
    firstMatch["Total Stock"] ?? "",
  ).trim();
}

function selectInventorySuggestion(value) {
  if (!dom.inventoryItemNameInput) {
    return;
  }

  dom.inventoryItemNameInput.value = value;
  dom.inventoryItemNameInput.setCustomValidity("");
  closeInventorySuggestions();
  syncInventoryFieldsFromItemName();
  persistInventoryDraft();
}

function collectInventoryDraft() {
  return {
    itemName: dom.inventoryItemNameInput?.value || "",
    category: dom.inventoryCategoryInput?.value || "",
    currentStock: dom.inventoryCurrentStockInput?.value || "",
    quantityAdded: dom.inventoryQuantityAddedInput?.value || "",
    remark: dom.inventoryRemarkInput?.value || "",
    staffName: dom.inventoryStaffNameInput?.value || "",
  };
}

function persistInventoryDraft() {
  saveInventoryDraft(collectInventoryDraft());
}

function restoreInventoryForm() {
  const draft = restoreInventoryDraft();
  if (!draft) {
    return;
  }

  if (dom.inventoryItemNameInput) {
    dom.inventoryItemNameInput.value = draft.itemName || "";
  }

  if (dom.inventoryCategoryInput) {
    dom.inventoryCategoryInput.value = draft.category || "";
  }

  if (dom.inventoryCurrentStockInput) {
    dom.inventoryCurrentStockInput.value = draft.currentStock || "";
  }

  if (dom.inventoryQuantityAddedInput) {
    dom.inventoryQuantityAddedInput.value = draft.quantityAdded || "";
  }

  if (dom.inventoryRemarkInput) {
    dom.inventoryRemarkInput.value = draft.remark || "";
  }

  if (dom.inventoryStaffNameInput) {
    dom.inventoryStaffNameInput.value = draft.staffName || "";
  }

  syncInventoryFieldsFromItemName();
}

function handleInventoryItemInput(event) {
  const suggestions = getInventorySuggestions(event.target.value);
  renderInventorySuggestions(suggestions);
  syncInventoryFieldsFromItemName();
  persistInventoryDraft();
}

function handleInventoryItemClick(event) {
  const suggestionButton = event.target.closest(".item-suggestion");
  if (!suggestionButton) {
    return;
  }

  selectInventorySuggestion(
    suggestionButton.dataset.value || suggestionButton.textContent || "",
  );
}

function handleInventoryItemKeydown(event) {
  if (!dom.inventoryItemSuggestions || dom.inventoryItemSuggestions.hidden) {
    return;
  }

  const options =
    dom.inventoryItemSuggestions.querySelectorAll(".item-suggestion");
  let activeIndex = Number(
    dom.inventoryItemSuggestions.dataset.activeSuggestionIndex ?? 0,
  );

  if (event.key === "ArrowDown") {
    if (!options.length) {
      return;
    }

    event.preventDefault();
    activeIndex = Math.min(activeIndex + 1, options.length - 1);
    dom.inventoryItemSuggestions.dataset.activeSuggestionIndex =
      String(activeIndex);
    updateInventoryActiveSuggestion();
    return;
  }

  if (event.key === "ArrowUp") {
    if (!options.length) {
      return;
    }

    event.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    dom.inventoryItemSuggestions.dataset.activeSuggestionIndex =
      String(activeIndex);
    updateInventoryActiveSuggestion();
    return;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    if (!options.length) {
      return;
    }

    const selectedOption = options[activeIndex] || options[0];
    if (selectedOption) {
      event.preventDefault();
      selectInventorySuggestion(
        selectedOption.dataset.value || selectedOption.textContent || "",
      );
    }
    return;
  }

  if (event.key === "Escape") {
    closeInventorySuggestions();
  }
}

function handleInventoryItemBlur() {
  window.setTimeout(() => {
    closeInventorySuggestions();
  }, 120);

  persistInventoryDraft();
}

function handleInventoryClear() {
  dom.inventoryForm?.reset();

  if (dom.inventoryItemNameInput) {
    dom.inventoryItemNameInput.value = "";
    dom.inventoryItemNameInput.setCustomValidity("");
  }

  if (dom.inventoryCategoryInput) {
    dom.inventoryCategoryInput.value = "";
  }

  if (dom.inventoryCurrentStockInput) {
    dom.inventoryCurrentStockInput.value = "";
  }

  if (dom.inventoryQuantityAddedInput) {
    dom.inventoryQuantityAddedInput.value = "";
  }

  if (dom.inventoryRemarkInput) {
    dom.inventoryRemarkInput.value = "";
  }

  if (dom.inventoryStaffNameInput) {
    dom.inventoryStaffNameInput.value = "";
  }

  closeInventorySuggestions();
  clearInventoryDraft();
}

async function handleInventorySubmit(event) {
  event.preventDefault();

  if (!dom.inventoryForm) {
    return;
  }

  const submitButton = dom.inventoryForm.querySelector('button[type="submit"]');
  const clearButton = dom.clearInventoryBtn;

  if (submitButton?.disabled) {
    return;
  }

  const itemName = String(dom.inventoryItemNameInput?.value || "").trim();
  const category = String(dom.inventoryModelInput?.value || "").trim();
  const quantityAdded = parseFloat(dom.inventoryQuantityAddedInput?.value || 0);
  const remark = String(dom.inventoryRemarkInput?.value || "").trim();
  const staffName = String(dom.inventoryStaffNameInput?.value || "").trim();

  if (!itemName) {
    showAlert("Please enter an item name.");
    dom.inventoryItemNameInput?.focus();
    return;
  }

  if (quantityAdded <= 0) {
    showAlert("Please enter a valid quantity added.");
    dom.inventoryQuantityAddedInput?.focus();
    return;
  }

  if (!staffName) {
    showAlert("Please enter staff name.");
    dom.inventoryStaffNameInput?.focus();
    return;
  }

  const payload = {
    action: "addInventory",
    itemName,
    category,
    quantityAdded,
    remark,
    staffName,
  };

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";
      submitButton.setAttribute("aria-disabled", "true");
    }

    if (clearButton) {
      clearButton.disabled = true;
    }

    document.body.classList.add("is-submitting");

    const result = await postInventory(payload);

    if (!result.success) {
      throw new Error(result.message || "Failed to save inventory.");
    }

    showAlert("Inventory saved successfully.");
    handleInventoryClear();
    await loadInventorySuggestions();
    renderInventoryReportTable();
  } catch (error) {
    console.error("Inventory submit error:", error);
    showAlert(`Failed to save inventory: ${error.message}`);
  } finally {
    document.body.classList.remove("is-submitting");

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Save Inventory Record";
      submitButton.removeAttribute("aria-disabled");
    }

    if (clearButton) {
      clearButton.disabled = false;
    }
  }
}

export async function loadInventorySuggestions(options = {}) {
  const { forceRefresh = false } = options;

  if (inventoryLoadPromise && !forceRefresh) {
    return inventoryLoadPromise;
  }

  if (hasLoadedInventoryOnce && !forceRefresh) {
    syncInventoryFieldsFromItemName();
    renderInventoryReportTable();
    return;
  }

  inventoryLoadPromise = (async () => {
    try {
      const result = await fetchInventoryData();

      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || "Failed to load inventory.");
      }

      buildInventoryIndexes(result.data);
      hasLoadedInventoryOnce = true;
      syncInventoryFieldsFromItemName();
      renderInventoryReportTable();
    } catch (error) {
      console.error("Inventory suggestions load error:", error);
      renderInventoryReportError(error.message);
      throw error;
    } finally {
      inventoryLoadPromise = null;
    }
  })();

  return inventoryLoadPromise;
}

export function initializeInventory() {
  if (!dom.inventoryForm) {
    return;
  }

  restoreInventoryForm();

  dom.inventoryItemNameInput?.addEventListener(
    "input",
    handleInventoryItemInput,
  );
  dom.inventoryItemNameInput?.addEventListener(
    "keydown",
    handleInventoryItemKeydown,
  );
  dom.inventoryItemNameInput?.addEventListener("blur", handleInventoryItemBlur);

  dom.inventoryItemSuggestions?.addEventListener(
    "click",
    handleInventoryItemClick,
  );

  dom.inventoryCategoryInput?.addEventListener("input", persistInventoryDraft);
  dom.inventoryQuantityAddedInput?.addEventListener(
    "input",
    persistInventoryDraft,
  );
  dom.inventoryRemarkInput?.addEventListener("input", persistInventoryDraft);
  dom.inventoryStaffNameInput?.addEventListener("input", persistInventoryDraft);

  dom.inventoryForm.addEventListener("submit", handleInventorySubmit);
  dom.clearInventoryBtn?.addEventListener("click", handleInventoryClear);

  loadInventorySuggestions();
}
