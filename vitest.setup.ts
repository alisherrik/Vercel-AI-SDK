import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
});

Object.defineProperty(window.navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: vi.fn(),
  },
});

Object.defineProperty(window.URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => "blob:planner-artifact"),
});

Object.defineProperty(window.URL, "revokeObjectURL", {
  configurable: true,
  value: vi.fn(),
});
