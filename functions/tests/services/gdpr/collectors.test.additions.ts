// Additional tests for 90%+ coverage of collectors.ts
// 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md

describe("GDPR Collectors - Additional Coverage", () => {
  const testUserId = "test-user-123";

  describe("collectProfileData - Additional branch coverage", () => {
    it("should return null when user does not exist", async () => {
      const { userRef } = require("../../../src/utils/firestore");
      const { collectProfileData } = require("../../../src/services/gdpr/collectors");
      
      userRef.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
      });

      const result = await collectProfileData(testUserId);
      expect(result).toBeNull();
    });
  });
});
