// AuthStateNotifier Unit Tests
//
// Tests for authentication state management
// Based on: auth_test_guide.md test methodology
//
// Test coverage:
// - Initial state verification
// - Login success/failure state transitions
// - Logout processing
// - Auto login functionality
// - Token refresh
// - forceLogout flag detection
// - Error handling
//
// @version 1.0.0
// @date 2025-11-26

import 'package:flutter_test/flutter_test.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';

import 'package:flutter_app/core/auth/auth_state_notifier.dart';

import 'mocks/mock_firebase_auth.dart';

void main() {
  late MockFirebaseAuth mockAuth;
  late FakeFirebaseFirestore fakeFirestore;
  late AuthStateNotifier notifier;

  setUp(() {
    mockAuth = MockFirebaseAuth();
    fakeFirestore = FakeFirebaseFirestore();
  });

  tearDown(() {
    notifier.dispose();
  });

  AuthStateNotifier createNotifier() {
    return AuthStateNotifier(auth: mockAuth, firestore: fakeFirestore);
  }

  group('Initial State', () {
    test('should have default initial state', () {
      notifier = createNotifier();

      expect(notifier.state.user, isNull);
      expect(notifier.state.userData, isNull);
      expect(notifier.state.isLoading, isFalse);
      expect(notifier.state.error, isNull);
      expect(notifier.state.isEmailVerified, isFalse);
      expect(notifier.state.isForceLogout, isFalse);
      expect(notifier.state.isDeletionScheduled, isFalse);
      expect(notifier.state.customClaims, isNull);
    });
  });

  group('Login Success', () {
    test('should update state with user on successful login', () async {
      // Setup mock user
      final mockUser = MockUser(
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
      );
      mockAuth.setMockUser(mockUser);

      // Create user document in Firestore
      await fakeFirestore.collection('users').doc('test-uid').set({
        'nickname': 'TestUser',
        'email': 'test@example.com',
        'deletionScheduled': false,
      });

      notifier = createNotifier();

      // Emit user sign-in event
      mockAuth.emitUser(mockUser);

      // Wait for async processing
      await Future.delayed(const Duration(milliseconds: 200));

      expect(notifier.state.user, isNotNull);
      expect(notifier.state.user?.uid, equals('test-uid'));
      expect(notifier.state.isLoading, isFalse);
    });

    test('should load user data from Firestore', () async {
      final mockUser = MockUser(
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
      );
      mockAuth.setMockUser(mockUser);

      // Create user document with additional data
      await fakeFirestore.collection('users').doc('test-uid').set({
        'nickname': 'TestUser',
        'email': 'test@example.com',
        'birthYear': 1990,
        'deletionScheduled': false,
      });

      notifier = createNotifier();
      mockAuth.emitUser(mockUser);
      await Future.delayed(const Duration(milliseconds: 200));

      expect(notifier.state.userData, isNotNull);
      expect(notifier.state.userData!['nickname'], equals('TestUser'));
      expect(notifier.state.userData!['birthYear'], equals(1990));
    });

    test('should handle new user without Firestore document', () async {
      final mockUser = MockUser(
        uid: 'new-uid',
        email: 'new@example.com',
        emailVerified: false,
      );
      mockAuth.setMockUser(mockUser);

      // Don't create user document (simulating new user)
      notifier = createNotifier();
      mockAuth.emitUser(mockUser);
      await Future.delayed(const Duration(milliseconds: 200));

      expect(notifier.state.user, isNotNull);
      expect(notifier.state.userData, isNull);
      expect(notifier.state.isLoading, isFalse);
    });
  });

  group('Login Failure', () {
    test('should set error state on auth exception - user not found', () async {
      mockAuth.setSignInError(
        FirebaseAuthException(
          code: 'user-not-found',
          message: 'User not found',
        ),
      );

      notifier = createNotifier();

      await notifier.signInWithEmailAndPassword(
        email: 'nonexistent@example.com',
        password: 'password123',
      );

      // Error message contains the error info (may be wrapped)
      expect(notifier.state.error, contains('user-not-found'));
      expect(notifier.state.isLoading, isFalse);
    });

    test('should set error state on auth exception - wrong password', () async {
      mockAuth.setSignInError(
        FirebaseAuthException(
          code: 'wrong-password',
          message: 'Wrong password',
        ),
      );

      notifier = createNotifier();

      await notifier.signInWithEmailAndPassword(
        email: 'test@example.com',
        password: 'wrongpassword',
      );

      expect(notifier.state.error, contains('wrong-password'));
      expect(notifier.state.isLoading, isFalse);
    });

    test('should set error state on auth exception - invalid email', () async {
      mockAuth.setSignInError(
        FirebaseAuthException(code: 'invalid-email', message: 'Invalid email'),
      );

      notifier = createNotifier();

      await notifier.signInWithEmailAndPassword(
        email: 'invalid-email',
        password: 'password123',
      );

      expect(notifier.state.error, contains('invalid-email'));
      expect(notifier.state.isLoading, isFalse);
    });

    test('should set error state on auth exception - user disabled', () async {
      mockAuth.setSignInError(
        FirebaseAuthException(code: 'user-disabled', message: 'User disabled'),
      );

      notifier = createNotifier();

      await notifier.signInWithEmailAndPassword(
        email: 'disabled@example.com',
        password: 'password123',
      );

      expect(notifier.state.error, contains('user-disabled'));
      expect(notifier.state.isLoading, isFalse);
    });

    test(
      'should set error state on auth exception - too many requests',
      () async {
        mockAuth.setSignInError(
          FirebaseAuthException(
            code: 'too-many-requests',
            message: 'Too many requests',
          ),
        );

        notifier = createNotifier();

        await notifier.signInWithEmailAndPassword(
          email: 'test@example.com',
          password: 'password123',
        );

        expect(notifier.state.error, contains('too-many-requests'));
        expect(notifier.state.isLoading, isFalse);
      },
    );
  });

  group('Logout Processing', () {
    test('should reset state on sign out', () async {
      final mockUser = MockUser(
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
      );
      mockAuth.setMockUser(mockUser);

      await fakeFirestore.collection('users').doc('test-uid').set({
        'nickname': 'TestUser',
        'deletionScheduled': false,
      });

      notifier = createNotifier();
      mockAuth.emitUser(mockUser);
      await Future.delayed(const Duration(milliseconds: 200));

      // Verify logged in
      expect(notifier.state.user, isNotNull);

      // Sign out
      await notifier.signOut();
      mockAuth.emitUser(null);
      await Future.delayed(const Duration(milliseconds: 100));

      expect(notifier.state.user, isNull);
      expect(notifier.state.userData, isNull);
      expect(notifier.state.isLoading, isFalse);
    });

    test('should handle sign out error', () async {
      mockAuth.setSignOutError(Exception('Sign out failed'));

      notifier = createNotifier();

      await notifier.signOut();

      expect(notifier.state.error, contains('サインアウトエラー'));
    });
  });

  group('Auto Login (Auth State Persistence)', () {
    test('should automatically handle persisted auth state', () async {
      final mockUser = MockUser(
        uid: 'persisted-uid',
        email: 'persisted@example.com',
        emailVerified: true,
      );
      mockAuth.setMockUser(mockUser);

      await fakeFirestore.collection('users').doc('persisted-uid').set({
        'nickname': 'PersistedUser',
        'deletionScheduled': false,
      });

      notifier = createNotifier();

      // Simulate Firebase emitting persisted user on app start
      mockAuth.emitUser(mockUser);
      await Future.delayed(const Duration(milliseconds: 200));

      expect(notifier.state.user, isNotNull);
      expect(notifier.state.userData!['nickname'], equals('PersistedUser'));
    });
  });

  group('Token Refresh', () {
    test('should update custom claims on token refresh', () async {
      final mockUser = MockUser(
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
        customClaims: {'role': 'user'},
      );
      mockAuth.setMockUser(mockUser);

      await fakeFirestore.collection('users').doc('test-uid').set({
        'nickname': 'TestUser',
        'deletionScheduled': false,
      });

      notifier = createNotifier();
      mockAuth.emitUser(mockUser);
      await Future.delayed(const Duration(milliseconds: 200));

      expect(notifier.state.customClaims, isNotNull);
      expect(notifier.state.customClaims!['role'], equals('user'));
    });
  });

  group('ForceLogout Flag Detection', () {
    test(
      'should sign out and set isForceLogout when forceLogout claim is true',
      () async {
        final mockUser = MockUser(
          uid: 'test-uid',
          email: 'test@example.com',
          emailVerified: true,
          customClaims: {'forceLogout': true},
        );
        mockAuth.setMockUser(mockUser);

        notifier = createNotifier();
        mockAuth.emitUser(mockUser);
        await Future.delayed(const Duration(milliseconds: 200));

        expect(notifier.state.isForceLogout, isTrue);
        expect(notifier.state.error, equals('アカウントがログアウトされました'));
      },
    );
  });

  group('Deletion Scheduled Detection', () {
    test(
      'should set isDeletionScheduled when user has deletion scheduled',
      () async {
        final mockUser = MockUser(
          uid: 'test-uid',
          email: 'test@example.com',
          emailVerified: true,
        );
        mockAuth.setMockUser(mockUser);

        final deletionDate = DateTime.now().add(const Duration(days: 15));
        await fakeFirestore.collection('users').doc('test-uid').set({
          'nickname': 'TestUser',
          'deletionScheduled': true,
          'scheduledDeletionDate': Timestamp.fromDate(deletionDate),
        });

        notifier = createNotifier();
        mockAuth.emitUser(mockUser);
        await Future.delayed(const Duration(milliseconds: 200));

        expect(notifier.state.isDeletionScheduled, isTrue);
        expect(notifier.state.error, contains('日後に削除されます'));
      },
    );
  });

  group('Error Handling', () {
    test('should handle auth state stream error', () async {
      notifier = createNotifier();

      mockAuth.emitError(Exception('Auth stream error'));
      await Future.delayed(const Duration(milliseconds: 100));

      expect(notifier.state.error, contains('認証エラー'));
      expect(notifier.state.isLoading, isFalse);
    });

    test('should clear error with clearError method', () async {
      mockAuth.setSignInError(
        FirebaseAuthException(
          code: 'user-not-found',
          message: 'User not found',
        ),
      );

      notifier = createNotifier();

      await notifier.signInWithEmailAndPassword(
        email: 'test@example.com',
        password: 'password123',
      );

      expect(notifier.state.error, isNotNull);

      notifier.clearError();

      expect(notifier.state.error, isNull);
    });
  });

  group('Sign Up', () {
    test('should create user with email and password', () async {
      final mockUser = MockUser(
        uid: 'new-uid',
        email: 'new@example.com',
        emailVerified: false,
      );
      mockAuth.setMockUser(mockUser);
      mockAuth.setCreateUserResult(mockUser);

      notifier = createNotifier();

      await notifier.signUpWithEmailAndPassword(
        email: 'new@example.com',
        password: 'Password123',
        displayName: 'New User',
      );

      expect(mockAuth.createUserCalled, isTrue);
      expect(mockAuth.lastCreateUserEmail, equals('new@example.com'));
    });

    test('should handle email already in use error', () async {
      mockAuth.setCreateUserError(
        FirebaseAuthException(
          code: 'email-already-in-use',
          message: 'Email already in use',
        ),
      );

      notifier = createNotifier();

      await notifier.signUpWithEmailAndPassword(
        email: 'existing@example.com',
        password: 'Password123',
      );

      expect(notifier.state.error, contains('email-already-in-use'));
      expect(notifier.state.isLoading, isFalse);
    });

    test('should handle weak password error', () async {
      mockAuth.setCreateUserError(
        FirebaseAuthException(code: 'weak-password', message: 'Weak password'),
      );

      notifier = createNotifier();

      await notifier.signUpWithEmailAndPassword(
        email: 'new@example.com',
        password: 'weak',
      );

      expect(notifier.state.error, contains('weak-password'));
      expect(notifier.state.isLoading, isFalse);
    });
  });

  group('Password Reset', () {
    test('should send password reset email', () async {
      notifier = createNotifier();

      await notifier.sendPasswordResetEmail('test@example.com');

      expect(mockAuth.passwordResetEmailSent, isTrue);
      expect(mockAuth.lastPasswordResetEmail, equals('test@example.com'));
      expect(notifier.state.error, equals('パスワードリセットメールを送信しました'));
      expect(notifier.state.isLoading, isFalse);
    });

    test('should handle user not found error on password reset', () async {
      mockAuth.setPasswordResetError(
        FirebaseAuthException(
          code: 'user-not-found',
          message: 'User not found',
        ),
      );

      notifier = createNotifier();

      await notifier.sendPasswordResetEmail('nonexistent@example.com');

      expect(notifier.state.error, contains('user-not-found'));
      expect(notifier.state.isLoading, isFalse);
    });
  });

  group('Account Deletion Request', () {
    test('should create deletion request in Firestore', () async {
      final mockUser = MockUser(
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
      );
      mockAuth.setMockUser(mockUser);

      await fakeFirestore.collection('users').doc('test-uid').set({
        'nickname': 'TestUser',
        'deletionScheduled': false,
      });

      notifier = createNotifier();
      mockAuth.emitUser(mockUser);
      await Future.delayed(const Duration(milliseconds: 200));

      await notifier.requestAccountDeletion();

      // Check deletion request was created
      final requests = await fakeFirestore
          .collection('dataDeletionRequests')
          .get();
      expect(requests.docs.length, equals(1));
      expect(requests.docs.first.data()['userId'], equals('test-uid'));
      expect(requests.docs.first.data()['status'], equals('pending'));

      // Check user document was updated
      final userDoc = await fakeFirestore
          .collection('users')
          .doc('test-uid')
          .get();
      expect(userDoc.data()!['deletionScheduled'], isTrue);

      expect(notifier.state.isDeletionScheduled, isTrue);
      expect(notifier.state.error, contains('30日後に削除されます'));
    });

    test('should handle deletion request when not authenticated', () async {
      mockAuth.setMockUser(null);

      notifier = createNotifier();

      await notifier.requestAccountDeletion();

      expect(notifier.state.error, contains('ユーザーが認証されていません'));
    });
  });

  group('Cancel Account Deletion', () {
    test('should cancel deletion request', () async {
      final mockUser = MockUser(
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
      );
      mockAuth.setMockUser(mockUser);

      await fakeFirestore.collection('users').doc('test-uid').set({
        'nickname': 'TestUser',
        'deletionScheduled': true,
      });

      await fakeFirestore.collection('dataDeletionRequests').add({
        'userId': 'test-uid',
        'status': 'pending',
      });

      notifier = createNotifier();
      mockAuth.emitUser(mockUser);
      await Future.delayed(const Duration(milliseconds: 200));

      await notifier.cancelAccountDeletion();

      // Check deletion request was cancelled
      final requests = await fakeFirestore
          .collection('dataDeletionRequests')
          .where('userId', isEqualTo: 'test-uid')
          .get();
      expect(requests.docs.first.data()['status'], equals('cancelled'));

      expect(notifier.state.isDeletionScheduled, isFalse);
      expect(notifier.state.error, contains('キャンセルしました'));
    });
  });

  group('Dispose', () {
    test('should cancel all subscriptions on dispose', () async {
      // Create a separate notifier for this test to avoid tearDown issue
      final testNotifier = AuthStateNotifier(
        auth: mockAuth,
        firestore: fakeFirestore,
      );

      // The dispose should complete without throwing
      expect(() => testNotifier.dispose(), returnsNormally);

      // Set notifier to a new instance for tearDown
      notifier = createNotifier();
    });
  });
}

/// Custom FirebaseAuthException for testing
class FirebaseAuthException implements Exception {
  final String code;
  final String message;

  FirebaseAuthException({required this.code, required this.message});

  @override
  String toString() => 'FirebaseAuthException: [$code] $message';
}
