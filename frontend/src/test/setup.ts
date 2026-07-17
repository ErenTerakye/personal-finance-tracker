import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { clearResourceCache } from "../shared/hooks/resourceCache";

afterEach(() => clearResourceCache());

class TestDialog extends HTMLElement {
  open = false;
  returnValue = "";

  showModal() {
    this.open = true;
    this.setAttribute("open", "");
  }

  close(returnValue = "") {
    this.returnValue = returnValue;
    this.open = false;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  }
}

if (!customElements.get("test-dialog")) {
  customElements.define("test-dialog", TestDialog);
}

HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
  this.setAttribute("open", "");
};

HTMLDialogElement.prototype.close = function close(returnValue = "") {
  this.returnValue = returnValue;
  this.open = false;
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
