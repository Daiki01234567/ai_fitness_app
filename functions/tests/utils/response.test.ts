/**
 * Response Utilities Tests
 * 
 * APIレスポンスフォーマット関数のユニットテスト
 * 参照仕様: docs/specs/03_API設計書_Firebase_Functions_v3_3.md
 */

import {
  success,
  successPaginated,
  isSuccessResponse,
  successEmpty,
  created,
  updated,
  deleted,
} from "../../src/utils/response";

describe("Response Utilities", () => {
  describe("success", () => {
    it("should create a success response with data", () => {
      const result = success({ id: "123", name: "Test" });

      expect(result).toEqual({
        success: true,
        data: { id: "123", name: "Test" },
      });
    });

    it("should create a success response with data and message", () => {
      const result = success({ id: "123" }, "操作が成功しました");

      expect(result).toEqual({
        success: true,
        data: { id: "123" },
        message: "操作が成功しました",
      });
    });

    it("should create a success response without message", () => {
      const result = success({ value: 42 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 42 });
      expect(result.message).toBeUndefined();
    });

    it("should handle null data", () => {
      const result = success(null);

      expect(result).toEqual({
        success: true,
        data: null,
      });
    });

    it("should handle empty array data", () => {
      const result = success([]);

      expect(result).toEqual({
        success: true,
        data: [],
      });
    });
  });

  describe("successPaginated", () => {
    it("should create paginated response with all fields", () => {
      const items = [{ id: "1" }, { id: "2" }];
      const result = successPaginated(items, "nextToken", 100, "取得しました");

      expect(result).toEqual({
        success: true,
        data: {
          items,
          nextPageToken: "nextToken",
          totalCount: 100,
        },
        message: "取得しました",
      });
    });

    it("should create paginated response without optional fields", () => {
      const items = [{ id: "1" }];
      const result = successPaginated(items);

      expect(result).toEqual({
        success: true,
        data: {
          items,
          nextPageToken: undefined,
          totalCount: undefined,
        },
      });
    });

    it("should create paginated response with empty items", () => {
      const result = successPaginated([]);

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual([]);
      expect(result.data.nextPageToken).toBeUndefined();
    });

    it("should create paginated response with nextPageToken only", () => {
      const items = [{ id: "1" }];
      const result = successPaginated(items, "token123");

      expect(result.data.nextPageToken).toBe("token123");
      expect(result.data.totalCount).toBeUndefined();
    });

    it("should create paginated response with totalCount only", () => {
      const items = [{ id: "1" }];
      const result = successPaginated(items, undefined, 50);

      expect(result.data.nextPageToken).toBeUndefined();
      expect(result.data.totalCount).toBe(50);
    });
  });

  describe("isSuccessResponse", () => {
    it("should return true for success response", () => {
      const response = { success: true, data: { id: "123" } };

      expect(isSuccessResponse(response)).toBe(true);
    });

    it("should return false for error response", () => {
      const response = { success: false, error: { message: "Error" } };

      expect(isSuccessResponse(response as any)).toBe(false);
    });

    it("should narrow type correctly", () => {
      const response = success({ value: 42 });

      if (isSuccessResponse(response)) {
        // Type should be narrowed to SuccessResponse
        expect(response.data.value).toBe(42);
      }
    });
  });

  describe("successEmpty", () => {
    it("should create empty success response without message", () => {
      const result = successEmpty();

      expect(result).toEqual({
        success: true,
        data: null,
      });
    });

    it("should create empty success response with message", () => {
      const result = successEmpty("完了しました");

      expect(result).toEqual({
        success: true,
        data: null,
        message: "完了しました",
      });
    });
  });

  describe("created", () => {
    it("should create a created response with default message", () => {
      const data = { id: "new-123", name: "New Item" };
      const result = created(data);

      expect(result).toEqual({
        success: true,
        data,
        message: "作成しました",
      });
    });

    it("should create a created response with custom message", () => {
      const data = { id: "new-123" };
      const result = created(data, "ユーザーを作成しました");

      expect(result).toEqual({
        success: true,
        data,
        message: "ユーザーを作成しました",
      });
    });
  });

  describe("updated", () => {
    it("should create an updated response with default message", () => {
      const data = { id: "123", name: "Updated" };
      const result = updated(data);

      expect(result).toEqual({
        success: true,
        data,
        message: "更新しました",
      });
    });

    it("should create an updated response with custom message", () => {
      const data = { id: "123" };
      const result = updated(data, "プロフィールを更新しました");

      expect(result).toEqual({
        success: true,
        data,
        message: "プロフィールを更新しました",
      });
    });
  });

  describe("deleted", () => {
    it("should create a deleted response with default message", () => {
      const result = deleted();

      expect(result).toEqual({
        success: true,
        data: null,
        message: "削除しました",
      });
    });

    it("should create a deleted response with custom message", () => {
      const result = deleted("アカウントを削除しました");

      expect(result).toEqual({
        success: true,
        data: null,
        message: "アカウントを削除しました",
      });
    });
  });
});
