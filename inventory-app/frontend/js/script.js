document.addEventListener("DOMContentLoaded", () => {
  // ===========================================================================
  // DOM REFERENCES
  // ===========================================================================
  // Cache frequently used elements once so they can be reused throughout
  // the script without repeated DOM queries.

  const dateTimeInput = document.getElementById("saleDateTime");
  const addItemBtn = document.getElementById("addItemBtn");
  const itemsContainer = document.getElementById("itemsContainer");
  const subtotalPriceInput = document.getElementById("subtotalPrice");
  const totalPriceInput = document.getElementById("totalPrice");
  const vatCheckbox = document.getElementById("vat");
  const paidCheckbox = document.getElementById("paid");
  const customerNameInput = document.getElementById("customerName");
  const clearFormBtn = document.getElementById("clearFormBtn");
  const salesForm = document.querySelector(".sales-form");
  const inventoryItemsList = document.getElementById("inventoryItemsList");

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================
  // Centralize small constants here so future changes can be made in one place.

  const trashIconPath = "./assets/icons/icons8-trash-24.png";
  const vatRate = 0.05;
  const currencyDecimals = 3;
  const quantityMinimum = 1;
  const salesDraftStorageKey = "gps-sales-draft";
  const appsScriptUrl =
    "https://script.google.com/macros/s/AKfycbxtFwsccPW7GckQ34ZEaYohKcJtfuGqAhm84MLDUM_lxd50M7amGVNEZZRV6bAg2tag/exec";

  let inventoryData = [];
  let inventoryItemNames = [];

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================
  // Set up the form once the page has fully loaded.

  initializeForm();

  // ===========================================================================
  // EVENT LISTENERS
  // ===========================================================================
  // Attach all runtime event handlers in one section so interactions are easy
  // to scan and maintain.

  addItemBtn.addEventListener("click", handleAddItem);
  itemsContainer.addEventListener("click", handleItemRowClick);
  itemsContainer.addEventListener("input", handleItemRowInput);
  itemsContainer.addEventListener("blur", handleItemRowBlur, true);
  vatCheckbox.addEventListener("change", updateTotals);

  customerNameInput?.addEventListener("input", saveDraft);
  // dateTimeInput.addEventListener("input", saveDraft);
  vatCheckbox.addEventListener("change", saveDraft);
  paidCheckbox?.addEventListener("change", saveDraft);

  clearFormBtn?.addEventListener("click", handleClearForm);
  salesForm?.addEventListener("submit", handleSalesSubmit);

  // ===========================================================================
  // INITIALIZATION HELPERS
  // ===========================================================================

  /**
   * Initialize the sales form with default values, totals, and inventory
   * suggestions needed for item autocomplete.
   *
   * @returns {void}
   */
  function initializeForm() {
    restoreDraft();
    setDefaultSaleDateTime();
    updateRemoveButtons();
    updateTotals();
    loadInventorySuggestions();
  }

  /**
   * Populate the date/time field with the user's current local date and time.
   * The field remains editable after initialization.
   *
   * @returns {void}
   */
  function setDefaultSaleDateTime() {
    if (dateTimeInput.value) {
      return;
    }

    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDateTime = new Date(now.getTime() - offset * 60 * 1000)
      .toISOString()
      .slice(0, 16);

    dateTimeInput.value = localDateTime;
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Add a new empty item row and refresh row-based UI state.
   *
   * @returns {void}
   */
  function handleAddItem() {
    itemsContainer.appendChild(createItemRow());
    updateRemoveButtons();
    updateTotals();
    saveDraft();
  }

  /**
   * Handle click actions inside the item rows area.
   * This supports removing a row through event delegation.
   *
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleItemRowClick(event) {
    const removeButton = event.target.closest(".remove-btn");

    if (!removeButton || removeButton.disabled) {
      return;
    }

    const row = removeButton.closest(".item-row");
    const hasData = rowHasData(row);

    if (hasData) {
      const confirmed = window.confirm("Confirm remove item");

      if (!confirmed) {
        return;
      }
    }

    row.remove();
    updateRemoveButtons();
    updateTotals();
    saveDraft();
  }

  /**
   * Revalidate the active row and recalculate totals while the user types.
   *
   * @param {InputEvent} event
   * @returns {void}
   */
  function handleItemRowInput(event) {
    const row = event.target.closest(".item-row");

    if (!row || !isTrackedRowInput(event.target)) {
      return;
    }

    validateRowDependencies(row);
    updateTotals();
    saveDraft();
  }

  /**
   * Apply blur-time validation behavior for row inputs.
   * Quantity is normalized after editing, while item/price dependency warnings
   * are shown only after the user leaves the field.
   *
   * @param {FocusEvent} event
   * @returns {void}
   */
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

    if (
      event.target.matches(".price-input") ||
      event.target.matches(".item-input")
    ) {
      showDeferredItemValidation(row);
    }

    saveDraft();
  }

  // ===========================================================================
  // ROW HELPERS
  // ===========================================================================

  /**
   * Build and return a new item row for the sales form.
   * Each row includes item name, quantity, price, and a remove button.
   *
   * @returns {HTMLDivElement}
   */
  function createItemRow() {
    const itemRow = document.createElement("div");
    itemRow.className = "item-row";

    itemRow.innerHTML = /* HTML */ `
      <input
        type="text"
        name="item[]"
        class="item-input"
        placeholder="Item"
        list="inventoryItemsList"
        autocomplete="off"
        required
      />
      <input
        type="number"
        name="quantity[]"
        class="quantity-input"
        placeholder="Qty"
        value="${quantityMinimum}"
        min="${quantityMinimum}"
        required
      />
      <input
        type="number"
        name="price[]"
        class="price-input"
        placeholder="Price"
        min="0"
        step="0.001"
        required
      />
      <button type="button" class="remove-btn" aria-label="Remove item">
        <img
          src="${trashIconPath}"
          alt=""
          class="trash-icon"
          width="20"
          height="20"
        />
      </button>
    `;

    return itemRow;
  }

  /**
   * Enable or disable remove buttons based on the current number of item rows.
   * The last remaining row cannot be removed.
   *
   * @returns {void}
   */
  function updateRemoveButtons() {
    const rows = itemsContainer.querySelectorAll(".item-row");
    const isOnlyOneRow = rows.length === 1;

    rows.forEach((row) => {
      const removeButton = row.querySelector(".remove-btn");

      if (removeButton) {
        removeButton.disabled = isOnlyOneRow;
      }
    });
  }

  /**
   * Check whether any input in a row contains user-entered data.
   * Used before confirming row deletion.
   *
   * @param {HTMLElement} row
   * @returns {boolean}
   */
  function rowHasData(row) {
    const inputs = row.querySelectorAll("input");
    return Array.from(inputs).some((input) => input.value.trim() !== "");
  }

  /**
   * Determine whether an element is one of the row inputs tracked by this form.
   *
   * @param {Element} element
   * @returns {boolean}
   */
  function isTrackedRowInput(element) {
    return (
      element.matches(".item-input") ||
      element.matches(".quantity-input") ||
      element.matches(".price-input")
    );
  }

  // ===========================================================================
  // DRAFT STORAGE
  // ===========================================================================

  /**
   * Save the current sales form state to session storage.
   * Date and time are intentionally excluded from the saved draft.
   *
   * @returns {void}
   */
  function saveDraft() {
    const rows = itemsContainer.querySelectorAll(".item-row");

    const draft = {
      customerName: customerNameInput?.value || "",
      // saleDateTime: dateTimeInput.value,
      vatEnabled: vatCheckbox.checked,
      paidEnabled: paidCheckbox?.checked || false,
      items: Array.from(rows).map((row) => ({
        item: row.querySelector(".item-input")?.value || "",
        quantity: row.querySelector(".quantity-input")?.value || "",
        price: row.querySelector(".price-input")?.value || "",
      })),
    };

    sessionStorage.setItem(salesDraftStorageKey, JSON.stringify(draft));
  }

  /**
   * Restore any previously saved sales draft from session storage.
   * If no draft is found, the form starts with one empty item row.
   *
   * @returns {void}
   */
  function restoreDraft() {
    const rawDraft = sessionStorage.getItem(salesDraftStorageKey);

    if (!rawDraft) {
      itemsContainer.appendChild(createItemRow());
      setDefaultSaleDateTime();
      return;
    }

    let draft;

    try {
      draft = JSON.parse(rawDraft);
    } catch {
      itemsContainer.appendChild(createItemRow());
      setDefaultSaleDateTime();
      return;
    }

    if (customerNameInput) {
      customerNameInput.value = draft.customerName || "";
    }

    // dateTimeInput.value = draft.saleDateTime || "";
    vatCheckbox.checked = Boolean(draft.vatEnabled);

    if (paidCheckbox) {
      paidCheckbox.checked = Boolean(draft.paidEnabled);
    }

    itemsContainer.innerHTML = "";

    if (Array.isArray(draft.items) && draft.items.length > 0) {
      draft.items.forEach((savedRow) => {
        const row = createItemRow();

        row.querySelector(".item-input").value = savedRow.item || "";
        row.querySelector(".quantity-input").value =
          savedRow.quantity || quantityMinimum;
        row.querySelector(".price-input").value = savedRow.price || "";

        itemsContainer.appendChild(row);
      });
    } else {
      itemsContainer.appendChild(createItemRow());
      setDefaultSaleDateTime();
    }
  }

  /**
   * Remove the saved form draft from session storage.
   *
   * @returns {void}
   */
  function clearDraft() {
    sessionStorage.removeItem(salesDraftStorageKey);
  }

  // ===========================================================================
  // TOTALS AND CALCULATIONS
  // ===========================================================================

  /**
   * Calculate subtotal and total for all item rows.
   * Subtotal is the sum before VAT. Total includes VAT when selected.
   *
   * @returns {void}
   */
  function updateTotals() {
    const rows = itemsContainer.querySelectorAll(".item-row");
    let subtotal = 0;

    rows.forEach((row) => {
      const quantity =
        parseFloat(row.querySelector(".quantity-input")?.value) || 0;
      const price = parseFloat(row.querySelector(".price-input")?.value) || 0;

      subtotal += quantity * price;
    });

    const total = vatCheckbox.checked ? subtotal * (1 + vatRate) : subtotal;

    subtotalPriceInput.value = subtotal.toFixed(currencyDecimals);
    totalPriceInput.value = total.toFixed(currencyDecimals);
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate dependencies between item, quantity, and price fields in a row.
   * If a price exists, quantity defaults to the minimum value when empty and the
   * item field becomes required through a custom validation message.
   *
   * @param {HTMLElement} row
   * @returns {void}
   */
  function validateRowDependencies(row) {
    const itemInput = row.querySelector(".item-input");
    const quantityInput = row.querySelector(".quantity-input");
    const priceInput = row.querySelector(".price-input");

    const hasPrice = priceInput.value.trim() !== "";
    const hasItem = itemInput.value.trim() !== "";

    itemInput.setCustomValidity("");
    quantityInput.setCustomValidity("");

    if (hasPrice && !quantityInput.value.trim()) {
      quantityInput.value = quantityMinimum;
    }

    if (hasPrice && !hasItem) {
      itemInput.setCustomValidity("Please fill out this field.");
    }

    itemInput.checkValidity();
  }

  /**
   * Normalize quantity so the field never stays empty or below the allowed
   * minimum after the user finishes editing.
   *
   * @param {HTMLElement} row
   * @returns {void}
   */
  function normalizeQuantity(row) {
    const quantityInput = row.querySelector(".quantity-input");
    const quantity = parseFloat(quantityInput.value);

    if (
      !quantityInput.value.trim() ||
      Number.isNaN(quantity) ||
      quantity < quantityMinimum
    ) {
      quantityInput.value = quantityMinimum;
    }
  }

  /**
   * Show the browser validation message for the item field only after the user
   * leaves the row input and a price has already been entered.
   *
   * @param {HTMLElement} row
   * @returns {void}
   */
  function showDeferredItemValidation(row) {
    const itemInput = row.querySelector(".item-input");
    const priceInput = row.querySelector(".price-input");

    if (priceInput.value.trim() !== "") {
      itemInput.reportValidity();
    }
  }

  /**
   * Clear the form after confirmation and reset it to the default state.
   *
   * @returns {void}
   */
  function handleClearForm() {
    const confirmed = window.confirm("Clear the Form");

    if (!confirmed) {
      return;
    }

    clearDraft();

    if (customerNameInput) {
      customerNameInput.value = "";
    }

    vatCheckbox.checked = false;

    if (paidCheckbox) {
      paidCheckbox.checked = false;
    }

    itemsContainer.innerHTML = "";
    itemsContainer.appendChild(createItemRow());

    subtotalPriceInput.value = Number(0).toFixed(currencyDecimals);
    totalPriceInput.value = Number(0).toFixed(currencyDecimals);

    dateTimeInput.value = "";
    setDefaultSaleDateTime();

    updateRemoveButtons();
    updateTotals();
  }

  /**
   * Submit the sales form to the Apps Script backend and reset the form after a
   * successful save.
   *
   * @param {SubmitEvent} event
   * @returns {Promise<void>}
   */
  async function handleSalesSubmit(event) {
    event.preventDefault();

    if (!salesForm.reportValidity()) {
      return;
    }

    const rows = itemsContainer.querySelectorAll(".item-row");

    const items = Array.from(rows)
      .map((row) => {
        const itemName = row.querySelector(".item-input")?.value.trim() || "";
        const unitPrice =
          parseFloat(row.querySelector(".price-input")?.value) || 0;
        const quantity =
          parseFloat(row.querySelector(".quantity-input")?.value) || 0;

        return {
          itemName,
          unitPrice,
          quantity,
          lineTotal: unitPrice * quantity,
        };
      })
      .filter((item) => item.itemName && item.quantity > 0);

    if (!items.length) {
      window.alert("Please add at least one valid item.");
      return;
    }

    const payload = {
      action: "addSale",
      dateTime: dateTimeInput.value,
      customerName: customerNameInput?.value.trim() || "",
      subtotal: parseFloat(subtotalPriceInput.value) || 0,
      total: parseFloat(totalPriceInput.value) || 0,
      vat: vatCheckbox.checked,
      paid: paidCheckbox?.checked || false,
      items,
    };

    try {
      const response = await fetch(appsScriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to save sale.");
      }

      window.alert("Successful!!!.");
      clearDraft();

      if (customerNameInput) {
        customerNameInput.value = "";
      }

      vatCheckbox.checked = false;

      if (paidCheckbox) {
        paidCheckbox.checked = false;
      }

      itemsContainer.innerHTML = "";
      itemsContainer.appendChild(createItemRow());

      subtotalPriceInput.value = Number(0).toFixed(currencyDecimals);
      totalPriceInput.value = Number(0).toFixed(currencyDecimals);

      dateTimeInput.value = "";
      setDefaultSaleDateTime();

      updateRemoveButtons();
      updateTotals();
    } catch (error) {
      console.error("Sale submit error:", error);
      window.alert(`Failed to save sale: ${error.message}`);
    }
  }

  /**
   * Load inventory item names from the Apps Script backend and populate the
   * datalist used by the item autocomplete inputs.
   *
   * @returns {Promise<void>}
   */
  async function loadInventorySuggestions() {
    try {
      if (!inventoryItemsList) {
        return;
      }

      const response = await fetch(`${appsScriptUrl}?action=getInventory`);

      if (!response.ok) {
        throw new Error(`Failed to load inventory (${response.status})`);
      }

      const result = await response.json();

      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || "Failed to load inventory");
      }

      inventoryData = result.data;
      inventoryItemNames = [
        ...new Set(
          inventoryData
            .map((item) => String(item["Item Name"] || "").trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b));

      inventoryItemsList.innerHTML = "";

      inventoryItemNames.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        inventoryItemsList.appendChild(option);
      });
    } catch (error) {
      console.error("Inventory suggestions load error:", error);
    }
  }
});
