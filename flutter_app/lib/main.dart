// AI Fitness App - メインエントリーポイント
//
// @version 1.1.0
// @date 2025-11-28

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'firebase_options.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
// TODO: Monitoring service will be implemented in a separate ticket
// import 'core/monitoring/monitoring_service.dart';
// import 'core/monitoring/app_logger.dart';

void main() async {
  // Run app with zone guard for uncaught errors
  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      // Setup Flutter error handling
      FlutterError.onError = (FlutterErrorDetails details) {
        FlutterError.presentError(details);
        // TODO: Record to monitoring service when implemented
        debugPrint('Flutter Error: ${details.exception}');
      };

      // Firebaseを初期化
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );

      // TODO: 監視サービスを初期化（別チケットで実装予定）
      debugPrint('App initialized - platform: ${defaultTargetPlatform.name}, debug: $kDebugMode');

      // デバッグモードでエミュレータを設定
      if (kDebugMode) {
        _configureEmulators(useEmulators: true);
      }

      runApp(
        const ProviderScope(
          child: MyApp(),
        ),
      );
    },
    (error, stackTrace) {
      // Handle uncaught errors in the zone
      debugPrint('Uncaught Error: $error\n$stackTrace');
    },
  );
}

/// ローカル開発用のFirebaseエミュレータを設定
/// デバッグモードで本番Firebaseに接続する場合は[useEmulators]をfalseに設定
void _configureEmulators({bool useEmulators = false}) {
  if (!useEmulators) {
    debugPrint('エミュレータ無効、本番Firebaseを使用');
    return;
  }

  // プラットフォームに基づいて正しいホストを決定
  // - Web: '127.0.0.1'を使用（firebase.jsonのホスト設定と一致させる必要あり）
  // - Androidエミュレータ: '10.0.2.2'を使用（ホストマシンへの特別なエイリアス）
  // - iOSシミュレータ/デスクトップ: '127.0.0.1'を使用
  String host;
  if (kIsWeb) {
    host = '127.0.0.1';
  } else if (defaultTargetPlatform == TargetPlatform.android) {
    host = '10.0.2.2';
  } else {
    host = '127.0.0.1';
  }

  try {
    // Web版ではuseAuthEmulatorをawaitしてはいけない（問題が発生するため）
    // このメソッドはWebプラットフォームでは同期的に動作
    FirebaseAuth.instance.useAuthEmulator(host, 9099);
    FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
    FirebaseFunctions.instanceFor(region: 'asia-northeast1')
        .useFunctionsEmulator(host, 5001);

    debugPrint('Firebaseエミュレータの設定完了（ホスト: $host、プラットフォーム: ${kIsWeb ? "web" : defaultTargetPlatform.name}）');
  } catch (e) {
    debugPrint('Firebaseエミュレータ設定エラー: $e');
    // エミュレータなしで続行 - 本番Firebaseを使用
  }
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'AI Fitness',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      routerConfig: router,
      // 日本語ロケール
      locale: const Locale('ja', 'JP'),
      supportedLocales: const [
        Locale('ja', 'JP'),
        Locale('en', 'US'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
