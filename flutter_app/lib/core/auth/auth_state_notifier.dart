// Firebase認証状態管理
//
// 認証状態の管理とユーザーセッション処理
// Riverpodを使用した状態管理実装
//
// @version 1.1.0
// @date 2025-11-26

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'auth_service.dart';

part 'auth_state_notifier.freezed.dart';

/// 認証状態を表すデータクラス
@freezed
class AuthState with _$AuthState {
  const factory AuthState({
    /// 現在のユーザー
    User? user,

    /// ユーザーデータ（Firestoreから取得）
    Map<String, dynamic>? userData,

    /// ローディング状態
    /// 初期値はtrueで、Firebase Authの初期化完了まで待機
    @Default(true) bool isLoading,

    /// エラーメッセージ
    String? error,

    /// メール確認済みフラグ
    @Default(false) bool isEmailVerified,

    /// 強制ログアウトフラグ
    @Default(false) bool isForceLogout,

    /// 削除予定フラグ
    @Default(false) bool isDeletionScheduled,

    /// カスタムクレーム
    Map<String, dynamic>? customClaims,

    /// 初回初期化完了フラグ
    /// Firebase Authの初期状態取得が完了したかどうか
    @Default(false) bool isInitialized,
  }) = _AuthState;
}

/// 認証状態を管理するNotifier
class AuthStateNotifier extends StateNotifier<AuthState> {
  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final GoogleSignIn _googleSignIn;
  StreamSubscription<User?>? _authStateSubscription;
  StreamSubscription<DocumentSnapshot>? _userDataSubscription;
  Timer? _tokenRefreshTimer;

  /// 現在の利用規約バージョン
  static const String tosVersion = '3.2';

  /// 現在のプライバシーポリシーバージョン
  static const String ppVersion = '3.1';

  AuthStateNotifier({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
    GoogleSignIn? googleSignIn,
  }) : _auth = auth ?? FirebaseAuth.instance,
       _firestore = firestore ?? FirebaseFirestore.instance,
       _googleSignIn = googleSignIn ?? GoogleSignIn(),
       super(const AuthState()) {
    // 認証状態の監視を開始
    _initAuthStateListener();
  }

  /// 認証状態リスナーの初期化
  void _initAuthStateListener() {
    _authStateSubscription = _auth.authStateChanges().listen(
      (user) async {
        if (user != null) {
          await _handleUserSignIn(user);
        } else {
          _handleUserSignOut();
        }
      },
      onError: (error) {
        state = state.copyWith(
          error: '認証エラー: $error',
          isLoading: false,
          isInitialized: true,
        );
      },
    );
  }

  /// ユーザーサインイン時の処理
  Future<void> _handleUserSignIn(User user) async {
    state = state.copyWith(user: user, isLoading: true, error: null);

    try {
      // メール確認状態をチェック
      await user.reload();
      final updatedUser = _auth.currentUser;

      // カスタムクレームを取得
      final idTokenResult = await user.getIdTokenResult(true);
      final customClaims = idTokenResult.claims ?? {};

      // 強制ログアウトチェック
      if (customClaims['forceLogout'] == true) {
        await signOut();
        state = state.copyWith(error: 'アカウントがログアウトされました', isForceLogout: true);
        return;
      }

      // Firestoreからユーザーデータを取得
      _userDataSubscription?.cancel();
      _userDataSubscription = _firestore
          .collection('users')
          .doc(user.uid)
          .snapshots()
          .listen(
            (snapshot) async {
              if (snapshot.exists) {
                final userData = snapshot.data()!;

                // Firestoreからの強制ログアウトフラグをチェック
                // 同意撤回やその他のサーバー側ログアウトトリガーを処理
                if (userData['forceLogout'] == true) {
                  await signOut();
                  state = state.copyWith(
                    error: 'セッションが無効になりました。再度ログインしてください。',
                    isForceLogout: true,
                  );
                  return;
                }

                state = state.copyWith(
                  user: updatedUser ?? user,
                  userData: userData,
                  isEmailVerified: updatedUser?.emailVerified ?? false,
                  isDeletionScheduled: userData['deletionScheduled'] ?? false,
                  customClaims: customClaims,
                  isLoading: false,
                  isInitialized: true,
                  error: null,
                );

                // 削除予定の場合は警告
                if (userData['deletionScheduled'] == true) {
                  final deletionDate =
                      userData['scheduledDeletionDate'] as Timestamp?;
                  if (deletionDate != null) {
                    final daysLeft = deletionDate
                        .toDate()
                        .difference(DateTime.now())
                        .inDays;
                    state = state.copyWith(error: 'アカウントは$daysLeft日後に削除されます');
                  }
                }
              } else {
                // ユーザードキュメントが存在しない場合（新規ユーザー）
                state = state.copyWith(
                  user: updatedUser ?? user,
                  isEmailVerified: updatedUser?.emailVerified ?? false,
                  customClaims: customClaims,
                  isLoading: false,
                  isInitialized: true,
                );
              }
            },
            onError: (error) {
              state = state.copyWith(
                error: 'ユーザーデータの読み込みに失敗しました: $error',
                isLoading: false,
                isInitialized: true,
              );
            },
          );

      // トークンリフレッシュタイマーを開始
      _startTokenRefreshTimer();
    } catch (e) {
      state = state.copyWith(
        error: 'サインインエラー: $e',
        isLoading: false,
        isInitialized: true,
      );
    }
  }

  /// ユーザーサインアウト時の処理
  ///
  /// 無限ループ防止: 既に未認証状態かつ初期化済みの場合は状態変更をスキップ
  void _handleUserSignOut() {
    debugPrint('[AuthState] _handleUserSignOut called');
    debugPrint(
      '[AuthState] Current state: user=${state.user?.uid}, isLoading=${state.isLoading}, isForceLogout=${state.isForceLogout}, isInitialized=${state.isInitialized}',
    );

    // 既に未認証状態（user == null）で初期化済みの場合は
    // 状態変更をスキップして無限ループを防止
    if (state.user == null && state.isInitialized) {
      debugPrint('[AuthState] Already signed out and initialized, skipping state reset to prevent loop');
      // サブスクリプションだけキャンセル（安全のため）
      _userDataSubscription?.cancel();
      _tokenRefreshTimer?.cancel();
      return;
    }

    _userDataSubscription?.cancel();
    _tokenRefreshTimer?.cancel();

    // サインアウト中にisForceLogoutフラグを保持
    // これにより強制ログアウト後にルーターがログイン画面にリダイレクトすることを保証
    final wasForceLogout = state.isForceLogout;
    debugPrint('[AuthState] Preserving isForceLogout=$wasForceLogout');

    // 初期化完了フラグをtrueに設定し、isLoadingをfalseに
    // これによりFirebase Authの初期化が完了したことを示す
    state = AuthState(
      isForceLogout: wasForceLogout,
      isLoading: false,
      isInitialized: true,
    );
    debugPrint(
      '[AuthState] State reset completed. New state: isForceLogout=${state.isForceLogout}, isLoading=${state.isLoading}, isInitialized=${state.isInitialized}',
    );
  }

  /// トークンリフレッシュタイマーの開始
  void _startTokenRefreshTimer() {
    _tokenRefreshTimer?.cancel();

    // 50分ごとにトークンをリフレッシュ（有効期限は60分）
    _tokenRefreshTimer = Timer.periodic(const Duration(minutes: 50), (_) async {
      try {
        final user = _auth.currentUser;
        if (user != null) {
          final idTokenResult = await user.getIdTokenResult(true);

          // カスタムクレームを更新
          state = state.copyWith(customClaims: idTokenResult.claims);

          // 強制ログアウトチェック
          if (idTokenResult.claims?['forceLogout'] == true) {
            await signOut();
            state = state.copyWith(
              error: 'セッションが無効になりました',
              isForceLogout: true,
            );
          }
        }
      } catch (e) {
        // トークンリフレッシュエラーは無視 - Token refresh error
      }
    });
  }

  /// メール/パスワードでサインイン
  Future<void> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      // ユーザードキュメントの最終ログイン時刻を更新し、forceLogoutフラグをリセット
      if (credential.user != null) {
        await _firestore.collection('users').doc(credential.user!.uid).update({
          'lastLoginAt': FieldValue.serverTimestamp(),
          'forceLogout': false,
          'forceLogoutAt': null,
        });
      }
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'user-not-found':
          errorMessage = 'ユーザーが見つかりません';
          break;
        case 'wrong-password':
          errorMessage = 'パスワードが正しくありません';
          break;
        case 'invalid-email':
          errorMessage = 'メールアドレスが無効です';
          break;
        case 'user-disabled':
          errorMessage = 'このアカウントは無効化されています';
          break;
        case 'too-many-requests':
          errorMessage = 'ログイン試行が多すぎます。しばらくしてから再試行してください';
          break;
        default:
          errorMessage = 'ログインに失敗しました: ${e.message}';
      }

      state = state.copyWith(error: errorMessage, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: 'ログインエラー: $e', isLoading: false);
    }
  }

  /// メール/パスワードで新規登録
  Future<void> signUpWithEmailAndPassword({
    required String email,
    required String password,
    String? displayName,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      // アカウント作成
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      // 表示名を設定
      if (displayName != null && credential.user != null) {
        await credential.user!.updateDisplayName(displayName);
      }

      // メール確認を送信
      await sendEmailVerification();
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'email-already-in-use':
          errorMessage = 'このメールアドレスは既に使用されています';
          break;
        case 'invalid-email':
          errorMessage = 'メールアドレスが無効です';
          break;
        case 'weak-password':
          errorMessage = 'パスワードが弱すぎます';
          break;
        case 'operation-not-allowed':
          errorMessage = 'メール/パスワード認証が無効になっています';
          break;
        default:
          errorMessage = '登録に失敗しました: ${e.message}';
      }

      state = state.copyWith(error: errorMessage, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: '登録エラー: $e', isLoading: false);
    }
  }

  /// メール確認を送信
  Future<void> sendEmailVerification() async {
    try {
      final user = _auth.currentUser;
      if (user != null && !user.emailVerified) {
        await user.sendEmailVerification();
        state = state.copyWith(error: '確認メールを送信しました。メールをご確認ください');
      }
    } catch (e) {
      state = state.copyWith(error: 'メール送信エラー: $e');
    }
  }

  /// パスワードリセットメールを送信
  Future<void> sendPasswordResetEmail(String email) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      await _auth.sendPasswordResetEmail(email: email);
      state = state.copyWith(error: 'パスワードリセットメールを送信しました', isLoading: false);
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'user-not-found':
          errorMessage = 'ユーザーが見つかりません';
          break;
        case 'invalid-email':
          errorMessage = 'メールアドレスが無効です';
          break;
        default:
          errorMessage = 'エラー: ${e.message}';
      }

      state = state.copyWith(error: errorMessage, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: 'エラー: $e', isLoading: false);
    }
  }

  /// サインアウト
  Future<void> signOut() async {
    try {
      // Googleサインイン済みの場合はGoogleからもサインアウト
      await _googleSignIn.signOut();
      await _auth.signOut();
    } catch (e) {
      state = state.copyWith(error: 'サインアウトエラー: $e');
    }
  }

  /// 強制ログアウト（同意撤回時など）
  ///
  /// isForceLogoutフラグを設定してからサインアウトすることで、
  /// ルーターが確実にログイン画面にリダイレクトするようにする
  ///
  /// フォールバックとしてFirestoreのforceLogoutフィールドも更新し、
  /// 全デバイスでのログアウトを保証（Cloud Functionsが失敗した場合に備えて）
  /// 仕様: FR-002-1 同意撤回時の強制ログアウト
  Future<void> forceLogout() async {
    debugPrint('[ForceLogout] Starting forceLogout...');
    debugPrint('[ForceLogout] Current user: ${_auth.currentUser?.uid}');
    debugPrint(
      '[ForceLogout] Current state.isForceLogout: ${state.isForceLogout}',
    );

    // まず強制ログアウトフラグを設定してルーターがログインにリダイレクトするようにする
    state = state.copyWith(isForceLogout: true);
    debugPrint('[ForceLogout] Set isForceLogout=true in state');

    try {
      // フォールバックとしてFirestoreのforceLogoutフィールドを更新
      // （Cloud Functionsで更新されているはずだが、失敗している可能性あり）
      final currentUser = _auth.currentUser;
      if (currentUser != null) {
        debugPrint('[ForceLogout] Updating Firestore forceLogout field...');
        try {
          await _firestore.collection('users').doc(currentUser.uid).update({
            'forceLogout': true,
            'forceLogoutAt': FieldValue.serverTimestamp(),
          });
          debugPrint('[ForceLogout] Firestore update successful');
        } catch (firestoreError) {
          // Firestoreエラーは無視 - ローカルでのサインアウトは続行
          // セキュリティルールで禁止されている場合やユーザーが存在しない場合に失敗する可能性あり
          debugPrint(
            '[ForceLogout] Firestore update failed (ignoring): $firestoreError',
          );
        }
      }

      // Googleサインイン済みの場合はGoogleからもサインアウト
      debugPrint('[ForceLogout] Signing out from Google...');
      await _googleSignIn.signOut();
      debugPrint('[ForceLogout] Signing out from Firebase Auth...');
      await _auth.signOut();
      debugPrint('[ForceLogout] Firebase Auth signOut completed');
    } catch (e) {
      debugPrint('[ForceLogout] Error during signOut: $e');
      state = state.copyWith(error: 'サインアウトエラー: $e');
    }
    debugPrint('[ForceLogout] forceLogout() method completed');
  }

  /// Googleアカウントでサインイン
  ///
  /// 仕様: FR-015: Google/Apple認証
  /// - OAuth 2.0認証フロー
  /// - 新規ユーザーの場合はFirestoreにユーザードキュメントを作成
  /// - 同意状態の記録
  Future<void> signInWithGoogle({
    bool tosAccepted = true,
    bool ppAccepted = true,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      // Googleサインインフローを開始
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        // ユーザーがサインインをキャンセル
        state = state.copyWith(isLoading: false);
        return;
      }

      // 認証詳細を取得
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      // Firebase認証情報を作成
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Firebaseにサインイン
      final userCredential = await _auth.signInWithCredential(credential);
      final user = userCredential.user;

      if (user == null) {
        throw Exception('Firebase認証に失敗しました');
      }

      // 新規ユーザーか既存ユーザーかをチェック
      final isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;

      if (isNewUser) {
        // 新規ユーザーのユーザードキュメントを作成
        await _createSocialLoginUserDocument(
          user: user,
          provider: 'google',
          tosAccepted: tosAccepted,
          ppAccepted: ppAccepted,
        );
      } else {
        // 既存ユーザーの最終ログインを更新
        await _updateLastLogin(user.uid);
      }

      // 注意: 認証状態リスナーが残りのサインインフローを処理
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'account-exists-with-different-credential':
          errorMessage = 'このメールアドレスは別の方法で登録されています';
          break;
        case 'invalid-credential':
          errorMessage = '認証情報が無効です';
          break;
        case 'operation-not-allowed':
          errorMessage = 'Google認証が無効になっています';
          break;
        case 'user-disabled':
          errorMessage = 'このアカウントは無効化されています';
          break;
        default:
          errorMessage = 'Googleログインに失敗しました: ${e.message}';
      }

      state = state.copyWith(error: errorMessage, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: 'Googleログインエラー: $e', isLoading: false);
    }
  }

  /// Apple IDでサインイン
  ///
  /// 仕様: FR-015: Google/Apple認証
  /// - Apple Sign In使用
  /// - 新規ユーザーの場合はFirestoreにユーザードキュメントを作成
  Future<void> signInWithApple({
    bool tosAccepted = true,
    bool ppAccepted = true,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      // Apple認証プロバイダーを作成
      final appleProvider = AppleAuthProvider()
        ..addScope('email')
        ..addScope('name');

      // Appleでサインイン
      final userCredential = await _auth.signInWithProvider(appleProvider);
      final user = userCredential.user;

      if (user == null) {
        throw Exception('Apple認証に失敗しました');
      }

      // 新規ユーザーかどうかをチェック
      final isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;

      if (isNewUser) {
        // 新規ユーザーのユーザードキュメントを作成
        await _createSocialLoginUserDocument(
          user: user,
          provider: 'apple',
          tosAccepted: tosAccepted,
          ppAccepted: ppAccepted,
        );
      } else {
        // 既存ユーザーの最終ログインを更新
        await _updateLastLogin(user.uid);
      }

      // 注意: 認証状態リスナーが残りのサインインフローを処理
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'account-exists-with-different-credential':
          errorMessage = 'このメールアドレスは別の方法で登録されています';
          break;
        case 'invalid-credential':
          errorMessage = '認証情報が無効です';
          break;
        case 'operation-not-allowed':
          errorMessage = 'Apple認証が無効になっています';
          break;
        case 'user-disabled':
          errorMessage = 'このアカウントは無効化されています';
          break;
        case 'user-not-found':
          errorMessage = 'ユーザーが見つかりません';
          break;
        default:
          errorMessage = 'Apple ログインに失敗しました: ${e.message}';
      }

      state = state.copyWith(error: errorMessage, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: 'Appleログインエラー: $e', isLoading: false);
    }
  }

  /// ソーシャルログイン用のユーザードキュメントを作成
  ///
  /// 仕様: Firestoreデータベース設計書 Section 4 (Usersコレクション)
  Future<void> _createSocialLoginUserDocument({
    required User user,
    required String provider,
    required bool tosAccepted,
    required bool ppAccepted,
  }) async {
    final now = FieldValue.serverTimestamp();

    final userData = {
      // 基本情報（Firebase Authから取得）
      'userId': user.uid,
      'email': user.email ?? '',
      'displayName': user.displayName,
      'photoURL': user.photoURL,

      // プロフィール（ソーシャルログインでは空 - ユーザーが後で入力可能）
      'profile': {
        'height': null,
        'weight': null,
        'birthday': null,
        'gender': null,
        'fitnessLevel': null,
        'goals': <String>[],
      },

      // 同意管理（GDPR準拠）
      'tosAccepted': tosAccepted,
      'tosAcceptedAt': tosAccepted ? now : null,
      'tosVersion': tosAccepted ? tosVersion : null,
      'ppAccepted': ppAccepted,
      'ppAcceptedAt': ppAccepted ? now : null,
      'ppVersion': ppAccepted ? ppVersion : null,

      // アカウントステータス
      'isActive': true,
      'deletionScheduled': false,
      'deletionScheduledAt': null,
      'scheduledDeletionDate': null,

      // 強制ログアウト
      'forceLogout': false,
      'forceLogoutAt': null,

      // 1日の使用量（Phase 3）
      'dailyUsageCount': 0,
      'lastUsageResetDate': null,

      // サブスクリプション
      'subscriptionStatus': 'free',
      'subscriptionPlan': null,
      'subscriptionStartDate': null,
      'subscriptionEndDate': null,

      // システム
      'createdAt': now,
      'updatedAt': now,
      'lastLoginAt': now,

      // データ保持
      'dataRetentionDate': null,

      // 認証プロバイダー情報
      'authProvider': provider,
    };

    // ユーザードキュメントを作成
    await _firestore.collection('users').doc(user.uid).set(userData);

    // 監査証跡用の同意記録を作成
    await _createConsentRecord(
      userId: user.uid,
      documentType: 'tos',
      documentVersion: tosVersion,
      action: tosAccepted ? 'accept' : 'decline',
    );

    await _createConsentRecord(
      userId: user.uid,
      documentType: 'pp',
      documentVersion: ppVersion,
      action: ppAccepted ? 'accept' : 'decline',
    );
  }

  /// 同意記録を作成（監査ログ用）
  Future<void> _createConsentRecord({
    required String userId,
    required String documentType,
    required String documentVersion,
    required String action,
  }) async {
    await _firestore.collection('consents').add({
      'userId': userId,
      'documentType': documentType,
      'documentVersion': documentVersion,
      'action': action,
      'timestamp': FieldValue.serverTimestamp(),
    });
  }

  /// 最終ログイン日時を更新し、forceLogoutフラグをリセット
  Future<void> _updateLastLogin(String userId) async {
    try {
      await _firestore.collection('users').doc(userId).update({
        'lastLoginAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
        'forceLogout': false,
        'forceLogoutAt': null,
      });
    } catch (_) {
      // ユーザードキュメントが存在しない可能性あり（レガシーユーザー）、エラーは無視
    }
  }

  /// エラーをクリア
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// 強制ログアウトフラグをクリア
  void clearForceLogout() {
    state = state.copyWith(isForceLogout: false);
  }

  /// アカウント削除リクエスト
  Future<void> requestAccountDeletion() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('ユーザーが認証されていません');
      }

      // 削除リクエストをFirestoreに記録
      final deletionRequest = await _firestore
          .collection('dataDeletionRequests')
          .add({
            'requestId': '', // 後で更新
            'userId': user.uid,
            'requestedAt': FieldValue.serverTimestamp(),
            'scheduledDeletionDate': Timestamp.fromDate(
              DateTime.now().add(const Duration(days: 30)),
            ),
            'status': 'pending',
            'reason': 'user_requested',
          });

      // requestIdを更新
      await deletionRequest.update({'requestId': deletionRequest.id});

      // ユーザードキュメントを更新
      await _firestore.collection('users').doc(user.uid).update({
        'deletionScheduled': true,
        'deletionScheduledAt': FieldValue.serverTimestamp(),
        'scheduledDeletionDate': Timestamp.fromDate(
          DateTime.now().add(const Duration(days: 30)),
        ),
      });

      state = state.copyWith(
        isDeletionScheduled: true,
        error: 'アカウント削除をリクエストしました。30日後に削除されます',
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(error: 'アカウント削除リクエストエラー: $e', isLoading: false);
    }
  }

  /// アカウント削除リクエストをキャンセル
  Future<void> cancelAccountDeletion() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('ユーザーが認証されていません');
      }

      // 削除リクエストをキャンセル
      final requests = await _firestore
          .collection('dataDeletionRequests')
          .where('userId', isEqualTo: user.uid)
          .where('status', isEqualTo: 'pending')
          .get();

      for (final doc in requests.docs) {
        await doc.reference.update({
          'status': 'cancelled',
          'cancelledAt': FieldValue.serverTimestamp(),
        });
      }

      // ユーザードキュメントを更新
      await _firestore.collection('users').doc(user.uid).update({
        'deletionScheduled': false,
        'deletionScheduledAt': null,
        'scheduledDeletionDate': null,
      });

      state = state.copyWith(
        isDeletionScheduled: false,
        error: 'アカウント削除リクエストをキャンセルしました',
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(error: 'キャンセルエラー: $e', isLoading: false);
    }
  }

  @override
  void dispose() {
    _authStateSubscription?.cancel();
    _userDataSubscription?.cancel();
    _tokenRefreshTimer?.cancel();
    super.dispose();
  }
}

/// 認証状態のプロバイダー
final authStateProvider = StateNotifierProvider<AuthStateNotifier, AuthState>(
  (ref) => AuthStateNotifier(),
);

/// 現在のユーザープロバイダー
final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authStateProvider).user;
});

/// ユーザーデータプロバイダー
final userDataProvider = Provider<Map<String, dynamic>?>((ref) {
  return ref.watch(authStateProvider).userData;
});

/// 認証済みチェックプロバイダー
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(currentUserProvider) != null;
});

/// メール確認済みチェックプロバイダー
final isEmailVerifiedProvider = Provider<bool>((ref) {
  return ref.watch(authStateProvider).isEmailVerified;
});

/// 認証サービスプロバイダー
final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});
