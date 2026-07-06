import { dom } from "./dom.js";

export function showAlert(message) {
  window.alert(String(message || ""));
}

function updateClearButtonVisibility(input, button) {
  button.hidden = !String(input.value || "").length;
}

function createClearButton(input) {
  const wrapper = document.createElement("div");
  wrapper.className = "input-with-clear";

  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "input-clear-btn";
  button.setAttribute("aria-label", "Clear input");
  button.hidden = !String(input.value || "").length;
  button.innerHTML = "&times;";

  wrapper.appendChild(button);

  input.classList.add("has-clear-button");

  input.addEventListener("input", () => {
    updateClearButtonVisibility(input, button);
  });

  button.addEventListener("click", () => {
    input.value = "";
    input.focus();
    updateClearButtonVisibility(input, button);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function initializeClearableInputs() {
  dom.clearableTextInputs.forEach((input) => {
    if (
      !input.parentElement ||
      input.parentElement.classList.contains("input-with-clear")
    ) {
      return;
    }

    createClearButton(input);
  });
}

export function enhanceClearableInput(input) {
  if (!input) {
    return;
  }

  if (
    !input.parentElement ||
    input.parentElement.classList.contains("input-with-clear")
  ) {
    return;
  }

  createClearButton(input);
}
