// Mock FirebaseAuth for testing
//
// Provides a testable implementation of FirebaseAuth
// without requiring actual Firebase initialization.
//
// @version 1.0.0
// @date 2025-11-26

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';

// Re-export the real FirebaseAuthException type for tests
typedef TestFirebaseAuthException = FirebaseAuthException;

/// Mock implementation of FirebaseAuth for unit testing
class MockFirebaseAuth implements FirebaseAuth {
  final StreamController<User?> _authStateController =
      StreamController<User?>.broadcast();

  MockUser? _currentUser;
  Exception? _signInError;
  Exception? _signOutError;
  Exception? _createUserError;
  Exception? _passwordResetError;
  MockUser? _createUserResult;

  bool createUserCalled = false;
  String? lastCreateUserEmail;
  bool passwordResetEmailSent = false;
  String? lastPasswordResetEmail;

  void setMockUser(MockUser? user) {
    _currentUser = user;
  }

  void emitUser(User? user) {
    _authStateController.add(user);
  }

  void emitError(Exception error) {
    _authStateController.addError(error);
  }

  void setSignInError(Exception error) {
    _signInError = error;
  }

  void setSignOutError(Exception error) {
    _signOutError = error;
  }

  void setCreateUserError(Exception error) {
    _createUserError = error;
  }

  void setCreateUserResult(MockUser user) {
    _createUserResult = user;
  }

  void setPasswordResetError(Exception error) {
    _passwordResetError = error;
  }

  void dispose() {
    _authStateController.close();
  }

  @override
  User? get currentUser => _currentUser;

  @override
  Stream<User?> authStateChanges() => _authStateController.stream;

  @override
  Stream<User?> idTokenChanges() => _authStateController.stream;

  @override
  Stream<User?> userChanges() => _authStateController.stream;

  @override
  Future<UserCredential> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    if (_signInError != null) {
      throw _signInError!;
    }
    return MockUserCredential(_currentUser);
  }

  @override
  Future<UserCredential> createUserWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    createUserCalled = true;
    lastCreateUserEmail = email;
    if (_createUserError != null) {
      throw _createUserError!;
    }
    return MockUserCredential(_createUserResult ?? _currentUser);
  }

  @override
  Future<void> sendPasswordResetEmail({
    required String email,
    ActionCodeSettings? actionCodeSettings,
  }) async {
    if (_passwordResetError != null) {
      throw _passwordResetError!;
    }
    passwordResetEmailSent = true;
    lastPasswordResetEmail = email;
  }

  @override
  Future<void> signOut() async {
    if (_signOutError != null) {
      throw _signOutError!;
    }
    _currentUser = null;
  }

  // Required overrides - not used in tests
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Mock implementation of User for unit testing
class MockUser implements User {
  @override
  final String uid;

  @override
  final String? email;

  @override
  final bool emailVerified;

  final Map<String, dynamic>? customClaims;

  String? _displayName;

  MockUser({
    required this.uid,
    this.email,
    this.emailVerified = false,
    this.customClaims,
    String? displayName,
  }) : _displayName = displayName;

  @override
  String? get displayName => _displayName;

  @override
  Future<void> reload() async {}

  @override
  Future<IdTokenResult> getIdTokenResult([bool forceRefresh = false]) async {
    return MockIdTokenResult(customClaims ?? {});
  }

  @override
  Future<String> getIdToken([bool forceRefresh = false]) async {
    return 'mock-token';
  }

  @override
  Future<void> updateDisplayName(String? displayName) async {
    _displayName = displayName;
  }

  @override
  Future<void> sendEmailVerification([
    ActionCodeSettings? actionCodeSettings,
  ]) async {}

  // Required overrides - not used in tests
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Mock implementation of UserCredential for unit testing
class MockUserCredential implements UserCredential {
  @override
  final User? user;

  MockUserCredential(this.user);

  @override
  AdditionalUserInfo? get additionalUserInfo => null;

  @override
  AuthCredential? get credential => null;

  // Required overrides - not used in tests
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Mock implementation of IdTokenResult for unit testing
class MockIdTokenResult implements IdTokenResult {
  @override
  final Map<String, dynamic>? claims;

  MockIdTokenResult(this.claims);

  @override
  DateTime? get authTime => DateTime.now();

  @override
  DateTime? get expirationTime => DateTime.now().add(const Duration(hours: 1));

  @override
  DateTime? get issuedAtTime => DateTime.now();

  // Note: signInSecondFactor is not in IdTokenResult interface
  String? get signInSecondFactor => null;

  @override
  String? get token => 'mock-token';

  // Required overrides - not used in tests
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
