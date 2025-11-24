/// Firebase Authentication State Management
///
/// 認証状態の管理とユーザーセッション処理
/// Riverpodを使用した状態管理実装
///
/// @version 1.0.0
/// @date 2025-11-24

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

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
  StreamSubscription<User?>? _authStateSubscription;
  StreamSubscription<DocumentSnapshot>? _userDataSubscription;
  Timer? _tokenRefreshTimer;

  AuthStateNotifier({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance,
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
      await _auth.signOut();
    } catch (e) {
      state = state.copyWith(
        error: 'サインアウトエラー: $e',
      );
    }
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