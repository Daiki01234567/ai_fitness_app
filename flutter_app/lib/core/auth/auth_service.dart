/// Firebase Authentication Service
///
/// 認証機能の追加サービスメソッド
/// 電話番号認証、ソーシャル認証など
///
/// @version 1.0.0
/// @date 2025-11-24

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cloud_functions/cloud_functions.dart';

class AuthService {
  final FirebaseAuth _auth;
  final GoogleSignIn _googleSignIn;
  final FirebaseFunctions _functions;

  // SMS認証用
  String? _verificationId;
  int? _resendToken;

  AuthService({
    FirebaseAuth? auth,
    GoogleSignIn? googleSignIn,
    FirebaseFunctions? functions,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _googleSignIn = googleSignIn ?? GoogleSignIn(),
        _functions = functions ?? FirebaseFunctions.instanceFor(region: 'asia-northeast1');

  /// 電話番号でサインイン（SMS認証）
  Future<void> signInWithPhoneNumber({
    required String phoneNumber,
    required Function(String verificationId) onCodeSent,
    required Function(String error) onError,
    Function(PhoneAuthCredential credential)? onAutoVerification,
    Duration timeout = const Duration(seconds: 60),
  }) async {
    try {
      // 日本の電話番号形式に変換
      String formattedNumber = phoneNumber;
      if (phoneNumber.startsWith('0')) {
        // 0から始まる場合は+81に変換
        formattedNumber = '+81${phoneNumber.substring(1)}';
      } else if (!phoneNumber.startsWith('+')) {
        // +がない場合は+81を追加
        formattedNumber = '+81$phoneNumber';
      }

      await _auth.verifyPhoneNumber(
        phoneNumber: formattedNumber,
        timeout: timeout,
        verificationCompleted: (PhoneAuthCredential credential) async {
          // 自動検証成功時
          if (onAutoVerification != null) {
            onAutoVerification(credential);
          } else {
            // 自動的にサインイン
            await _auth.signInWithCredential(credential);
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          String errorMessage;
          switch (e.code) {
            case 'invalid-phone-number':
              errorMessage = '電話番号が無効です';
              break;
            case 'quota-exceeded':
              errorMessage = 'SMS送信の制限に達しました。しばらくしてから再試行してください';
              break;
            case 'app-not-authorized':
              errorMessage = 'アプリが電話番号認証を使用する権限がありません';
              break;
            default:
              errorMessage = '電話番号認証エラー: ${e.message}';
          }
          onError(errorMessage);
        },
        codeSent: (String verificationId, int? resendToken) {
          // SMS送信成功
          _verificationId = verificationId;
          _resendToken = resendToken;
          onCodeSent(verificationId);
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          // 自動検証タイムアウト
          _verificationId = verificationId;
        },
        forceResendingToken: _resendToken,
      );
    } catch (e) {
      onError('電話番号認証エラー: $e');
    }
  }

  /// SMS確認コードで認証を完了
  Future<UserCredential?> verifyPhoneCode(String smsCode) async {
    if (_verificationId == null) {
      throw Exception('Verification ID not found. Please request SMS first.');
    }

    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: smsCode,
      );

      return await _auth.signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'invalid-verification-code':
          errorMessage = '確認コードが正しくありません';
          break;
        case 'invalid-verification-id':
          errorMessage = '認証セッションが無効です。もう一度お試しください';
          break;
        default:
          errorMessage = '認証エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    }
  }

  /// Google Sign In
  Future<UserCredential?> signInWithGoogle() async {
    try {
      // Google Sign Inフローを開始
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        // ユーザーがキャンセル
        return null;
      }

      // 認証情報を取得
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

      // Firebase認証用のクレデンシャルを作成
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Firebaseにサインイン
      return await _auth.signInWithCredential(credential);

    } catch (e) {
      throw Exception('Google Sign Inエラー: $e');
    }
  }

  /// Google Sign Out
  Future<void> signOutGoogle() async {
    try {
      await _googleSignIn.signOut();
    } catch (e) {
      // エラーは無視
      print('Google sign out error: $e');
    }
  }

  /// Apple Sign In（iOS）
  Future<UserCredential?> signInWithApple() async {
    try {
      // Apple Sign Inプロバイダーを作成
      final appleProvider = AppleAuthProvider()
        ..addScope('email')
        ..addScope('name');

      // プラットフォームごとの処理
      if (_auth.app.options.projectId == null) {
        throw Exception('Firebase project ID not found');
      }

      // Webまたはモバイルでの認証
      return await _auth.signInWithProvider(appleProvider);

    } catch (e) {
      throw Exception('Apple Sign Inエラー: $e');
    }
  }

  /// メールリンク認証の送信
  Future<void> sendSignInLinkToEmail({
    required String email,
    required ActionCodeSettings actionCodeSettings,
  }) async {
    try {
      await _auth.sendSignInLinkToEmail(
        email: email,
        actionCodeSettings: actionCodeSettings,
      );
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'invalid-email':
          errorMessage = 'メールアドレスが無効です';
          break;
        case 'missing-android-pkg-name':
        case 'missing-ios-bundle-id':
          errorMessage = 'アプリの設定エラーです';
          break;
        default:
          errorMessage = 'エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    }
  }

  /// メールリンクでサインイン
  Future<UserCredential?> signInWithEmailLink({
    required String email,
    required String emailLink,
  }) async {
    try {
      if (!_auth.isSignInWithEmailLink(emailLink)) {
        throw Exception('無効なメールリンクです');
      }

      return await _auth.signInWithEmailLink(
        email: email,
        emailLink: emailLink,
      );
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'invalid-email':
          errorMessage = 'メールアドレスが無効です';
          break;
        case 'expired-action-code':
          errorMessage = 'リンクの有効期限が切れています';
          break;
        case 'invalid-action-code':
          errorMessage = 'リンクが無効です';
          break;
        default:
          errorMessage = 'エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    }
  }

  /// カスタムクレームを取得（Cloud Functions呼び出し）
  Future<Map<String, dynamic>> getCustomClaims({String? targetUserId}) async {
    try {
      final callable = _functions.httpsCallable('getCustomClaims');
      final result = await callable.call({
        'targetUserId': targetUserId ?? _auth.currentUser?.uid,
      });

      return Map<String, dynamic>.from(result.data as Map);
    } catch (e) {
      throw Exception('カスタムクレーム取得エラー: $e');
    }
  }

  /// カスタムクレームを設定（管理者のみ）
  Future<Map<String, dynamic>> setCustomClaims({
    required String targetUserId,
    required Map<String, dynamic> claims,
  }) async {
    try {
      final callable = _functions.httpsCallable('setCustomClaims');
      final result = await callable.call({
        'targetUserId': targetUserId,
        'claims': claims,
      });

      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'unauthenticated':
          errorMessage = '認証が必要です';
          break;
        case 'permission-denied':
          errorMessage = '管理者権限が必要です';
          break;
        case 'invalid-argument':
          errorMessage = '無効な引数です';
          break;
        default:
          errorMessage = 'エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    }
  }

  /// カスタムクレームを削除（管理者のみ）
  Future<Map<String, dynamic>> removeCustomClaims({
    required String targetUserId,
    required List<String> claimKeys,
  }) async {
    try {
      final callable = _functions.httpsCallable('removeCustomClaims');
      final result = await callable.call({
        'targetUserId': targetUserId,
        'claimKeys': claimKeys,
      });

      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'unauthenticated':
          errorMessage = '認証が必要です';
          break;
        case 'permission-denied':
          errorMessage = '管理者権限が必要です';
          break;
        case 'invalid-argument':
          errorMessage = '無効な引数です';
          break;
        default:
          errorMessage = 'エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    }
  }

  /// 現在のユーザーのIDトークンを取得
  Future<String?> getIdToken({bool forceRefresh = false}) async {
    try {
      final user = _auth.currentUser;
      if (user != null) {
        return await user.getIdToken(forceRefresh);
      }
      return null;
    } catch (e) {
      throw Exception('IDトークン取得エラー: $e');
    }
  }

  /// 現在のユーザーのIDトークン結果を取得（クレーム含む）
  Future<IdTokenResult?> getIdTokenResult({bool forceRefresh = false}) async {
    try {
      final user = _auth.currentUser;
      if (user != null) {
        return await user.getIdTokenResult(forceRefresh);
      }
      return null;
    } catch (e) {
      throw Exception('IDトークン結果取得エラー: $e');
    }
  }

  /// パスワードを更新
  Future<void> updatePassword(String newPassword) async {
    try {
      final user = _auth.currentUser;
      if (user != null) {
        await user.updatePassword(newPassword);
      } else {
        throw Exception('ユーザーが認証されていません');
      }
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'weak-password':
          errorMessage = 'パスワードが弱すぎます';
          break;
        case 'requires-recent-login':
          errorMessage = '再認証が必要です。一度ログアウトしてから再度ログインしてください';
          break;
        default:
          errorMessage = 'パスワード更新エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    }
  }

  /// メールアドレスを更新
  Future<void> updateEmail(String newEmail) async {
    try {
      final user = _auth.currentUser;
      if (user != null) {
        await user.updateEmail(newEmail);
        await user.sendEmailVerification();
      } else {
        throw Exception('ユーザーが認証されていません');
      }
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'invalid-email':
          errorMessage = 'メールアドレスが無効です';
          break;
        case 'email-already-in-use':
          errorMessage = 'このメールアドレスは既に使用されています';
          break;
        case 'requires-recent-login':
          errorMessage = '再認証が必要です。一度ログアウトしてから再度ログインしてください';
          break;
        default:
          errorMessage = 'メール更新エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    }
  }

  /// 再認証（重要な操作の前に必要）
  Future<void> reauthenticateWithPassword({
    required String email,
    required String password,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user != null) {
        final credential = EmailAuthProvider.credential(
          email: email,
          password: password,
        );
        await user.reauthenticateWithCredential(credential);
      } else {
        throw Exception('ユーザーが認証されていません');
      }
    } on FirebaseAuthException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'wrong-password':
          errorMessage = 'パスワードが正しくありません';
          break;
        case 'user-mismatch':
          errorMessage = 'ユーザー情報が一致しません';
          break;
        case 'invalid-credential':
          errorMessage = '認証情報が無効です';
          break;
        default:
          errorMessage = '再認証エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    }
  }

  /// ユーザープロフィールを更新（Cloud Functions呼び出し）
  ///
  /// Step 2の登録情報やプロフィール設定画面からFirestoreに保存
  ///
  /// [profileData] には以下のフィールドを含めることができる:
  /// - displayName: 表示名
  /// - dateOfBirth: 生年月日（ISO 8601形式: YYYY-MM-DD）
  /// - gender: 性別（male, female, other, prefer_not_to_say）
  /// - height: 身長（cm）
  /// - weight: 体重（kg）
  /// - fitnessGoal: フィットネス目標
  /// - fitnessLevel: フィットネスレベル（beginner, intermediate, advanced）
  Future<Map<String, dynamic>> updateProfile({
    required Map<String, dynamic> profileData,
  }) async {
    try {
      final callable = _functions.httpsCallable('updateProfile');
      final result = await callable.call(profileData);

      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'unauthenticated':
          errorMessage = '認証が必要です';
          break;
        case 'not-found':
          errorMessage = 'ユーザーが見つかりません';
          break;
        case 'invalid-argument':
          // Cloud Functionからの詳細エラーメッセージを使用
          errorMessage = e.message ?? '入力内容に誤りがあります';
          break;
        case 'failed-precondition':
          errorMessage = e.message ?? 'プロフィールを更新できません';
          break;
        default:
          errorMessage = 'プロフィール更新エラー: ${e.message}';
      }
      throw Exception(errorMessage);
    } catch (e) {
      throw Exception('プロフィール更新エラー: $e');
    }
  }
}
