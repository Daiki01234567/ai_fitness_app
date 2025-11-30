/**
 * Final Coverage Tests
 * Tests to achieve remaining coverage for utils layer
 */

import { ValidationError } from "../../src/utils/errors";
import { validatePageToken } from "../../src/utils/validation";

describe("Final Coverage Tests", () => {
  describe("validatePageToken catch block", () => {
    it("should handle Buffer.from throwing an error", () => {
      const originalFrom = Buffer.from;
      Buffer.from = jest.fn(() => {
        throw new Error("Invalid base64");
      }) as any;
      
      try {
        expect(() => validatePageToken("test")).toThrow(ValidationError);
        expect(() => validatePageToken("test")).toThrow("pageToken");
      } finally {
        Buffer.from = originalFrom;
      }
    });
  });
});
