import { describe, it, expect } from "vitest";
import { getRandomUserAgent, getUserAgentCount } from "../services/user-agents.js";

describe("User-Agent rotation", () => {
  it("should return a non-empty string", () => {
    const ua = getRandomUserAgent();
    expect(ua).toBeTruthy();
    expect(typeof ua).toBe("string");
  });

  it("should have multiple user agents available", () => {
    expect(getUserAgentCount()).toBeGreaterThan(1);
  });

  it("should not return the same user agent twice in a row", () => {
    const results = new Set<string>();
    let previous = getRandomUserAgent();

    for (let i = 0; i < 50; i++) {
      const current = getRandomUserAgent();
      // Should never be the same as the previous one
      expect(current).not.toBe(previous);
      results.add(current);
      previous = current;
    }

    // Over 50 calls, we should see multiple distinct user agents
    expect(results.size).toBeGreaterThan(1);
  });

  it("should return valid browser user agent strings", () => {
    const ua = getRandomUserAgent();
    expect(ua).toMatch(/Mozilla\/5\.0/);
  });
});
