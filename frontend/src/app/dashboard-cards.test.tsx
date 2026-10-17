import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Kpi } from "./dashboard-cards";

describe("Kpi delta", () => {
  test("the arrow follows the number, the colour follows the meaning", () => {
    // Depression rising: bad (red) but still going up.
    render(<Kpi label="Depression avg" value="4" delta={{ text: "+20%", tone: "negative", direction: "up" }} />);
    const pill = screen.getByText("+20%");
    expect(pill.textContent).toContain("▲");
    expect(pill.className).toContain("text-danger");
  });

  test("a falling bad metric points down in green", () => {
    render(<Kpi label="Pain avg" value="2" delta={{ text: "-15%", tone: "positive", direction: "down" }} />);
    const pill = screen.getByText("-15%");
    expect(pill.textContent).toContain("▼");
    expect(pill.className).toContain("text-success");
  });
});
