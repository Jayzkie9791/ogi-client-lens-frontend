import { expect, it } from "vitest";

it("registers jest-dom matchers on the Vitest expect used by tests", () => {
  const node = document.createElement("span");
  node.textContent = "matcher proof";
  document.body.append(node);
  expect(node).toBeInTheDocument();
  expect(node).toHaveTextContent("matcher proof");
  expect(node).toBeVisible();
  node.remove();
});
