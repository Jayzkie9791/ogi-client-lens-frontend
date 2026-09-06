import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OetsProgressNavigator } from "./OetsProgressNavigator";
import type { OetsProgressModel } from "./oetsProgress";

let observerCallback: IntersectionObserverCallback = () => undefined;
const observe = vi.fn();
const disconnect = vi.fn();
const observerArgument: IntersectionObserver = {
  root: null,
  rootMargin: "",
  thresholds: [],
  disconnect: () => undefined,
  observe: () => undefined,
  takeRecords: () => [],
  unobserve: () => undefined
};

beforeEach(() => {
  observe.mockReset();
  disconnect.mockReset();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) {
      observerCallback = callback;
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
    takeRecords = vi.fn();
    root = null;
    rootMargin = "";
    thresholds = [];
  });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mediaQueryList(false)));
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("OetsProgressNavigator", () => {
  it("renders canonical entries in desktop and mobile views from one model", async () => {
    const user = userEvent.setup();
    render(<OetsProgressNavigator model={model()} />);
    const mobileToggle = screen.getByRole("button", { name: /Form progress.*Section 1/s });
    await user.click(mobileToggle);
    const navigation = screen.getByRole("navigation", { name: "Form sections" });
    expect(navigation).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: /Section 1.*General/s })).toBeInTheDocument();
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
    expect(screen.getByTestId("oets-progress-rail"))
      .toHaveClass("lg:max-h-[calc(100vh-8.5rem)]", "overflow-hidden");
    expect(screen.getByTestId("oets-progress-summary")).toBeInTheDocument();
    expect(screen.getByTestId("oets-progress-section-list"))
      .toHaveClass("overflow-y-auto", "overscroll-contain");
    expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
  });

  it("navigates to the exact section and uses smooth scrolling normally", async () => {
    const user = userEvent.setup();
    const target = document.createElement("section");
    target.id = "oets-section-section-2";
    target.dataset.oetsSectionId = "section-2";
    target.tabIndex = -1;
    target.scrollIntoView = vi.fn();
    const focus = vi.spyOn(target, "focus");
    document.body.append(target);
    render(<OetsProgressNavigator model={model()} />);
    await user.click(screen.getByRole("button", { name: /Form progress.*Section 1/s }));
    const navigation = screen.getByRole("navigation", { name: "Form sections" });

    await user.click(within(navigation).getByRole("button", { name: /Section 2.*Safety/s }));
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth", block: "start"
    });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("avoids smooth scrolling for reduced motion and marks intersections current", async () => {
    vi.mocked(window.matchMedia).mockReturnValue(mediaQueryList(true));
    const user = userEvent.setup();
    const first = sectionTarget("oets-section-section-1", "section-1");
    const second = sectionTarget("oets-section-section-2", "section-2");
    render(<OetsProgressNavigator model={model()} />);
    await user.click(screen.getByRole("button", { name: /Form progress.*Section 1/s }));
    const navigation = screen.getByRole("navigation", { name: "Form sections" });

    act(() => observerCallback([
      createIntersectionEntry(second)
    ], observerArgument));
    expect(within(navigation).getByRole("button", { name: /Section 2.*Safety/s }))
      .toHaveAttribute("aria-current", "location");

    await user.click(within(navigation).getByRole("button", { name: /Section 1.*General/s }));
    expect(first.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto", block: "start"
    });
  });
});

function sectionTarget(id: string, sectionId: string) {
  const target = document.createElement("section");
  target.id = id;
  target.dataset.oetsSectionId = sectionId;
  target.scrollIntoView = vi.fn();
  vi.spyOn(target, "focus");
  document.body.append(target);
  return target;
}

function createIntersectionEntry(
  target: Element,
  overrides: Partial<IntersectionObserverEntry> = {}
): IntersectionObserverEntry {
  const rect = target.getBoundingClientRect();

  return {
    target,
    isIntersecting: true,
    intersectionRatio: 1,
    boundingClientRect: rect,
    intersectionRect: rect,
    rootBounds: null,
    time: 0,
    ...overrides
  };
}

function mediaQueryList(matches: boolean): MediaQueryList {
  return {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true
  };
}

function model(): OetsProgressModel {
  return {
    fulfilledRequired: 1,
    totalRequired: 2,
    percentage: 50,
    hasUnmappedAttention: false,
    sections: [
      {
        sectionId: "section-1", sectionCode: "GENERAL", sequence: 1,
        title: "General", domId: "oets-section-section-1",
        status: "COMPLETE", fulfilledRequired: 1, totalRequired: 1
      },
      {
        sectionId: "section-2", sectionCode: "SAFETY", sequence: 2,
        title: "Safety", domId: "oets-section-section-2",
        status: "NOT_STARTED", fulfilledRequired: 0, totalRequired: 1
      }
    ]
  };
}
