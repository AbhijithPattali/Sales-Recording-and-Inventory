// sales form rows, totals, validation, submit.

import { dom } from "./dom.js";
import {
  VAT_RATE,
  CURRENCY_DECIMALS,
  QUANTITY_MINIMUM,
  MAX_SUGGESTIONS,
  TRASH_ICON_PATH,
} from "./config.js";
import {
  saveSalesDraft,
  restoreSalesDraft,
  clearSalesDraft,
} from "./storage.js";
import { postSale } from "./api.js";
import { showAlert, enhanceClearableInput } from "./ui.js";
import {
  getInventoryItemNames,
  isValidInventoryItemName,
} from "./inventory.js";

import { loadSalesReport } from "./sales-report.js";
import { loadInventoryReport } from "./inventory-report.js";

function setDefaultSaleDateTime() {
  if (!dom.dateTimeInput || dom.dateTimeInput.value) {
    return;
  }

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDateTime = new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  dom.dateTimeInput.value = localDateTime;
}

function createItemRow() {
  const itemRow = document.createElement("div");
  itemRow.className = "item-row";

  itemRow.innerHTML = `
    <div class="item-autocomplete">
      <input
        type="text"
        name="item"
        class="item-input"
        placeholder="Item"
        autocomplete="off"
        required
      />
      <div class="item-suggestions" hidden></div>
    </div>

    <input
      type="number"
      name="quantity"
      class="quantity-input"
      placeholder="Qty"
      value="${QUANTITY_MINIMUM}"
      min="${QUANTITY_MINIMUM}"
      required
    />

    <input
      type="number"
      name="price"
      class="price-input"
      placeholder="Price"
      min="0"
      step="0.001"
      required
    />

    <button type="button" class="remove-btn" aria-label="Remove item">
      <img
        src="${TRASH_ICON_PATH}"
        alt=""
        class="trash-icon"
        width="20"
        height="20"
      />
    </button>
  `;

  const itemInput = itemRow.querySelector(".item-input");
  enhanceClearableInput(itemInput);

  return itemRow;
}

function updateRemoveButtons() {
  const rows = dom.itemsContainer?.querySelectorAll(".item-row") || [];
  const isOnlyOneRow = rows.length === 1;

  rows.forEach((row) => {
    const removeButton = row.querySelector(".remove-btn");
    if (removeButton) {
      removeButton.disabled = isOnlyOneRow;
    }
  });
}

function rowHasData(row) {
  const inputs = row.querySelectorAll("input");
  return Array.from(inputs).some((input) => String(input.value).trim() !== "");
}

function isTrackedRowInput(element) {
  return (
    element.matches(".item-input") ||
    element.matches(".quantity-input") ||
    element.matches(".price-input")
  );
}

function getSuggestions(query) {
  const itemNames = getInventoryItemNames();
  const normalizedQuery = String(query).trim().toLowerCase();

  if (!normalizedQuery) {
    return itemNames.slice(0, MAX_SUGGESTIONS);
  }

  return itemNames
    .filter((name) => name.toLowerCase().includes(normalizedQuery))
    .slice(0, MAX_SUGGESTIONS);
}

function updateActiveSuggestion(row) {
  const suggestionsBox = row.querySelector(".item-suggestions");
  if (!suggestionsBox) {
    return;
  }

  const options = Array.from(
    suggestionsBox.querySelectorAll(".item-suggestion"),
  );
  const activeIndex = Number(row.dataset.activeSuggestionIndex ?? -1);

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

function renderSuggestions(row, suggestions) {
  const suggestionsBox = row.querySelector(".item-suggestions");
  if (!suggestionsBox) {
    return;
  }

  suggestionsBox.innerHTML = "";

  if (!suggestions.length) {
    suggestionsBox.hidden = true;
    row.dataset.activeSuggestionIndex = "-1";
    return;
  }

  suggestions.forEach((name, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "item-suggestion";
    option.textContent = name;
    option.dataset.value = name;
    option.dataset.index = String(index);
    suggestionsBox.appendChild(option);
  });

  suggestionsBox.hidden = false;
  row.dataset.activeSuggestionIndex = "0";
  updateActiveSuggestion(row);
}

function closeSuggestions(row) {
  const suggestionsBox = row.querySelector(".item-suggestions");
  if (!suggestionsBox) {
    return;
  }

  suggestionsBox.hidden = true;
  suggestionsBox.innerHTML = "";
  row.dataset.activeSuggestionIndex = "-1";
}

function validateItemSelection(row) {
  const itemInput = row.querySelector(".item-input");
  if (!itemInput) {
    return;
  }

  const value = itemInput.value.trim();

  if (!value) {
    itemInput.setCustomValidity("Please select an item.");
    return;
  }

  if (!isValidInventoryItemName(value)) {
    itemInput.setCustomValidity(
      "Please choose an item from the inventory list.",
    );
    return;
  }

  itemInput.setCustomValidity("");
}

function validateRowDependencies(row) {
  const itemInput = row.querySelector(".item-input");
  const quantityInput = row.querySelector(".quantity-input");
  const priceInput = row.querySelector(".price-input");

  const hasPrice = String(priceInput?.value || "").trim() !== "";
  const hasItem = String(itemInput?.value || "").trim() !== "";

  if (quantityInput) {
    quantityInput.setCustomValidity("");
  }

  if (hasPrice && quantityInput && String(quantityInput.value).trim() === "") {
    quantityInput.value = QUANTITY_MINIMUM;
  }

  if (hasPrice && !hasItem && itemInput) {
    itemInput.setCustomValidity("Please fill out this field.");
    return;
  }

  validateItemSelection(row);
}

function selectSuggestion(row, value) {
  const itemInput = row.querySelector(".item-input");
  if (!itemInput) {
    return;
  }

  itemInput.value = value;
  itemInput.setCustomValidity("");
  closeSuggestions(row);
  validateItemSelection(row);
  validateRowDependencies(row);
  updateTotals();
  persistSalesDraft();
}

function selectActiveSuggestion(row) {
  const suggestionsBox = row.querySelector(".item-suggestions");
  if (!suggestionsBox || suggestionsBox.hidden) {
    return false;
  }

  const options = Array.from(
    suggestionsBox.querySelectorAll(".item-suggestion"),
  );
  if (!options.length) {
    return false;
  }

  const activeIndex = Number(row.dataset.activeSuggestionIndex ?? 0);
  const selectedOption = options[activeIndex] || options[0];

  selectSuggestion(
    row,
    selectedOption.dataset.value || selectedOption.textContent || "",
  );
  return true;
}

function normalizeQuantity(row) {
  const quantityInput = row.querySelector(".quantity-input");
  if (!quantityInput) {
    return;
  }

  const quantity = parseFloat(quantityInput.value);

  if (
    String(quantityInput.value).trim() === "" ||
    Number.isNaN(quantity) ||
    quantity < QUANTITY_MINIMUM
  ) {
    quantityInput.value = String(QUANTITY_MINIMUM);
  }
}

function showDeferredItemValidation(row) {
  const itemInput = row.querySelector(".item-input");
  const priceInput = row.querySelector(".price-input");

  if (!itemInput || !priceInput) {
    return;
  }

  if (String(priceInput.value).trim() !== "") {
    itemInput.reportValidity();
  }
}

function updateTotals() {
  const rows = dom.itemsContainer?.querySelectorAll(".item-row") || [];
  let baseTotal = 0;

  rows.forEach((row) => {
    const quantity = parseFloat(
      row.querySelector(".quantity-input")?.value || 0,
    );
    const price = parseFloat(row.querySelector(".price-input")?.value || 0);
    baseTotal += quantity * price;
  });

  const total = dom.vatCheckbox?.checked
    ? baseTotal * (1 + VAT_RATE)
    : baseTotal;

  if (dom.totalPriceInput) {
    dom.totalPriceInput.value = total.toFixed(CURRENCY_DECIMALS);
  }
}

function collectSalesDraft() {
  const rows = dom.itemsContainer?.querySelectorAll(".item-row") || [];

  return {
    customerName: dom.customerNameInput?.value || "",
    saleDateTime: dom.dateTimeInput?.value || "",
    vatEnabled: Boolean(dom.vatCheckbox?.checked),
    paidEnabled: Boolean(dom.paidCheckbox?.checked),
    items: Array.from(rows).map((row) => ({
      item: row.querySelector(".item-input")?.value || "",
      quantity: row.querySelector(".quantity-input")?.value || "",
      price: row.querySelector(".price-input")?.value || "",
    })),
  };
}

function persistSalesDraft() {
  saveSalesDraft(collectSalesDraft());
}

function restoreSalesForm() {
  const draft = restoreSalesDraft();

  dom.itemsContainer.innerHTML = "";

  if (!draft) {
    dom.itemsContainer.appendChild(createItemRow());
    setDefaultSaleDateTime();
    updateRemoveButtons();
    updateTotals();
    return;
  }

  if (dom.customerNameInput) {
    dom.customerNameInput.value = draft.customerName || "";
  }

  if (dom.dateTimeInput) {
    dom.dateTimeInput.value = draft.saleDateTime || "";
  }

  if (dom.vatCheckbox) {
    dom.vatCheckbox.checked = Boolean(draft.vatEnabled);
  }

  if (dom.paidCheckbox) {
    dom.paidCheckbox.checked = Boolean(draft.paidEnabled);
  }

  if (Array.isArray(draft.items) && draft.items.length > 0) {
    draft.items.forEach((savedRow) => {
      const row = createItemRow();
      row.querySelector(".item-input").value = savedRow.item || "";
      row.querySelector(".quantity-input").value =
        savedRow.quantity || String(QUANTITY_MINIMUM);
      row.querySelector(".price-input").value = savedRow.price || "";
      dom.itemsContainer.appendChild(row);
    });
  } else {
    dom.itemsContainer.appendChild(createItemRow());
  }

  setDefaultSaleDateTime();
  updateRemoveButtons();
  updateTotals();
}

function resetSalesForm() {
  if (dom.customerNameInput) {
    dom.customerNameInput.value = "";
  }

  if (dom.vatCheckbox) {
    dom.vatCheckbox.checked = false;
  }

  if (dom.paidCheckbox) {
    dom.paidCheckbox.checked = false;
  }

  if (dom.itemsContainer) {
    dom.itemsContainer.innerHTML = "";
    dom.itemsContainer.appendChild(createItemRow());
  }

  if (dom.totalPriceInput) {
    dom.totalPriceInput.value = Number(0).toFixed(CURRENCY_DECIMALS);
  }

  if (dom.dateTimeInput) {
    dom.dateTimeInput.value = "";
    setDefaultSaleDateTime();
  }

  updateRemoveButtons();
  updateTotals();
}

function handleAddItem() {
  dom.itemsContainer?.appendChild(createItemRow());
  updateRemoveButtons();
  updateTotals();
  persistSalesDraft();
}

function handleItemRowClick(event) {
  const suggestionButton = event.target.closest(".item-suggestion");
  if (suggestionButton) {
    const row = suggestionButton.closest(".item-row");
    selectSuggestion(
      row,
      suggestionButton.dataset.value || suggestionButton.textContent || "",
    );
    return;
  }

  const removeButton = event.target.closest(".remove-btn");
  if (!removeButton || removeButton.disabled) {
    return;
  }

  const row = removeButton.closest(".item-row");
  const hasData = rowHasData(row);

  if (hasData) {
    const confirmed = window.confirm("Confirm remove item?");
    if (!confirmed) {
      return;
    }
  }

  row.remove();
  updateRemoveButtons();
  updateTotals();
  persistSalesDraft();
}

function handleItemRowInput(event) {
  const row = event.target.closest(".item-row");

  if (!row || !isTrackedRowInput(event.target)) {
    return;
  }

  if (event.target.matches(".item-input")) {
    const suggestions = getSuggestions(event.target.value);
    renderSuggestions(row, suggestions);
  }

  validateRowDependencies(row);
  updateTotals();
  persistSalesDraft();
}

function handleItemRowBlur(event) {
  const row = event.target.closest(".item-row");
  if (!row) {
    return;
  }

  validateRowDependencies(row);

  if (event.target.matches(".quantity-input")) {
    normalizeQuantity(row);
    updateTotals();
  }

  if (event.target.matches(".price-input, .item-input")) {
    showDeferredItemValidation(row);
    window.setTimeout(() => closeSuggestions(row), 120);
  }

  persistSalesDraft();
}

function handleItemRowKeydown(event) {
  const row = event.target.closest(".item-row");

  if (!row || !event.target.matches(".item-input")) {
    return;
  }

  const suggestionsBox = row.querySelector(".item-suggestions");
  const options = suggestionsBox?.querySelectorAll(".item-suggestion");
  let activeIndex = Number(row.dataset.activeSuggestionIndex ?? 0);

  if (event.key === "ArrowDown") {
    if (!options?.length) {
      return;
    }

    event.preventDefault();
    activeIndex = Math.min(activeIndex + 1, options.length - 1);
    row.dataset.activeSuggestionIndex = String(activeIndex);
    updateActiveSuggestion(row);
    return;
  }

  if (event.key === "ArrowUp") {
    if (!options?.length) {
      return;
    }

    event.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    row.dataset.activeSuggestionIndex = String(activeIndex);
    updateActiveSuggestion(row);
    return;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    if (selectActiveSuggestion(row)) {
      event.preventDefault();
    }
    return;
  }

  if (event.key === "Escape") {
    closeSuggestions(row);
  }
}

function handleClearForm() {
  clearSalesDraft();
  resetSalesForm();
}

async function handleSalesSubmit(event) {
  event.preventDefault();

  const rows = dom.itemsContainer?.querySelectorAll(".item-row") || [];

  for (const row of rows) {
    validateItemSelection(row);
    validateRowDependencies(row);
  }

  if (!dom.salesForm?.reportValidity()) {
    return;
  }

  const items = Array.from(rows)
    .map((row) => {
      const itemName = row.querySelector(".item-input")?.value.trim() || "";
      const unitPrice = parseFloat(
        row.querySelector(".price-input")?.value || 0,
      );
      const quantity = parseFloat(
        row.querySelector(".quantity-input")?.value || 0,
      );

      return {
        itemName,
        unitPrice,
        quantity,
        lineTotal: unitPrice * quantity,
      };
    })
    .filter((item) => item.itemName && item.quantity > 0);

  if (!items.length) {
    showAlert("Please add at least one valid item.");
    return;
  }

  const payload = {
    action: "addSale",
    dateTime: dom.dateTimeInput?.value || "",
    customerName: dom.customerNameInput?.value.trim() || "",
    total: parseFloat(dom.totalPriceInput?.value || 0),
    vat: Boolean(dom.vatCheckbox?.checked),
    paid: Boolean(dom.paidCheckbox?.checked),
    items,
  };

  try {
    const result = await postSale(payload);

    if (!result.success) {
      throw new Error(result.message || "Failed to save sale.");
    }

    showAlert("Sale saved successfully.");

    await loadSalesReport({ showLoadingState: false, forceRefresh: true });
    await loadInventoryReport({ showLoadingState: false, forceRefresh: true });

    clearSalesDraft();
    resetSalesForm();
  } catch (error) {
    console.error("Sale submit error:", error);
    showAlert(`Failed to save sale: ${error.message}`);
  }
}

export function initializeSales() {
  if (!dom.itemsContainer || !dom.salesForm) {
    return;
  }

  restoreSalesForm();

  dom.addItemBtn?.addEventListener("click", handleAddItem);
  dom.itemsContainer.addEventListener("click", handleItemRowClick);
  dom.itemsContainer.addEventListener("input", handleItemRowInput);
  dom.itemsContainer.addEventListener("blur", handleItemRowBlur, true);
  dom.itemsContainer.addEventListener("keydown", handleItemRowKeydown);

  dom.vatCheckbox?.addEventListener("change", () => {
    updateTotals();
    persistSalesDraft();
  });

  dom.customerNameInput?.addEventListener("input", persistSalesDraft);
  dom.dateTimeInput?.addEventListener("input", persistSalesDraft);
  dom.paidCheckbox?.addEventListener("change", persistSalesDraft);
  dom.clearFormBtn?.addEventListener("click", handleClearForm);
  dom.salesForm.addEventListener("submit", handleSalesSubmit);
}

export { updateTotals, resetSalesForm, persistSalesDraft };
