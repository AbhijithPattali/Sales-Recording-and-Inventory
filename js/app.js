//startup, initialize app, connect modules.

import { initializeDom } from "./dom.js";
import { initializeNavigation } from "./navigation.js";
import { initializeSales } from "./sales.js";
import { initializeClearableInputs } from "./ui.js";
import { initializeInventory } from "./inventory.js";
import { initializeInventoryReport } from "./inventory-report.js";
import { initializeSalesReport } from "./sales-report.js";

document.addEventListener("DOMContentLoaded", async () => {
  initializeDom();

  initializeClearableInputs();
  initializeNavigation();
  initializeSales();
  initializeInventory();
  initializeInventoryReport();
  initializeSalesReport();
});
