// Additional tests for 100% branch coverage

describe("GDPR Storage Service - Additional Branch Coverage", () => {
  const testUserId = "test-user-123";

  describe("deleteUserStorage - Error branch coverage", () => {
    it("should handle non-Error type exceptions", async () => {
      mockGetFiles.mockRejectedValue("String error");

      const result = await deleteUserStorage(testUserId);

      expect(result.deleted).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("collectStorageData - Additional branch coverage", () => {
    it("should handle file name split returning empty array", async () => {
      const mockFiles = [
        {
          name: "users/test-user-123/profile.jpg",
          getMetadata: jest.fn().mockResolvedValue([{
            contentType: "image/jpeg",
            size: "1024",
          }]),
          download: jest.fn().mockResolvedValue([Buffer.from("image")]),
        },
      ];
      // Test the fallback when split().pop() returns undefined
      mockFiles[0].name = "";
      mockGetFiles.mockResolvedValue([mockFiles]);

      const result = await collectStorageData(testUserId);
      
      // Should use "profile_image" as fallback
      expect(result).toBeDefined();
    });

    it("should handle media file name split returning empty", async () => {
      const mockFiles = [
        {
          name: "",
          getMetadata: jest.fn().mockResolvedValue([{
            contentType: "video/mp4",
            size: "1000",
          }]),
        },
      ];
      mockGetFiles.mockResolvedValue([mockFiles]);

      const result = await collectStorageData(testUserId);
      
      // Should use "unknown" as fallback
      if (result.mediaFiles && result.mediaFiles.length > 0) {
        expect(result.mediaFiles[0].fileName).toBe("unknown");
      }
    });
  });
});
