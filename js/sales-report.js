import { dom } from "./dom.js";
import { fetchSalesData, toggleSalePaid, refundSale } from "./api.js";
import { loadInventoryReport } from "./inventory-report.js";

let salesData = [];
let salesLoadPromise = null;
let hasLoadedSalesOnce = false;

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setDefaultSalesReportDate() {
  if (!dom.salesReportDateInput || dom.salesReportDateInput.value) {
    return;
  }

  dom.salesReportDateInput.value = formatDateInputValue(new Date());
}

function parseRowDate(value) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getRowDateKey(row) {
  const parsed = parseRowDate(row["Date and Time"] ?? row.dateTime);
  return parsed ? formatDateInputValue(parsed) : "";
}

function getRowTimeLabel(row) {
  const parsed = parseRowDate(row["Date and Time"] ?? row.dateTime);

  if (!parsed) {
    return "";
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "1" ||
    normalized === "paid"
  );
}

function formatMoney(value) {
  const number = Number(value ?? 0);
  return Number.isNaN(number) ? "0.000" : number.toFixed(3);
}

function isRefundedRow(row) {
  return (
    normalizeBoolean(row.Refunded) ||
    String(row.Status ?? "")
      .trim()
      .toLowerCase() === "refunded"
  );
}

function getFilteredSalesRows() {
  const selectedDate = String(dom.salesReportDateInput?.value || "").trim();
  const searchTerm = String(dom.salesReportSearch?.value || "")
    .trim()
    .toLowerCase();

  return salesData
    .filter((row) => {
      if (selectedDate && getRowDateKey(row) !== selectedDate) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const searchableText = [
        row["Sale ID"],
        row["Customer Name"],
        row["Item Name"],
        row["Date and Time"],
        row["Paid"],
        row["Status"],
      ]
        .map((value) =>
          String(value ?? "")
            .trim()
            .toLowerCase(),
        )
        .join(" ");

      return searchableText.includes(searchTerm);
    })
    .sort((a, b) => {
      const dateA = parseRowDate(a["Date and Time"])?.getTime() ?? 0;
      const dateB = parseRowDate(b["Date and Time"])?.getTime() ?? 0;
      return dateB - dateA;
    });
}

export function setSalesReportLoadingState(isLoading) {
  if (dom.salesReportStatus) {
    dom.salesReportStatus.textContent = isLoading
      ? "Refreshing sales..."
      : "Showing sales report.";
  }

  if (dom.refreshSalesReportBtn) {
    dom.refreshSalesReportBtn.disabled = isLoading;
    dom.refreshSalesReportBtn.textContent = isLoading
      ? "Refreshing..."
      : "Refresh";
  }

  const tableWrap = dom.salesReportTableBody?.closest(".table-wrap");
  if (tableWrap) {
    tableWrap.classList.toggle("table-wrap--loading", isLoading);
  }
}

function renderSalesReportError(message) {
  if (!dom.salesReportTableBody || !dom.salesReportStatus) {
    return;
  }

  dom.salesReportStatus.textContent = "Unable to load sales.";
  dom.salesReportTableBody.innerHTML = `
    <tr>
      <td colspan="8">${message || "Failed to load sales."}</td>
    </tr>
  `;
}

export function renderSalesReportTable() {
  if (!dom.salesReportTableBody || !dom.salesReportStatus) {
    return;
  }

  const filteredRows = getFilteredSalesRows();
  const selectedDate = String(dom.salesReportDateInput?.value || "").trim();

  dom.salesReportStatus.textContent = selectedDate
    ? `Showing ${filteredRows.length} sale row(s) for ${selectedDate}.`
    : `Showing ${filteredRows.length} sale row(s).`;

  if (!filteredRows.length) {
    dom.salesReportTableBody.innerHTML = `
      <tr>
        <td colspan="8">No matching sales found.</td>
      </tr>
    `;
    return;
  }

  dom.salesReportTableBody.innerHTML = filteredRows
    .map((row) => {
      const saleId = String(row["Sale ID"] ?? "").trim();
      const paid = normalizeBoolean(row.Paid);
      const refunded = isRefundedRow(row);

      return `
        <tr class="${refunded ? "sales-report-row--refunded" : ""}">
          <td>${getRowTimeLabel(row)}</td>
          <td>
            <div class="sales-report-cell-main">${row["Customer Name"] ?? ""}</div>
            <div class="sales-report-cell-sub">${saleId}</div>
          </td>
          <td>${row["Item Name"] ?? ""}</td>
          <td>
            <div class="sales-qty-control">
              <button
                type="button"
                class="sales-qty-btn"
                data-action="refund-sale-unit"
                data-sale-line-id="${String(row["Sale Line ID"] ?? "").trim()}"
                ${Number(row["Quantity"] ?? 0) <= 0 ? "disabled" : ""}
                aria-label="Refund one unit"
              >
                &minus;
              </button>
              <span class="sales-qty-value">${row["Quantity"] ?? 0}</span>
            </div>
          </td>
          <td>${formatMoney(row["Line Total"])}</td>
          <td>${formatMoney(row["Total"])}</td>
          <td>${normalizeBoolean(row["VAT"]) ? "Yes" : "No"}</td>
          <td>
            <button
              type="button"
              class="sales-report-paid-btn ${paid ? "sales-report-paid-btn--active" : ""}"
              data-action="toggle-paid"
              data-sale-id="${saleId}"
              ${refunded ? "disabled" : ""}
            >
              ${paid ? "Paid" : "Unpaid"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

export async function loadSalesReport(options = {}) {
  const { showLoadingState = true, forceRefresh = false } = options;

  if (salesLoadPromise && !forceRefresh) {
    return salesLoadPromise;
  }

  if (hasLoadedSalesOnce && !forceRefresh) {
    renderSalesReportTable();
    return;
  }

  if (showLoadingState) {
    setSalesReportLoadingState(true);
  }

  salesLoadPromise = (async () => {
    try {
      const result = await fetchSalesData();

      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || "Failed to load sales.");
      }

      salesData = result.data;
      hasLoadedSalesOnce = true;
      renderSalesReportTable();
    } catch (error) {
      console.error("Sales report load error:", error);
      renderSalesReportError(error.message);
    } finally {
      salesLoadPromise = null;

      if (showLoadingState) {
        setSalesReportLoadingState(false);
      }
    }
  })();

  return salesLoadPromise;
}

function shiftSalesReportDate(days) {
  if (!dom.salesReportDateInput?.value) {
    setDefaultSalesReportDate();
  }

  const currentValue = String(dom.salesReportDateInput?.value || "").trim();

  if (!currentValue) {
    return;
  }

  const currentDate = new Date(`${currentValue}T00:00:00`);
  currentDate.setDate(currentDate.getDate() + days);
  dom.salesReportDateInput.value = formatDateInputValue(currentDate);
  renderSalesReportTable();
}

async function handleSalesReportTableClick(event) {
  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.action === "refund-sale-unit") {
    const saleLineId = String(actionButton.dataset.saleLineId || "").trim();

    if (!saleLineId) {
      return;
    }

    try {
      actionButton.disabled = true;

      const result = await refundSale({
        action: "refundSaleUnit",
        saleLineId,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to refund one unit.");
      }

      const updatedSaleId = String(result.data?.saleId ?? "").trim();
      const updatedTotal = Number(result.data?.total ?? 0);

      salesData = salesData.map((row) => {
        const rowSaleLineId = String(
          row["Sale Line ID"] ??
            row["Sale Line Id"] ??
            row["SaleLineID"] ??
            row["Sale_Line_ID"] ??
            row.saleLineId ??
            "",
        ).trim();

        const rowSaleId = String(row["Sale ID"] ?? "").trim();

        if (rowSaleLineId === saleLineId) {
          const nextQuantity = Number(
            result.data?.remainingQuantity ?? row["Quantity"] ?? 0,
          );
          const unitPrice = Number(row["Unit Price"] ?? 0);

          return {
            ...row,
            Quantity: nextQuantity,
            "Line Total": unitPrice * nextQuantity,
            Total: updatedTotal || row.Total || row["Total"] || 0,
            Refunded: nextQuantity === 0,
            Status: nextQuantity === 0 ? "Refunded" : "Partially Refunded",
          };
        }

        if (updatedSaleId && rowSaleId === updatedSaleId) {
          return {
            ...row,
            Total: updatedTotal || row.Total || row["Total"] || 0,
          };
        }

        return row;
      });

      renderSalesReportTable();
      await loadInventoryReport({
        showLoadingState: false,
        forceRefresh: true,
      });
    } catch (error) {
      console.error("Refund sale unit error:", error);
      window.alert(`Failed to refund one unit: ${error.message}`);
    }

    return;
  }

  const saleId = String(actionButton.dataset.saleId || "").trim();

  if (!saleId) {
    return;
  }

  if (actionButton.dataset.action === "toggle-paid") {
    const currentRow = salesData.find(
      (row) => String(row["Sale ID"] ?? "").trim() === saleId,
    );
    const nextPaid = !normalizeBoolean(currentRow?.Paid);

    try {
      actionButton.disabled = true;

      const result = await toggleSalePaid({
        action: "toggleSalePaid",
        saleId,
        paid: nextPaid,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to update paid status.");
      }

      salesData = salesData.map((row) =>
        String(row["Sale ID"] ?? "").trim() === saleId
          ? { ...row, Paid: nextPaid }
          : row,
      );

      renderSalesReportTable();
    } catch (error) {
      console.error("Toggle paid error:", error);
      window.alert(`Failed to update paid status: ${error.message}`);
    }

    return;
  }

  if (actionButton.dataset.action === "refund-sale") {
    const confirmed = window.confirm(
      `Refund sale ${saleId}? This will restore stock.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      actionButton.disabled = true;

      const result = await refundSale({
        action: "refundSale",
        saleId,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to refund sale.");
      }

      salesData = salesData.map((row) =>
        String(row["Sale ID"] ?? "").trim() === saleId
          ? { ...row, Refunded: true, Status: "Refunded" }
          : row,
      );

      renderSalesReportTable();
      await loadInventoryReport({
        showLoadingState: false,
        forceRefresh: true,
      });
      window.alert("Sale refunded successfully.");
    } catch (error) {
      console.error("Refund sale error:", error);
      window.alert(`Failed to refund sale: ${error.message}`);
    }
  }
}

export function initializeSalesReport() {
  if (!dom.salesReportTableBody) {
    return;
  }

  setDefaultSalesReportDate();

  dom.refreshSalesReportBtn?.addEventListener("click", () => {
    loadSalesReport({
      showLoadingState: true,
      forceRefresh: true,
    });
  });

  dom.salesReportSearch?.addEventListener("input", renderSalesReportTable);
  dom.salesReportDateInput?.addEventListener("change", renderSalesReportTable);
  dom.salesReportPrevDateBtn?.addEventListener("click", () =>
    shiftSalesReportDate(-1),
  );
  dom.salesReportNextDateBtn?.addEventListener("click", () =>
    shiftSalesReportDate(1),
  );

  dom.salesReportTableBody.addEventListener(
    "click",
    handleSalesReportTableClick,
  );
}
