// all fetch calls to Apps Script.

import { APPS_SCRIPT_URL } from "./config.js";

async function parseJsonResponse(response, fallbackMessage) {
  if (!response.ok) {
    throw new Error(`${fallbackMessage} (${response.status})`);
  }

  const result = await response.json();
  return result;
}

export async function fetchInventoryData() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=getInventory`);
  return parseJsonResponse(response, "Failed to load inventory");
}

export async function fetchSalesData() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=getSales`);
  return parseJsonResponse(response, "Failed to load sales");
}

export async function postSale(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response, "Failed to save sale");
}

export async function postInventory(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response, "Failed to save inventory");
}

export async function toggleSalePaid(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response, "Failed to update paid status");
}

export async function refundSale(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response, "Failed to refund sale");
}
