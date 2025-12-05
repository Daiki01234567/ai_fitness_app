import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

/// PDFエクスポートサービスのプロバイダー
final pdfExportServiceProvider = Provider<PdfExportService>((ref) {
  return PdfExportService(
    firestore: FirebaseFirestore.instance,
    auth: FirebaseAuth.instance,
  );
});

/// PDFエクスポートの状態
enum PdfExportStatus {
  idle,
  collecting,
  generating,
  saving,
  completed,
  error,
}

/// PDFエクスポート結果
class PdfExportResult {
  final bool success;
  final String? filePath;
  final String? errorMessage;

  PdfExportResult({
    required this.success,
    this.filePath,
    this.errorMessage,
  });
}

/// GDPRデータポータビリティ用PDFエクスポートサービス
///
/// ユーザーの個人データをPDF形式でエクスポートする機能を提供
/// GDPR第20条（データポータビリティの権利）に基づく
class PdfExportService {
  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  PdfExportService({
    required FirebaseFirestore firestore,
    required FirebaseAuth auth,
  })  : _firestore = firestore,
        _auth = auth;

  /// ユーザーデータをPDF形式でエクスポート
  ///
  /// [onStatusChanged] 進捗状況のコールバック
  /// Returns: エクスポート結果（ファイルパスまたはエラー）
  Future<PdfExportResult> exportUserDataToPdf({
    void Function(PdfExportStatus status, String message)? onStatusChanged,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        return PdfExportResult(
          success: false,
          errorMessage: 'ユーザーが認証されていません',
        );
      }

      // 1. データ収集
      onStatusChanged?.call(PdfExportStatus.collecting, 'データを収集中...');
      final userData = await _collectUserData(user.uid);

      // 2. PDF生成
      onStatusChanged?.call(PdfExportStatus.generating, 'PDFを生成中...');
      final pdfBytes = await _generatePdf(userData, user);

      // 3. ファイル保存
      onStatusChanged?.call(PdfExportStatus.saving, 'ファイルを保存中...');
      final filePath = await _savePdfToFile(pdfBytes, user.uid);

      onStatusChanged?.call(PdfExportStatus.completed, 'エクスポート完了');
      return PdfExportResult(
        success: true,
        filePath: filePath,
      );
    } catch (e) {
      onStatusChanged?.call(PdfExportStatus.error, 'エラー: $e');
      return PdfExportResult(
        success: false,
        errorMessage: e.toString(),
      );
    }
  }

  /// 収集したユーザーデータ
  Future<Map<String, dynamic>> _collectUserData(String userId) async {
    final data = <String, dynamic>{};

    // プロフィール情報
    try {
      final userDoc = await _firestore.collection('users').doc(userId).get();
      if (userDoc.exists) {
        data['profile'] = _sanitizeData(userDoc.data() ?? {});
      }
    } catch (e) {
      data['profile'] = {'error': 'プロフィール取得エラー: $e'};
    }

    // トレーニングセッション（最新100件）
    try {
      final sessionsQuery = await _firestore
          .collection('users')
          .doc(userId)
          .collection('sessions')
          .orderBy('createdAt', descending: true)
          .limit(100)
          .get();
      data['sessions'] = sessionsQuery.docs
          .map((doc) => _sanitizeData(doc.data()))
          .toList();
    } catch (e) {
      data['sessions'] = [];
    }

    // 同意履歴
    try {
      final consentsQuery = await _firestore
          .collection('users')
          .doc(userId)
          .collection('consents')
          .orderBy('timestamp', descending: true)
          .get();
      data['consents'] = consentsQuery.docs
          .map((doc) => _sanitizeData(doc.data()))
          .toList();
    } catch (e) {
      data['consents'] = [];
    }

    // 設定情報
    try {
      final settingsDoc = await _firestore
          .collection('users')
          .doc(userId)
          .collection('settings')
          .doc('preferences')
          .get();
      if (settingsDoc.exists) {
        data['settings'] = _sanitizeData(settingsDoc.data() ?? {});
      }
    } catch (e) {
      data['settings'] = {};
    }

    return data;
  }

  /// Firestore Timestampを文字列に変換
  Map<String, dynamic> _sanitizeData(Map<String, dynamic> data) {
    final sanitized = <String, dynamic>{};
    for (final entry in data.entries) {
      if (entry.value is Timestamp) {
        sanitized[entry.key] =
            (entry.value as Timestamp).toDate().toIso8601String();
      } else if (entry.value is Map) {
        sanitized[entry.key] =
            _sanitizeData(Map<String, dynamic>.from(entry.value as Map));
      } else if (entry.value is List) {
        sanitized[entry.key] = (entry.value as List).map((item) {
          if (item is Map) {
            return _sanitizeData(Map<String, dynamic>.from(item));
          } else if (item is Timestamp) {
            return item.toDate().toIso8601String();
          }
          return item;
        }).toList();
      } else {
        sanitized[entry.key] = entry.value;
      }
    }
    return sanitized;
  }

  /// PDFドキュメントを生成
  Future<Uint8List> _generatePdf(
      Map<String, dynamic> userData, User user) async {
    final pdf = pw.Document();
    final dateFormat = DateFormat('yyyy/MM/dd HH:mm:ss');
    final now = DateTime.now();

    // 日本語フォントのロード（システムフォント使用）
    // Note: 本番環境では適切な日本語フォントをアセットとして追加する必要あり
    final font = pw.Font.helvetica();
    final fontBold = pw.Font.helveticaBold();

    // 表紙ページ
    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Center(
              child: pw.Text(
                'Personal Data Export',
                style: pw.TextStyle(font: fontBold, fontSize: 24),
              ),
            ),
            pw.SizedBox(height: 20),
            pw.Center(
              child: pw.Text(
                'AI Fitness App - GDPR Data Portability',
                style: pw.TextStyle(font: font, fontSize: 14),
              ),
            ),
            pw.SizedBox(height: 40),
            pw.Divider(),
            pw.SizedBox(height: 20),
            _buildInfoRow('Export Date:', dateFormat.format(now), font),
            _buildInfoRow('User ID:', user.uid, font),
            _buildInfoRow('Email:', user.email ?? 'N/A', font),
            pw.SizedBox(height: 40),
            pw.Text(
              'Contents:',
              style: pw.TextStyle(font: fontBold, fontSize: 14),
            ),
            pw.SizedBox(height: 10),
            pw.Text('1. Profile Information', style: pw.TextStyle(font: font)),
            pw.Text('2. Training Sessions', style: pw.TextStyle(font: font)),
            pw.Text('3. Consent History', style: pw.TextStyle(font: font)),
            pw.Text('4. Settings', style: pw.TextStyle(font: font)),
            pw.SizedBox(height: 40),
            pw.Container(
              padding: const pw.EdgeInsets.all(10),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColors.grey),
              ),
              child: pw.Text(
                'This document contains your personal data as stored in AI Fitness App. '
                'This export is provided in accordance with GDPR Article 20 (Right to Data Portability).',
                style: pw.TextStyle(font: font, fontSize: 10),
              ),
            ),
          ],
        ),
      ),
    );

    // プロフィール情報ページ
    final profile = userData['profile'] as Map<String, dynamic>?;
    if (profile != null && profile.isNotEmpty) {
      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('1. Profile Information',
                  style: pw.TextStyle(font: fontBold, fontSize: 18)),
              pw.SizedBox(height: 20),
              ..._buildDataSection(profile, font),
            ],
          ),
        ),
      );
    }

    // トレーニングセッションページ
    final sessions = userData['sessions'] as List? ?? [];
    if (sessions.isNotEmpty) {
      pdf.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          build: (context) => [
            pw.Text('2. Training Sessions (${sessions.length} records)',
                style: pw.TextStyle(font: fontBold, fontSize: 18)),
            pw.SizedBox(height: 20),
            ...sessions.take(50).map((session) {
              final sessionData = session as Map<String, dynamic>;
              return pw.Container(
                margin: const pw.EdgeInsets.only(bottom: 15),
                padding: const pw.EdgeInsets.all(10),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(color: PdfColors.grey300),
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: _buildDataSection(sessionData, font),
                ),
              );
            }),
            if (sessions.length > 50)
              pw.Text(
                '... and ${sessions.length - 50} more sessions',
                style: pw.TextStyle(font: font, fontStyle: pw.FontStyle.italic),
              ),
          ],
        ),
      );
    }

    // 同意履歴ページ
    final consents = userData['consents'] as List? ?? [];
    if (consents.isNotEmpty) {
      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('3. Consent History',
                  style: pw.TextStyle(font: fontBold, fontSize: 18)),
              pw.SizedBox(height: 20),
              ...consents.map((consent) {
                final consentData = consent as Map<String, dynamic>;
                return pw.Container(
                  margin: const pw.EdgeInsets.only(bottom: 10),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: _buildDataSection(consentData, font),
                  ),
                );
              }),
            ],
          ),
        ),
      );
    }

    // 設定情報ページ
    final settings = userData['settings'] as Map<String, dynamic>?;
    if (settings != null && settings.isNotEmpty) {
      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('4. Settings',
                  style: pw.TextStyle(font: fontBold, fontSize: 18)),
              pw.SizedBox(height: 20),
              ..._buildDataSection(settings, font),
            ],
          ),
        ),
      );
    }

    return pdf.save();
  }

  /// 情報行を構築
  pw.Widget _buildInfoRow(String label, String value, pw.Font font) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 4),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 100,
            child: pw.Text(label, style: pw.TextStyle(font: font)),
          ),
          pw.Expanded(
            child: pw.Text(value, style: pw.TextStyle(font: font)),
          ),
        ],
      ),
    );
  }

  /// データセクションを構築
  List<pw.Widget> _buildDataSection(Map<String, dynamic> data, pw.Font font) {
    return data.entries.map((entry) {
      final value = entry.value;
      String displayValue;

      if (value is Map) {
        displayValue = value.entries
            .map((e) => '${e.key}: ${e.value}')
            .join(', ');
      } else if (value is List) {
        displayValue = '[${value.length} items]';
      } else {
        displayValue = value?.toString() ?? 'N/A';
      }

      return pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 2),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.SizedBox(
              width: 150,
              child: pw.Text(
                '${entry.key}:',
                style: pw.TextStyle(font: font, fontSize: 10),
              ),
            ),
            pw.Expanded(
              child: pw.Text(
                displayValue,
                style: pw.TextStyle(font: font, fontSize: 10),
              ),
            ),
          ],
        ),
      );
    }).toList();
  }

  /// PDFをファイルに保存
  Future<String> _savePdfToFile(Uint8List pdfBytes, String userId) async {
    final directory = await getApplicationDocumentsDirectory();
    final timestamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
    final fileName = 'ai_fitness_export_$timestamp.pdf';
    final filePath = '${directory.path}/$fileName';

    final file = File(filePath);
    await file.writeAsBytes(pdfBytes);

    return filePath;
  }

  /// PDFファイルを開く
  Future<void> openPdf(String filePath) async {
    await OpenFilex.open(filePath);
  }

  /// PDFファイルを共有
  Future<void> sharePdf(String filePath) async {
    await Share.shareXFiles(
      [XFile(filePath)],
      subject: 'AI Fitness App - Personal Data Export',
    );
  }

  /// エクスポートしたファイルを削除（クリーンアップ用）
  Future<void> deleteExportFile(String filePath) async {
    final file = File(filePath);
    if (await file.exists()) {
      await file.delete();
    }
  }
}
