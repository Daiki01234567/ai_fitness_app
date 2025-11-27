/// Firebase Authentication State Management
///
/// 認証状態の管理とユーザーセッション処理
/// Riverpodを使用した状態管理実装
///
/// @version 1.1.0
/// @date 2025-11-26

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
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
    @Default(false) bool isLoading,

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

  /// Current Terms of Service version
  static const String tosVersion = '3.2';

  /// Current Privacy Policy version
  static const String ppVersion = '3.1';

  AuthStateNotifier({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
    GoogleSignIn? googleSignIn,
  })  : _auth = auth ?? FirebaseAuth.instance,
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
          error: 'Authentication error: $error',
          isLoading: false,
        );
      },
    );
  }

  /// ユーザーサインイン時の処理
  Future<void> _handleUserSignIn(User user) async {
    state = state.copyWith(
      user: user,
      isLoading: true,
      error: null,
    );

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
        state = state.copyWith(
          error: 'アカウントがログアウトされました',
          isForceLogout: true,
        );
        return;
      }

      // Firestoreからユーザーデータを取得
      _userDataSubscription?.cancel();
      _userDataSubscription = _firestore
          .collection('users')
          .doc(user.uid)
          .snapshots()
          .listen(
        (snapshot) {
          if (snapshot.exists) {
            final userData = snapshot.data()!;

            state = state.copyWith(
              user: updatedUser ?? user,
              userData: userData,
              isEmailVerified: updatedUser?.emailVerified ?? false,
              isDeletionScheduled: userData['deletionScheduled'] ?? false,
              customClaims: customClaims,
              isLoading: false,
              error: null,
            );

            // 削除予定の場合は警告
            if (userData['deletionScheduled'] == true) {
              final deletionDate = userData['scheduledDeletionDate'] as Timestamp?;
              if (deletionDate != null) {
                final daysLeft = deletionDate
                    .toDate()
                    .difference(DateTime.now())
                    .inDays;
                state = state.copyWith(
                  error: 'アカウントは${daysLeft}日後に削除されます',
                );
              }
            }
          } else {
            // ユーザードキュメントが存在しない場合（新規ユーザー）
            state = state.copyWith(
              user: updatedUser ?? user,
              isEmailVerified: updatedUser?.emailVerified ?? false,
              customClaims: customClaims,
              isLoading: false,
            );
          }
        },
        onError: (error) {
          state = state.copyWith(
            error: 'Failed to load user data: $error',
            isLoading: false,
          );
        },
      );

      // トークンリフレッシュタイマーを開始
      _startTokenRefreshTimer();

    } catch (e) {
      state = state.copyWith(
        error: 'Sign in error: $e',
        isLoading: false,
      );
    }
  }

  /// ユーザーサインアウト時の処理
  void _handleUserSignOut() {
    _userDataSubscription?.cancel();
    _tokenRefreshTimer?.cancel();

    state = const AuthState();
  }

  /// トークンリフレッシュタイマーの開始
  void _startTokenRefreshTimer() {
    _tokenRefreshTimer?.cancel();

    // 50分ごとにトークンをリフレッシュ（有効期限は60分）
    _tokenRefreshTimer = Timer.periodic(
      const Duration(minutes: 50),
      (_) async {
        try {
          final user = _auth.currentUser;
          if (user != null) {
            final idTokenResult = await user.getIdTokenResult(true);

            // カスタムクレームを更新
            state = state.copyWith(
              customClaims: idTokenResult.claims,
            );

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
          // トークンリフレッシュエラーは無視
          print('Token refresh error: $e');
        }
      },
    );
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

      // ユーザードキュメントの最終ログイン時刻を更新
      if (credential.user != null) {
        await _firestore.collection('users').doc(credential.user!.uid).update({
          'lastLoginAt': FieldValue.serverTimestamp(),
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

      state = state.copyWith(
        error: errorMessage,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        error: 'ログインエラー: $e',
        isLoading: false,
      );
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

      state = state.copyWith(
        error: errorMessage,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        error: '登録エラー: $e',
        isLoading: false,
      );
    }
  }

  /// メール確認を送信
  Future<void> sendEmailVerification() async {
    try {
      final user = _auth.currentUser;
      if (user != null && !user.emailVerified) {
        await user.sendEmailVerification();
        state = state.copyWith(
          error: '確認メールを送信しました。メールをご確認ください',
        );
      }
    } catch (e) {
      state = state.copyWith(
        error: 'メール送信エラー: $e',
      );
    }
  }

  /// パスワードリセットメールを送信
  Future<void> sendPasswordResetEmail(String email) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      await _auth.sendPasswordResetEmail(email: email);
      state = state.copyWith(
        error: 'パスワードリセットメールを送信しました',
        isLoading: false,
      );
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

      state = state.copyWith(
        error: errorMessage,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        error: 'エラー: $e',
        isLoading: false,
      );
    }
  }

  /// サインアウト
  Future<void> signOut() async {
    try {
      // Sign out from Google if signed in
      await _googleSignIn.signOut();
      await _auth.signOut();
    } catch (e) {
      state = state.copyWith(
        error: 'サインアウトエラー: $e',
      );
    }
  }

  /// Googleアカウントでサインイン
  ///
  /// Based on FR-015: Google/Apple認証
  /// - OAuth 2.0認証フロー
  /// - 新規ユーザーの場合はFirestoreにユーザードキュメントを作成
  /// - 同意状態の記録
  Future<void> signInWithGoogle({
    bool tosAccepted = true,
    bool ppAccepted = true,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      // Start Google Sign In flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        // User cancelled the sign-in
        state = state.copyWith(isLoading: false);
        return;
      }

      // Get authentication details
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      // Create Firebase credential
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase
      final userCredential = await _auth.signInWithCredential(credential);
      final user = userCredential.user;

      if (user == null) {
        throw Exception('Firebase認証に失敗しました');
      }

      // Check if this is a new user or existing user
      final isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;

      if (isNewUser) {
        // Create user document for new users
        await _createSocialLoginUserDocument(
          user: user,
          provider: 'google',
          tosAccepted: tosAccepted,
          ppAccepted: ppAccepted,
        );
      } else {
        // Update last login for existing users
        await _updateLastLogin(user.uid);
      }

      // Note: The auth state listener will handle the rest of the sign-in flow

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

      state = state.copyWith(
        error: errorMessage,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        error: 'Googleログインエラー: $e',
        isLoading: false,
      );
    }
  }

  /// Apple IDでサインイン
  ///
  /// Based on FR-015: Google/Apple認証
  /// - Apple Sign In使用
  /// - 新規ユーザーの場合はFirestoreにユーザードキュメントを作成
  Future<void> signInWithApple({
    bool tosAccepted = true,
    bool ppAccepted = true,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      // Create Apple auth provider
      final appleProvider = AppleAuthProvider()
        ..addScope('email')
        ..addScope('name');

      // Sign in with Apple
      final userCredential = await _auth.signInWithProvider(appleProvider);
      final user = userCredential.user;

      if (user == null) {
        throw Exception('Apple認証に失敗しました');
      }

      // Check if this is a new user
      final isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;

      if (isNewUser) {
        // Create user document for new users
        await _createSocialLoginUserDocument(
          user: user,
          provider: 'apple',
          tosAccepted: tosAccepted,
          ppAccepted: ppAccepted,
        );
      } else {
        // Update last login for existing users
        await _updateLastLogin(user.uid);
      }

      // Note: The auth state listener will handle the rest of the sign-in flow

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

      state = state.copyWith(
        error: errorMessage,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        error: 'Appleログインエラー: $e',
        isLoading: false,
      );
    }
  }

  /// ソーシャルログイン用のユーザードキュメントを作成
  ///
  /// Based on Firestoreデータベース設計書 Section 4 (Users コレクション)
  Future<void> _createSocialLoginUserDocument({
    required User user,
    required String provider,
    required bool tosAccepted,
    required bool ppAccepted,
  }) async {
    final now = FieldValue.serverTimestamp();

    final userData = {
      // Basic info (from Firebase Auth)
      'userId': user.uid,
      'email': user.email ?? '',
      'displayName': user.displayName,
      'photoURL': user.photoURL,

      // Profile (empty for social login - user can fill in later)
      'profile': {
        'height': null,
        'weight': null,
        'birthday': null,
        'gender': null,
        'fitnessLevel': null,
        'goals': <String>[],
      },

      // Consent management (GDPR compliance)
      'tosAccepted': tosAccepted,
      'tosAcceptedAt': tosAccepted ? now : null,
      'tosVersion': tosAccepted ? tosVersion : null,
      'ppAccepted': ppAccepted,
      'ppAcceptedAt': ppAccepted ? now : null,
      'ppVersion': ppAccepted ? ppVersion : null,

      // Account status
      'isActive': true,
      'deletionScheduled': false,
      'deletionScheduledAt': null,
      'scheduledDeletionDate': null,

      // Force logout
      'forceLogout': false,
      'forceLogoutAt': null,

      // Daily usage (Phase 3)
      'dailyUsageCount': 0,
      'lastUsageResetDate': null,

      // Subscription
      'subscriptionStatus': 'free',
      'subscriptionPlan': null,
      'subscriptionStartDate': null,
      'subscriptionEndDate': null,

      // System
      'createdAt': now,
      'updatedAt': now,
      'lastLoginAt': now,

      // Data retention
      'dataRetentionDate': null,

      // Auth provider info
      'authProvider': provider,
    };

    // Create user document
    await _firestore.collection('users').doc(user.uid).set(userData);

    // Create consent records for audit trail
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

  /// 最終ログイン日時を更新
  Future<void> _updateLastLogin(String userId) async {
    try {
      await _firestore.collection('users').doc(userId).update({
        'lastLoginAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      // User document might not exist (legacy user), ignore error
      print('Failed to update last login: $e');
    }
  }

  /// エラーをクリア
  void clearError() {
    state = state.copyWith(error: null);
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
      final deletionRequest = await _firestore.collection('dataDeletionRequests').add({
        'requestId': '',  // 後で更新
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
      state = state.copyWith(
        error: 'アカウント削除リクエストエラー: $e',
        isLoading: false,
      );
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
      state = state.copyWith(
        error: 'キャンセルエラー: $e',
        isLoading: false,
      );
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