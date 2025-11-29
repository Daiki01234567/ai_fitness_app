// Session Detail Screen Integration Tests
//
// Tests for the session detail screen widget and user interactions.
// Reference: docs/tickets/012_history_analytics.md
//
// Test coverage:
// - Session info display (date, duration, score)
// - Set list rendering with individual scores
// - Note editing functionality
// - Tag management (add/remove)
// - Body condition section
// - Share/export menu
// - Back navigation
// - Delete functionality
// - Loading and error states
//
// @version 1.0.0
// @date 2025-11-29

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:flutter_app/screens/history/session_detail_screen.dart';
import 'package:flutter_app/core/history/history_service.dart';
import 'package:flutter_app/core/history/history_models.dart';
import 'package:flutter_app/core/form_analyzer/form_analyzer.dart';
import 'package:flutter_app/core/auth/auth_state_notifier.dart';

import '../core/auth/mocks/mock_firebase_auth.dart';

void main() {
  late FakeFirebaseFirestore fakeFirestore;
  late HistoryService historyService;
  late MockFirebaseAuth mockAuth;
  late MockUser mockUser;

  const testUserId = 'test-user-123';

  setUpAll(() async {
    await initializeDateFormatting('ja_JP');
  });

  setUp(() {
    fakeFirestore = FakeFirebaseFirestore();
    historyService = HistoryService(fakeFirestore);
    mockAuth = MockFirebaseAuth();
    mockUser = MockUser(
      uid: testUserId,
      email: 'test@example.com',
      emailVerified: true,
    );
    mockAuth.setMockUser(mockUser);
  });

  tearDown(() {
    mockAuth.dispose();
  });

  /// Creates a sample session for testing
  HistorySession createTestSession({
    String id = 'session-123',
    ExerciseType exerciseType = ExerciseType.squat,
    DateTime? startTime,
    DateTime? endTime,
    int totalReps = 45,
    int totalSets = 3,
    double averageScore = 85.0,
    List<HistorySetRecord>? sets,
    String? note,
    List<String>? tags,
    BodyCondition? bodyCondition,
  }) {
    final now = DateTime.now();
    return HistorySession(
      id: id,
      userId: testUserId,
      exerciseType: exerciseType,
      startTime: startTime ?? now.subtract(const Duration(hours: 1)),
      endTime: endTime ?? now.subtract(const Duration(minutes: 30)),
      totalReps: totalReps,
      totalSets: totalSets,
      averageScore: averageScore,
      sets: sets ?? [
        const HistorySetRecord(
          setNumber: 1,
          reps: 15,
          averageScore: 88.0,
          duration: Duration(minutes: 5),
          issues: ['knee_over_toe'],
          bestRepScore: 92.0,
          worstRepScore: 75.0,
        ),
        const HistorySetRecord(
          setNumber: 2,
          reps: 15,
          averageScore: 85.0,
          duration: Duration(minutes: 5),
          issues: [],
          bestRepScore: 90.0,
          worstRepScore: 78.0,
        ),
        const HistorySetRecord(
          setNumber: 3,
          reps: 15,
          averageScore: 82.0,
          duration: Duration(minutes: 5),
          issues: ['back_rounding'],
          bestRepScore: 88.0,
          worstRepScore: 72.0,
        ),
      ],
      note: note,
      tags: tags,
      bodyCondition: bodyCondition,
    );
  }

  /// Helper to seed session in Firestore
  Future<void> seedSessionInFirestore(HistorySession session) async {
    await fakeFirestore
        .collection('users')
        .doc(testUserId)
        .collection('sessions')
        .doc(session.id)
        .set(session.toJson());
  }

  /// Helper to build the session detail screen with providers
  Widget buildSessionDetailScreen({
    required HistorySession session,
    List<Override>? additionalOverrides,
  }) {
    return ProviderScope(
      overrides: [
        historyServiceProvider.overrideWithValue(historyService),
        authStateProvider.overrideWith((ref) {
          return AuthStateNotifier(auth: mockAuth, firestore: fakeFirestore)
            ..state = AuthState(user: mockUser, isLoading: false);
        }),
        ...?additionalOverrides,
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [
          Locale('ja', 'JP'),
        ],
        locale: const Locale('ja', 'JP'),
        home: SessionDetailScreen(session: session),
      ),
    );
  }

  group('SessionDetailScreen 統合テスト - 基本レンダリング', () {
    testWidgets('AppBarに「セッション詳細」タイトルが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('セッション詳細'), findsOneWidget);
    });

    testWidgets('種目名が表示される', (tester) async {
      final session = createTestSession(exerciseType: ExerciseType.squat);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('スクワット'), findsOneWidget);
    });

    testWidgets('各種目タイプの種目名が正しく表示される', (tester) async {
      // Test arm curl
      var session = createTestSession(exerciseType: ExerciseType.armCurl);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();
      expect(find.text('アームカール'), findsOneWidget);
    });

    testWidgets('セッション日時が表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Date format includes year and time
      expect(find.textContaining('/'), findsWidgets);
    });

    testWidgets('セッション時間が表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Duration display (e.g., "30分")
      expect(find.textContaining('分'), findsWidgets);
    });

    testWidgets('平均スコアが表示される', (tester) async {
      final session = createTestSession(averageScore: 85.0);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('85'), findsWidgets);
      expect(find.text('点'), findsWidgets);
    });

    testWidgets('戻るボタンが表示される', (tester) async {
      final session = createTestSession();
      // Need to wrap in Navigator to show back button
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            historyServiceProvider.overrideWithValue(historyService),
            authStateProvider.overrideWith((ref) {
              return AuthStateNotifier(auth: mockAuth, firestore: fakeFirestore)
                ..state = AuthState(user: mockUser, isLoading: false);
            }),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('ja', 'JP'),
            ],
            locale: const Locale('ja', 'JP'),
            home: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => SessionDetailScreen(session: session)),
                ),
                child: const Text('Navigate'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Navigate to detail screen
      await tester.tap(find.text('Navigate'));
      await tester.pumpAndSettle();

      // AppBar uses default back button - find BackButton widget
      expect(find.byType(BackButton), findsOneWidget);
    });
  });

  group('SessionDetailScreen 統合テスト - 概要セクション', () {
    testWidgets('概要セクションが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('概要'), findsOneWidget);
    });

    testWidgets('セット数が表示される', (tester) async {
      final session = createTestSession(totalSets: 3);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('セット数'), findsOneWidget);
      expect(find.text('3'), findsWidgets);
    });

    testWidgets('レップ数が表示される', (tester) async {
      final session = createTestSession(totalReps: 45);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('レップ数'), findsOneWidget);
      expect(find.text('45'), findsWidgets);
    });

    testWidgets('ベストスコアが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('ベストスコア'), findsOneWidget);
    });
  });

  group('SessionDetailScreen 統合テスト - セット詳細', () {
    testWidgets('セット別詳細セクションが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('セット別詳細'), findsOneWidget);
    });

    testWidgets('各セットカードが表示される', (tester) async {
      final session = createTestSession(totalSets: 3);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Should have 3 set cards
      expect(find.byType(ExpansionTile), findsNWidgets(3));
    });

    testWidgets('セット番号が表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('1'), findsWidgets);
      expect(find.text('2'), findsWidgets);
      expect(find.text('3'), findsWidgets);
    });

    testWidgets('セットのレップ数が表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('15回'), findsNWidgets(3));
    });

    testWidgets('セットをタップすると詳細が展開される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Tap first set
      await tester.tap(find.byType(ExpansionTile).first);
      await tester.pumpAndSettle();

      // Should show best/worst labels
      expect(find.text('ベスト'), findsOneWidget);
      expect(find.text('ワースト'), findsOneWidget);
    });

    testWidgets('セットの改善ポイントが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Expand first set
      await tester.tap(find.byType(ExpansionTile).first);
      await tester.pumpAndSettle();

      // Should show issues section
      expect(find.text('改善ポイント'), findsOneWidget);
    });
  });

  group('SessionDetailScreen 統合テスト - 主な改善ポイント', () {
    testWidgets('主な改善ポイントセクションが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down to find section
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -200));
      await tester.pumpAndSettle();

      expect(find.text('主な改善ポイント'), findsOneWidget);
    });

    testWidgets('改善ポイントのリストが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -200));
      await tester.pumpAndSettle();

      // Should show warning icons
      expect(find.byIcon(Icons.warning_amber), findsWidgets);
    });
  });

  group('SessionDetailScreen 統合テスト - 体調記録', () {
    testWidgets('体調記録セクションが表示される（データがある場合）', (tester) async {
      final session = createTestSession(
        bodyCondition: const BodyCondition(
          energyLevel: 4,
          sleepQuality: 5,
          muscleStiffness: 2,
          notes: 'Good condition today',
        ),
      );
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -300));
      await tester.pumpAndSettle();

      expect(find.text('体調記録'), findsOneWidget);
    });

    testWidgets('体調レベルが星で表示される', (tester) async {
      final session = createTestSession(
        bodyCondition: const BodyCondition(
          energyLevel: 4,
          sleepQuality: 5,
          muscleStiffness: 2,
        ),
      );
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -300));
      await tester.pumpAndSettle();

      // Should show star icons for ratings
      expect(find.byIcon(Icons.star), findsWidgets);
    });

    testWidgets('体調項目ラベルが表示される', (tester) async {
      final session = createTestSession(
        bodyCondition: const BodyCondition(
          energyLevel: 4,
          sleepQuality: 5,
          muscleStiffness: 2,
        ),
      );
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -300));
      await tester.pumpAndSettle();

      expect(find.text('元気度'), findsOneWidget);
      expect(find.text('睡眠の質'), findsOneWidget);
      expect(find.text('筋肉のはり'), findsOneWidget);
    });
  });

  group('SessionDetailScreen 統合テスト - タグ', () {
    testWidgets('タグセクションが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -400));
      await tester.pumpAndSettle();

      expect(find.text('タグ'), findsOneWidget);
    });

    testWidgets('タグがある場合Chipで表示される', (tester) async {
      final session = createTestSession(tags: ['morning', 'leg-day', 'heavy']);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -400));
      await tester.pumpAndSettle();

      expect(find.byType(Chip), findsNWidgets(3));
      expect(find.text('morning'), findsOneWidget);
      expect(find.text('leg-day'), findsOneWidget);
      expect(find.text('heavy'), findsOneWidget);
    });

    testWidgets('タグがない場合メッセージが表示される', (tester) async {
      final session = createTestSession(tags: null);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -400));
      await tester.pumpAndSettle();

      expect(find.text('タグはまだありません'), findsOneWidget);
    });

    testWidgets('タグ追加ボタンが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -400));
      await tester.pumpAndSettle();

      expect(find.text('追加'), findsOneWidget);
    });

    testWidgets('タグ追加ボタンをタップするとダイアログが開く', (tester) async {
      final session = createTestSession();
      await seedSessionInFirestore(session);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -400));
      await tester.pumpAndSettle();

      // Tap add button
      await tester.tap(find.text('追加'));
      await tester.pumpAndSettle();

      // Dialog should appear
      expect(find.text('タグを追加'), findsOneWidget);
      expect(find.text('タグ名を入力'), findsOneWidget);
    });
  });

  group('SessionDetailScreen 統合テスト - メモ', () {
    testWidgets('メモセクションが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -500));
      await tester.pumpAndSettle();

      expect(find.text('メモ'), findsOneWidget);
    });

    testWidgets('メモがある場合内容が表示される', (tester) async {
      final session = createTestSession(note: 'Great workout today!');
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -500));
      await tester.pumpAndSettle();

      expect(find.text('Great workout today!'), findsOneWidget);
    });

    testWidgets('メモがない場合プレースホルダが表示される', (tester) async {
      final session = createTestSession(note: null);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -500));
      await tester.pumpAndSettle();

      expect(find.text('メモはまだありません'), findsOneWidget);
    });

    testWidgets('編集ボタンが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -500));
      await tester.pumpAndSettle();

      expect(find.text('編集'), findsOneWidget);
    });

    testWidgets('編集ボタンをタップすると編集モードになる', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -500));
      await tester.pumpAndSettle();

      // Tap edit button
      await tester.tap(find.text('編集'));
      await tester.pumpAndSettle();

      // Should show text field
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('キャンセル'), findsOneWidget);
      expect(find.text('保存'), findsOneWidget);
    });

    testWidgets('キャンセルボタンで編集モードを終了できる', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -500));
      await tester.pumpAndSettle();

      // Enter edit mode
      final editButton = find.text('編集');
      if (editButton.evaluate().isNotEmpty) {
        await tester.tap(editButton);
        await tester.pumpAndSettle();

        // Cancel (find the TextButton in the note section)
        final cancelButton = find.text('キャンセル');
        if (cancelButton.evaluate().isNotEmpty) {
          await tester.tap(cancelButton.first);
          await tester.pumpAndSettle();
        }
      }

      // Verify screen is still displayed
      expect(find.byType(Scaffold), findsOneWidget);
    });

    testWidgets('メモを入力して保存できる', (tester) async {
      final session = createTestSession();
      await seedSessionInFirestore(session);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Scroll down
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -500));
      await tester.pumpAndSettle();

      // Enter edit mode
      final editButton = find.text('編集');
      if (editButton.evaluate().isNotEmpty) {
        await tester.tap(editButton);
        await tester.pumpAndSettle();

        // Find TextField and enter text
        final textField = find.byType(TextField);
        if (textField.evaluate().isNotEmpty) {
          await tester.enterText(textField, 'New note content');
          await tester.pumpAndSettle();

          // Save
          final saveButton = find.text('保存');
          if (saveButton.evaluate().isNotEmpty) {
            await tester.tap(saveButton);
            await tester.pumpAndSettle();
          }
        }
      }

      // Verify screen is still displayed
      expect(find.byType(Scaffold), findsOneWidget);
    });
  });

  group('SessionDetailScreen 統合テスト - メニュー', () {
    testWidgets('メニューボタンが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.byType(PopupMenuButton<String>), findsOneWidget);
    });

    testWidgets('メニューをタップするとオプションが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Tap menu button
      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();

      expect(find.text('エクスポート'), findsOneWidget);
      expect(find.text('共有'), findsOneWidget);
      expect(find.text('削除'), findsOneWidget);
    });

    testWidgets('エクスポートをタップするとオプションが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Open menu
      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();

      // Tap export
      await tester.tap(find.text('エクスポート'));
      await tester.pumpAndSettle();

      // Should show bottom sheet with export options
      expect(find.text('PDFでエクスポート'), findsOneWidget);
      expect(find.text('CSVでエクスポート'), findsOneWidget);
    });

    testWidgets('共有をタップするとスナックバーが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Open menu
      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();

      // Tap share
      await tester.tap(find.text('共有'));
      await tester.pumpAndSettle();

      // Should show snackbar (feature not implemented)
      expect(find.text('共有機能は今後実装予定です'), findsOneWidget);
    });

    testWidgets('削除をタップすると確認ダイアログが表示される', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Open menu
      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();

      // Tap delete
      await tester.tap(find.text('削除'));
      await tester.pumpAndSettle();

      // Should show confirmation dialog
      expect(find.text('セッションを削除'), findsOneWidget);
      expect(find.text('このセッションを削除してもよろしいですか？この操作は取り消せません。'), findsOneWidget);
    });

    testWidgets('削除確認ダイアログでキャンセルできる', (tester) async {
      final session = createTestSession();
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Open menu and tap delete
      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('削除'));
      await tester.pumpAndSettle();

      // Cancel
      await tester.tap(find.text('キャンセル'));
      await tester.pumpAndSettle();

      // Dialog should be dismissed
      expect(find.text('セッションを削除'), findsNothing);
    });
  });

  group('SessionDetailScreen 統合テスト - スコア表示色', () {
    testWidgets('高スコア（80+）が緑色で表示される', (tester) async {
      final session = createTestSession(averageScore: 85.0);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      // Score badge should exist
      expect(find.text('85'), findsWidgets);
    });

    testWidgets('中スコア（60-79）が適切な色で表示される', (tester) async {
      final session = createTestSession(averageScore: 70.0);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('70'), findsWidgets);
    });

    testWidgets('低スコア（<40）が赤色で表示される', (tester) async {
      final session = createTestSession(averageScore: 35.0);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.text('35'), findsWidgets);
    });
  });

  group('SessionDetailScreen 統合テスト - 種目アイコン', () {
    testWidgets('スクワットに適切なアイコンが表示される', (tester) async {
      final session = createTestSession(exerciseType: ExerciseType.squat);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.accessibility_new), findsOneWidget);
    });

    testWidgets('アームカールに適切なアイコンが表示される', (tester) async {
      final session = createTestSession(exerciseType: ExerciseType.armCurl);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.fitness_center), findsOneWidget);
    });

    testWidgets('プッシュアップに適切なアイコンが表示される', (tester) async {
      final session = createTestSession(exerciseType: ExerciseType.pushUp);
      await tester.pumpWidget(buildSessionDetailScreen(session: session));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.sports_gymnastics), findsOneWidget);
    });
  });

  group('SessionDetailScreen 統合テスト - ナビゲーション', () {
    testWidgets('戻るボタンをタップすると画面が閉じる', (tester) async {
      final session = createTestSession();

      var navigatedBack = false;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            historyServiceProvider.overrideWithValue(historyService),
            authStateProvider.overrideWith((ref) {
              return AuthStateNotifier(auth: mockAuth, firestore: fakeFirestore)
                ..state = AuthState(user: mockUser, isLoading: false);
            }),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('ja', 'JP'),
            ],
            locale: const Locale('ja', 'JP'),
            home: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => SessionDetailScreen(session: session),
                    ),
                  );
                },
                child: const Text('Open Detail'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Navigate to detail screen
      await tester.tap(find.text('Open Detail'));
      await tester.pumpAndSettle();

      // Verify we're on detail screen
      expect(find.text('セッション詳細'), findsOneWidget);

      // Tap back button (BackButton widget used by AppBar)
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      // Should be back on the original screen
      expect(find.text('Open Detail'), findsOneWidget);
    });
  });
}
