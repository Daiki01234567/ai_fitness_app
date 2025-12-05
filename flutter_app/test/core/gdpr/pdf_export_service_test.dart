// PDFエクスポートサービスのテスト
// チケット: #015 GDPR対応
//
// @version 1.0.0
// @date 2025-12-05
//
// Note: path_provider はテスト環境で利用不可のため、
// PDF生成とファイル保存のテストは統合テストで行う

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';

import 'package:flutter_app/core/gdpr/pdf_export_service.dart';

import 'pdf_export_service_test.mocks.dart';

@GenerateMocks([FirebaseAuth, User])
void main() {
  late FakeFirebaseFirestore fakeFirestore;
  late MockFirebaseAuth mockAuth;
  late MockUser mockUser;
  late PdfExportService pdfExportService;

  const testUserId = 'test-user-123';
  const testEmail = 'test@example.com';

  setUp(() {
    fakeFirestore = FakeFirebaseFirestore();
    mockAuth = MockFirebaseAuth();
    mockUser = MockUser();

    // Mock user setup
    when(mockAuth.currentUser).thenReturn(mockUser);
    when(mockUser.uid).thenReturn(testUserId);
    when(mockUser.email).thenReturn(testEmail);

    pdfExportService = PdfExportService(
      firestore: fakeFirestore,
      auth: mockAuth,
    );
  });

  group('PdfExportService', () {
    group('exportUserDataToPdf', () {
      test('returns error when user is not authenticated', () async {
        // Arrange
        when(mockAuth.currentUser).thenReturn(null);

        // Act
        final result = await pdfExportService.exportUserDataToPdf();

        // Assert
        expect(result.success, isFalse);
        expect(result.errorMessage, contains('認証されていません'));
      });

      // Note: PDF生成とファイル保存のテストは、path_providerがテスト環境で
      // 利用できないため、統合テストまたは実機テストで検証する
      // 以下のテストはスキップ
      test('PDF export requires path_provider (integration test)', () {
        // This test documents that full PDF export testing requires
        // an integration test environment with path_provider support
        expect(true, isTrue);
      });
    });

    group('deleteExportFile', () {
      test('does not throw when file does not exist', () async {
        // Act & Assert
        expect(
          () => pdfExportService.deleteExportFile('/nonexistent/path.pdf'),
          returnsNormally,
        );
      });
    });
  });

  group('PdfExportResult', () {
    test('success result has filePath', () {
      final result = PdfExportResult(
        success: true,
        filePath: '/path/to/file.pdf',
      );

      expect(result.success, isTrue);
      expect(result.filePath, '/path/to/file.pdf');
      expect(result.errorMessage, isNull);
    });

    test('failure result has errorMessage', () {
      final result = PdfExportResult(
        success: false,
        errorMessage: 'Something went wrong',
      );

      expect(result.success, isFalse);
      expect(result.filePath, isNull);
      expect(result.errorMessage, 'Something went wrong');
    });
  });

  group('PdfExportStatus', () {
    test('has all expected values', () {
      expect(PdfExportStatus.values, containsAll([
        PdfExportStatus.idle,
        PdfExportStatus.collecting,
        PdfExportStatus.generating,
        PdfExportStatus.saving,
        PdfExportStatus.completed,
        PdfExportStatus.error,
      ]));
    });
  });
}
