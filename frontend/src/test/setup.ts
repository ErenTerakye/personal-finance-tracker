import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { clearResourceCache } from "../shared/hooks/resourceCache";

const storageItems = new Map<string, string>();
const localStorage = {
  get length() {
    return storageItems.size;
  },
  clear() {
    storageItems.clear();
  },
  getItem(key: string) {
    return storageItems.get(key) ?? null;
  },
  key(index: number) {
    return Array.from(storageItems.keys())[index] ?? null;
  },
  removeItem(key: string) {
    storageItems.delete(key);
  },
  setItem(key: string, value: string) {
    storageItems.set(key, value);
  },
} satisfies Storage;

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorage,
});

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
