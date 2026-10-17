import { afterEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

afterEach(() => vi.useRealTimers());

describe("<Skeleton />", () => {
  test("shows nothing but its label to a screen reader at first, and the bars after the delay", () => {
    vi.useFakeTimers();
    const { container } = render(<Skeleton label="Loading entries" lines={2} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading entries");
    expect(container.querySelectorAll("[aria-hidden]")).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.querySelectorAll("[aria-hidden]")).toHaveLength(2);
  });
});
