import { describe, it, expect, beforeEach, jest } from "bun:test";
import { isTokenExpiringSoon, refreshAccessToken, ensureValidToken } from "../src/token-refresh";
import type { OAuthCredentials } from "../src/setup-oauth";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe("Token Refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isTokenExpiringSoon", () => {
    it("should return true if token expires within buffer time", () => {
      const now = Math.floor(Date.now() / 1000);
      const credentials: OAuthCredentials = {
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAt: String(now + 300), // expires in 5 minutes
      };

      expect(isTokenExpiringSoon(credentials, 10)).toBe(true);
    });

    it("should return false if token expires after buffer time", () => {
      const now = Math.floor(Date.now() / 1000);
      const credentials: OAuthCredentials = {
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAt: String(now + 900), // expires in 15 minutes
      };

      expect(isTokenExpiringSoon(credentials, 10)).toBe(false);
    });

    it("should use default buffer of 10 minutes", () => {
      const now = Math.floor(Date.now() / 1000);
      const credentials: OAuthCredentials = {
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAt: String(now + 300), // expires in 5 minutes
      };

      expect(isTokenExpiringSoon(credentials)).toBe(true);
    });
  });

  describe("refreshAccessToken", () => {
    it("should successfully refresh token", async () => {
      const mockResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await refreshAccessToken("old-refresh-token");

      expect(fetch).toHaveBeenCalledWith("https://api.anthropic.com/v1/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "old-refresh-token",
        }),
      });

      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("new-refresh-token");
      expect(parseInt(result.expiresAt)).toBeCloseTo(Math.floor(Date.now() / 1000) + 3600, -1);
    });

    it("should throw error on failed refresh", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid refresh token"),
      });

      await expect(refreshAccessToken("invalid-token")).rejects.toThrow(
        "Token refresh failed: 400 Bad Request"
      );
    });
  });

  describe("ensureValidToken", () => {
    it("should return original credentials if not expiring", async () => {
      const now = Math.floor(Date.now() / 1000);
      const credentials: OAuthCredentials = {
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAt: String(now + 900), // expires in 15 minutes
      };

      const result = await ensureValidToken(credentials);
      expect(result).toBe(credentials);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should refresh token if expiring soon", async () => {
      const now = Math.floor(Date.now() / 1000);
      const credentials: OAuthCredentials = {
        accessToken: "old-token",
        refreshToken: "old-refresh",
        expiresAt: String(now + 300), // expires in 5 minutes
      };

      const mockResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await ensureValidToken(credentials);

      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("new-refresh-token");
      expect(fetch).toHaveBeenCalled();
    });
  });
});