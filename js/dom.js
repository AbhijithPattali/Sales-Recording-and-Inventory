//all DOM element references in one place.

export const dom = {
  dateTimeInput: null,
  addItemBtn: null,
  itemsContainer: null,
  totalPriceInput: null,
  vatCheckbox: null,
  paidCheckbox: null,
  customerNameInput: null,
  clearFormBtn: null,
  salesForm: null,

  navButtons: [],
  appViews: [],

  salesReportDateInput: null,
  salesReportPrevDateBtn: null,
  salesReportNextDateBtn: null,
  salesReportSearch: null,
  salesReportStatus: null,
  refreshSalesReportBtn: null,
  salesReportTableBody: null,

  inventoryReportTableBody: null,
  inventoryReportStatus: null,
  refreshInventoryReportBtn: null,
  inventoryReportSearch: null,

  inventoryForm: null,
  inventoryItemNameInput: null,
  inventoryItemSuggestions: null,
  inventoryModelInput: null,
  inventoryCurrentStockInput: null,
  inventoryQuantityAddedInput: null,
  inventoryRemarkInput: null,
  clearInventoryBtn: null,
  inventoryStaffNameInput: null,
  clearableTextInputs: [],
};

export function initializeDom() {
  dom.dateTimeInput = document.getElementById("saleDateTime");
  dom.addItemBtn = document.getElementById("addItemBtn");
  dom.itemsContainer = document.getElementById("itemsContainer");
  dom.totalPriceInput = document.getElementById("totalPrice");
  dom.vatCheckbox = document.getElementById("vat");
  dom.paidCheckbox = document.getElementById("paid");
  dom.customerNameInput = document.getElementById("customerName");
  dom.clearFormBtn = document.getElementById("clearFormBtn");
  dom.salesForm = document.querySelector(".sales-form");

  dom.navButtons = Array.from(document.querySelectorAll(".nav-button"));
  dom.appViews = Array.from(document.querySelectorAll(".app-view"));

  dom.salesReportDateInput = document.getElementById("salesReportDate");
  dom.salesReportPrevDateBtn = document.getElementById(
    "salesReportPrevDateBtn",
  );
  dom.salesReportNextDateBtn = document.getElementById(
    "salesReportNextDateBtn",
  );
  dom.salesReportSearch = document.getElementById("salesReportSearch");
  dom.salesReportStatus = document.getElementById("salesReportStatus");
  dom.refreshSalesReportBtn = document.getElementById("refreshSalesReportBtn");
  dom.salesReportTableBody = document.getElementById("salesReportTableBody");

  dom.inventoryReportTableBody = document.getElementById(
    "inventoryReportTableBody",
  );
  dom.inventoryReportStatus = document.getElementById("inventoryReportStatus");
  dom.refreshInventoryReportBtn = document.getElementById(
    "refreshInventoryReportBtn",
  );
  dom.inventoryReportSearch = document.getElementById("inventoryReportSearch");

  dom.inventoryForm = document.getElementById("inventoryForm");
  dom.inventoryItemNameInput = document.getElementById("inventoryItemName");
  dom.inventoryItemSuggestions = document.getElementById(
    "inventoryItemSuggestions",
  );
  dom.inventoryModelInput = document.getElementById("inventoryModel");
  dom.inventoryCurrentStockInput = document.getElementById(
    "inventoryCurrentStock",
  );
  dom.inventoryQuantityAddedInput = document.getElementById(
    "inventoryQuantityAdded",
  );
  dom.inventoryRemarkInput = document.getElementById("inventoryRemark");
  dom.clearInventoryBtn = document.getElementById("clearInventoryBtn");
  dom.inventoryStaffNameInput = document.getElementById("inventoryStaffName");
  dom.clearableTextInputs = Array.from(
    document.querySelectorAll('input[type="text"], input[type="search"]'),
  ).filter((input) => !input.hasAttribute("readonly"));
}
