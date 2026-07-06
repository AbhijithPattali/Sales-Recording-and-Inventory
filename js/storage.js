// session persistence for forms and active view.

import { STORAGE_KEYS } from "./config.js";

function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function setSessionItem(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save session item: ${key}`, error);
  }
}

function getSessionItem(key, fallback = null) {
  try {
    const rawValue = sessionStorage.getItem(key);
    if (rawValue === null) {
      return fallback;
    }

    return safeParse(rawValue, fallback);
  } catch (error) {
    console.error(`Failed to read session item: ${key}`, error);
    return fallback;
  }
}

function removeSessionItem(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove session item: ${key}`, error);
  }
}

export function saveSalesDraft(draft) {
  setSessionItem(STORAGE_KEYS.salesDraft, draft);
}

export function restoreSalesDraft() {
  return getSessionItem(STORAGE_KEYS.salesDraft, null);
}

export function clearSalesDraft() {
  removeSessionItem(STORAGE_KEYS.salesDraft);
}

export function saveInventoryDraft(draft) {
  setSessionItem(STORAGE_KEYS.inventoryDraft, draft);
}

export function restoreInventoryDraft() {
  return getSessionItem(STORAGE_KEYS.inventoryDraft, null);
}

export function clearInventoryDraft() {
  removeSessionItem(STORAGE_KEYS.inventoryDraft);
}

export function saveActiveView(viewName) {
  setSessionItem(STORAGE_KEYS.activeView, viewName);
}

export function loadActiveView() {
  return getSessionItem(STORAGE_KEYS.activeView, "");
}

export function clearActiveView() {
  removeSessionItem(STORAGE_KEYS.activeView);
}
