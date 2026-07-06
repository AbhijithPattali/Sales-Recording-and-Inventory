//current inventory table rendering, search, refresh.

import { dom } from "./dom.js";
import { getInventoryData, loadInventorySuggestions } from "./inventory.js";
import { escapeHtml } from "./utils.js";

export function setInventoryReportLoadingState(isLoading) {
  if (dom.inventoryReportStatus) {
    const inventoryData = getInventoryData();
    const hasSearch = Boolean(dom.inventoryReportSearch?.value?.trim());

    dom.inventoryReportStatus.textContent = isLoading
      ? "Refreshing inventory..."
      : hasSearch
        ? "Showing filtered inventory results."
        : `Showing ${inventoryData.length} inventory items.`;
  }

  if (dom.refreshInventoryReportBtn) {
    dom.refreshInventoryReportBtn.disabled = isLoading;
    dom.refreshInventoryReportBtn.textContent = isLoading
      ? "Refreshing..."
      : "Refresh";
  }

  const tableWrap = document.querySelector(".table-wrap");
  if (tableWrap) {
    tableWrap.classList.toggle("table-wrap--loading", isLoading);
  }
}

export function renderInventoryReportError(message) {
  if (!dom.inventoryReportTableBody || !dom.inventoryReportStatus) {
    return;
  }

  dom.inventoryReportStatus.textContent = "Unable to load inventory.";
  dom.inventoryReportTableBody.innerHTML = `
    <tr>
      <td colspan="5">${escapeHtml(message || "Failed to load inventory.")}</td>
    </tr>
  `;
}

export function renderInventoryReportTable() {
  if (!dom.inventoryReportTableBody || !dom.inventoryReportStatus) {
    return;
  }

  const inventoryData = getInventoryData();
  const searchTerm = String(dom.inventoryReportSearch?.value || "")
    .trim()
    .toLowerCase();

  const filteredInventory = inventoryData.filter((item) => {
    if (!searchTerm) {
      return true;
    }

    const itemName = String(item["Item Name"] ?? "")
      .trim()
      .toLowerCase();
    const category = String(item["Category"] ?? "")
      .trim()
      .toLowerCase();
    const serialNumber = String(item["Serial No"] ?? "")
      .trim()
      .toLowerCase();
    const remark = String(item["Remark"] ?? "")
      .trim()
      .toLowerCase();

    const searchableText = [itemName, category, serialNumber, remark]
      .filter(Boolean)
      .join(" ");

    return searchableText.includes(searchTerm);
  });

  dom.inventoryReportStatus.textContent = searchTerm
    ? `Showing ${filteredInventory.length} of ${inventoryData.length} inventory items.`
    : `Showing ${inventoryData.length} inventory items.`;

  if (!filteredInventory.length) {
    dom.inventoryReportTableBody.innerHTML = `
      <tr>
        <td colspan="5">No matching inventory found.</td>
      </tr>
    `;
    return;
  }

  const rowsHtml = filteredInventory
    .map((item) => {
      const serialNumber = escapeHtml(item["Serial No"] ?? "");
      const itemName = escapeHtml(item["Item Name"] ?? "");
      const category = escapeHtml(item["Category"] ?? "");
      const stockRaw = item["Total Stock"];
      const currentStock = escapeHtml(stockRaw ?? "");
      const remark = escapeHtml(item["Remark"] ?? "");

      const stockValue = Number(stockRaw);
      const isOutOfStock =
        stockRaw !== null &&
        stockRaw !== undefined &&
        String(stockRaw).trim() !== "" &&
        stockValue <= 0;

      const rowClass = isOutOfStock ? "inventory-report-row--out" : "";

      return `
        <tr class="${rowClass}">
          <td>${serialNumber}</td>
          <td>${itemName}</td>
          <td>${category}</td>
          <td>${currentStock}</td>
          <td>${remark}</td>
        </tr>
      `;
    })
    .join("");

  dom.inventoryReportTableBody.innerHTML = rowsHtml;
}

export async function loadInventoryReport(options = {}) {
  const { showLoadingState = true, forceRefresh = false } = options;

  if (showLoadingState) {
    setInventoryReportLoadingState(true);
  }

  try {
    await loadInventorySuggestions({ forceRefresh });
  } finally {
    if (showLoadingState) {
      setInventoryReportLoadingState(false);
    }
  }
}

export function initializeInventoryReport() {
  dom.refreshInventoryReportBtn?.addEventListener("click", () => {
    loadInventoryReport({
      showLoadingState: true,
      forceRefresh: true,
    });
  });
  dom.inventoryReportSearch?.addEventListener(
    "input",
    renderInventoryReportTable,
  );
}
