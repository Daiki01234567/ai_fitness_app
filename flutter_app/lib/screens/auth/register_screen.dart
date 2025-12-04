// Registration Screen
// 2-step registration: Auth info + Profile info
//
// @version 1.0.0
// @date 2025-11-26

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/consent/consent_state_notifier.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/auth_widgets.dart';

/// Registration steps
enum RegisterStep { auth, profile }

/// Fitness goals
enum FitnessGoal {
  loseWeight('ダイエット', Icons.monitor_weight_outlined),
  buildMuscle('筋力アップ', Icons.fitness_center),
  improveHealth('健康維持', Icons.favorite_outline),
  stayActive('運動習慣', Icons.directions_run);

  const FitnessGoal(this.label, this.icon);
  final String label;
  final IconData icon;
}

/// Gender options
enum Gender {
  male('男性', 'male'),
  female('女性', 'female'),
  other('その他', 'other'),
  preferNotToSay('回答しない', 'prefer_not_to_say');

  const Gender(this.label, this.value);
  final String label;
  final String value;
}

/// Fitness level options
enum FitnessLevel {
  beginner('初心者', 'beginner', '運動を始めたばかり'),
  intermediate('中級者', 'intermediate', '定期的に運動している'),
  advanced('上級者', 'advanced', '高強度のトレーニングが可能');

  const FitnessLevel(this.label, this.value, this.description);
  final String label;
  final String value;
  final String description;
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  RegisterStep _currentStep = RegisterStep.auth;

  // Step 1: Auth fields
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordConfirmController = TextEditingController();
  final _nameController = TextEditingController();

  // Step 2: Profile fields
  final _heightController = TextEditingController();
  final _weightController = TextEditingController();
  DateTime? _birthDate;
  Gender? _selectedGender;
  FitnessLevel? _selectedFitnessLevel;
  FitnessGoal? _selectedGoal;

  // Loading states
  bool _isGoogleLoading = false;
  bool _isAppleLoading = false;

  // Email check state
  bool _isCheckingEmail = false;
  String? _emailError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _passwordConfirmController.dispose();
    _nameController.dispose();
    _heightController.dispose();
    _weightController.dispose();
    super.dispose();
  }

  /// 次のステップに進む
  ///
  /// ステップ1からステップ2に進む前に:
  /// 1. フォームバリデーション
  /// 2. メールアドレス重複チェック（Cloud Functions呼び出し）
  Future<void> _nextStep() async {
    // Clear previous email error
    setState(() {
      _emailError = null;
    });

    // Validate form first
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Check email duplication
    setState(() {
      _isCheckingEmail = true;
    });

    try {
      final authService = ref.read(authServiceProvider);
      final email = _emailController.text.trim();

      final result = await authService.checkEmailExists(email);

      if (!mounted) return;

      if (result.exists) {
        // Email already registered
        setState(() {
          _emailError = result.message ?? 'このメールアドレスは既に登録されています';
          _isCheckingEmail = false;
        });

        // Show error in snackbar as well
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_emailError!),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
        return;
      }

      // Email is available, proceed to next step
      setState(() {
        _isCheckingEmail = false;
        _currentStep = RegisterStep.profile;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isCheckingEmail = false;
      });

      // Show error message
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  void _previousStep() {
    setState(() {
      _currentStep = RegisterStep.auth;
    });
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Validate birthdate
    final birthdateError = AgeValidator.validateBirthdate(_birthDate);
    if (birthdateError != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(birthdateError)));
      return;
    }

    // Validate goal selection
    if (_selectedGoal == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('目標を選択してください')));
      return;
    }

    // IMPORTANT: Get services BEFORE registration
    // After registration, the router may redirect and dispose this widget
    final authService = ref.read(authServiceProvider);
    final authNotifier = ref.read(authStateProvider.notifier);
    final consentNotifier = ref.read(consentStateProvider.notifier);

    // Prepare profile data BEFORE registration (widget may be disposed after)
    final profileData = <String, dynamic>{
      'displayName': _nameController.text.trim(),
    };

    // Add gender
    if (_selectedGender != null) {
      profileData['gender'] = _selectedGender!.value;
    }

    // Add birthdate in ISO 8601 format
    if (_birthDate != null) {
      profileData['dateOfBirth'] = _birthDate!.toIso8601String().split('T')[0];
    }

    // Add height
    final height = double.tryParse(_heightController.text.trim());
    if (height != null) {
      profileData['height'] = height;
    }

    // Add weight
    final weight = double.tryParse(_weightController.text.trim());
    if (weight != null) {
      profileData['weight'] = weight;
    }

    // Add fitness level
    if (_selectedFitnessLevel != null) {
      profileData['fitnessLevel'] = _selectedFitnessLevel!.value;
    }

    // Add fitness goal
    if (_selectedGoal != null) {
      profileData['fitnessGoal'] = _selectedGoal!.label;
    }

    // Capture ScaffoldMessenger before async operation
    final scaffoldMessenger = ScaffoldMessenger.of(context);

    try {
      // Step 1: Create Firebase Auth account
      await authNotifier.signUpWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        displayName: _nameController.text.trim(),
      );

      // Step 2: Wait for user document to be created by onCreate trigger
      // This prevents race condition where updateProfile is called before document exists
      // Note: onCreate trigger runs in us-central1 (Firebase v1 API limitation)
      // which may cause delays when accessed from Japan
      await _waitForUserDocument();

      // Step 2.5: Immediately set consent state to prevent consent screen flickering
      // The onCreate trigger creates user document with tosAccepted=true, ppAccepted=true
      // Set local state immediately so router doesn't redirect to consent screen
      // while waiting for Firestore listener to receive the update
      consentNotifier.setConsentAccepted(
        tosAccepted: true,
        ppAccepted: true,
      );

      // Step 3: Save profile data to Firestore via Cloud Function
      // Note: This runs even if widget is disposed - that's intentional
      try {
        await authService.updateProfile(profileData: profileData);
      } catch (e) {
        // Profile save failed but account was created
        // Show warning but don't block - profile can be updated later
        scaffoldMessenger.showSnackBar(
          SnackBar(
            content: Text('アカウントは作成されましたが、プロフィールの保存に失敗しました: $e'),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } catch (e) {
      // Handle errors from auth or document wait
      scaffoldMessenger.showSnackBar(
        SnackBar(
          content: Text('登録エラー: $e'),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 5),
        ),
      );
    }
  }

  /// Wait for user document to be created by onCreate trigger
  ///
  /// Note: Firebase Auth onCreate trigger runs in us-central1 (v1 API limitation)
  /// which causes latency when accessed from Japan. Retry settings are set
  /// generously to handle this cross-region delay.
  ///
  /// Retries up to 30 times with 1 second delay (total: 30 seconds max wait)
  Future<void> _waitForUserDocument() async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    final firestore = FirebaseFirestore.instance;
    const maxRetries =
        30; // Increased for cross-region latency (us-central1 → Japan)
    const retryDelay = Duration(seconds: 1);

    for (int i = 0; i < maxRetries; i++) {
      debugPrint('Waiting for user document... attempt ${i + 1}/$maxRetries');
      final doc = await firestore.collection('users').doc(userId).get();
      if (doc.exists) {
        debugPrint('User document found after ${i + 1} attempts');
        return; // Document found, proceed
      }
      await Future.delayed(retryDelay);
    }

    // Document not found after all retries - throw exception to trigger error handling
    debugPrint('Error: User document not found after $maxRetries retries');
    throw Exception('ユーザードキュメントの作成がタイムアウトしました。再度お試しください。');
  }

  Future<void> _selectBirthDate() async {
    final now = DateTime.now();
    final initialDate =
        _birthDate ?? DateTime(now.year - 25, now.month, now.day);

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1900),
      lastDate: DateTime(now.year - 13, now.month, now.day),
      locale: const Locale('ja', 'JP'),
      helpText: '生年月日を選択',
      cancelText: 'キャンセル',
      confirmText: '決定',
    );

    if (picked != null) {
      setState(() {
        _birthDate = picked;
      });
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() => _isGoogleLoading = true);

    try {
      // TODO: Implement Google Sign In
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Googleログインは準備中です')));
      }
    } finally {
      if (mounted) {
        setState(() => _isGoogleLoading = false);
      }
    }
  }

  Future<void> _handleAppleSignIn() async {
    setState(() => _isAppleLoading = true);

    try {
      // TODO: Implement Apple Sign In
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Appleログインは準備中です')));
      }
    } finally {
      if (mounted) {
        setState(() => _isAppleLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_currentStep == RegisterStep.profile) {
              _previousStep();
            } else {
              context.go(AppRoutes.login);
            }
          },
        ),
        title: Text(_currentStep == RegisterStep.auth ? '新規登録' : 'プロフィール設定'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Step indicator
                    _buildStepIndicator(),
                    const SizedBox(height: AppSpacing.lg),

                    // Error message
                    if (authState.error != null) ...[
                      ErrorMessageCard(
                        message: authState.error!,
                        onDismiss: () {
                          ref.read(authStateProvider.notifier).clearError();
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    // Current step content
                    if (_currentStep == RegisterStep.auth)
                      _buildAuthStep(authState)
                    else
                      _buildProfileStep(authState),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    final colorScheme = Theme.of(context).colorScheme;
    final isStep1Active = _currentStep == RegisterStep.auth;

    return Row(
      children: [
        Expanded(
          child: _buildStepItem(
            number: '1',
            label: 'アカウント',
            isActive: true,
            isCompleted: !isStep1Active,
          ),
        ),
        Container(
          width: 40,
          height: 2,
          color: isStep1Active
              ? colorScheme.outlineVariant
              : colorScheme.primary,
        ),
        Expanded(
          child: _buildStepItem(
            number: '2',
            label: 'プロフィール',
            isActive: !isStep1Active,
            isCompleted: false,
          ),
        ),
      ],
    );
  }

  Widget _buildStepItem({
    required String number,
    required String label,
    required bool isActive,
    required bool isCompleted,
  }) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: isActive || isCompleted
                ? colorScheme.primary
                : colorScheme.surfaceContainerHighest,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: isCompleted
                ? Icon(Icons.check, size: 16, color: colorScheme.onPrimary)
                : Text(
                    number,
                    style: TextStyle(
                      color: isActive
                          ? colorScheme.onPrimary
                          : colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: isActive
                ? colorScheme.primary
                : colorScheme.onSurfaceVariant,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ],
    );
  }

  Widget _buildAuthStep(AuthState authState) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Name field
        AuthTextField(
          controller: _nameController,
          label: '名前（ニックネーム）',
          hint: 'あなたの名前',
          prefixIcon: Icons.person_outline,
          textInputAction: TextInputAction.next,
          validator: NameValidator.validate,
          enabled: !authState.isLoading,
          maxLength: 20,
        ),
        const SizedBox(height: AppSpacing.md),

        // Email field
        AuthTextField(
          controller: _emailController,
          label: 'メールアドレス',
          hint: 'example@email.com',
          prefixIcon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          validator: (value) {
            // First check standard email validation
            final standardError = EmailValidator.validate(value);
            if (standardError != null) {
              return standardError;
            }
            // Then show server-side duplicate error if exists
            if (_emailError != null) {
              return _emailError;
            }
            return null;
          },
          enabled: !authState.isLoading && !_isCheckingEmail,
          autofillHints: const [AutofillHints.email],
          onChanged: (value) {
            // Clear email error when user modifies the field
            if (_emailError != null) {
              setState(() {
                _emailError = null;
              });
            }
          },
        ),
        const SizedBox(height: AppSpacing.md),

        // Password field
        PasswordTextField(
          controller: _passwordController,
          label: 'パスワード',
          hint: '8文字以上（英数字を含む）',
          textInputAction: TextInputAction.next,
          validator: PasswordValidator.validateStrength,
          enabled: !authState.isLoading,
          autofillHints: const [AutofillHints.newPassword],
        ),
        const SizedBox(height: AppSpacing.md),

        // Password confirmation field
        PasswordTextField(
          controller: _passwordConfirmController,
          label: 'パスワード（確認）',
          textInputAction: TextInputAction.done,
          validator: (value) => PasswordValidator.validateConfirmation(
            value,
            _passwordController.text,
          ),
          enabled: !authState.isLoading,
        ),
        const SizedBox(height: AppSpacing.lg),

        // Next button
        LoadingButton(
          onPressed: _isCheckingEmail ? null : _nextStep,
          label: '次へ',
          isLoading: _isCheckingEmail,
        ),
        const SizedBox(height: AppSpacing.lg),

        // Divider
        const DividerWithText(text: 'または'),
        const SizedBox(height: AppSpacing.lg),

        // Social sign up buttons
        SocialSignInButton(
          onPressed: _handleGoogleSignIn,
          label: 'Googleで登録',
          icon: Icon(
            Icons.g_mobiledata,
            size: 24,
            color: colorScheme.onSurface,
          ),
          isLoading: _isGoogleLoading,
        ),
        const SizedBox(height: AppSpacing.sm),

        SocialSignInButton(
          onPressed: _handleAppleSignIn,
          label: 'Appleで登録',
          icon: Icon(Icons.apple, size: 24, color: colorScheme.onSurface),
          isLoading: _isAppleLoading,
        ),
        const SizedBox(height: AppSpacing.xl),

        // Login link
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '既にアカウントをお持ちの方は',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            TextButton(
              onPressed: authState.isLoading
                  ? null
                  : () => context.go(AppRoutes.login),
              child: const Text('ログイン'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildProfileStep(AuthState authState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Gender selection
        Text('性別', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        _buildGenderSelection(authState),
        const SizedBox(height: AppSpacing.lg),

        // Height field
        AuthTextField(
          controller: _heightController,
          label: '身長 (cm)',
          hint: '170',
          prefixIcon: Icons.height,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textInputAction: TextInputAction.next,
          validator: HeightValidator.validate,
          enabled: !authState.isLoading,
        ),
        const SizedBox(height: AppSpacing.md),

        // Weight field
        AuthTextField(
          controller: _weightController,
          label: '体重 (kg)',
          hint: '65',
          prefixIcon: Icons.monitor_weight_outlined,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textInputAction: TextInputAction.done,
          validator: WeightValidator.validate,
          enabled: !authState.isLoading,
        ),
        const SizedBox(height: AppSpacing.md),

        // Birthdate picker
        _buildBirthdatePicker(authState),
        const SizedBox(height: AppSpacing.lg),

        // Fitness level selection
        Text('運動経験', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        _buildFitnessLevelSelection(authState),
        const SizedBox(height: AppSpacing.lg),

        // Goal selection
        Text('目標を選択', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        _buildGoalSelection(authState),
        const SizedBox(height: AppSpacing.xl),

        // Register button
        LoadingButton(
          onPressed: _handleRegister,
          label: '登録する',
          isLoading: authState.isLoading,
        ),
        const SizedBox(height: AppSpacing.md),

        // Back button
        OutlinedLoadingButton(
          onPressed: authState.isLoading ? null : _previousStep,
          label: '戻る',
        ),
      ],
    );
  }

  Widget _buildBirthdatePicker(AuthState authState) {
    final colorScheme = Theme.of(context).colorScheme;

    return InkWell(
      onTap: authState.isLoading ? null : _selectBirthDate,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: '生年月日',
          prefixIcon: const Icon(Icons.calendar_today_outlined),
          suffixIcon: const Icon(Icons.arrow_drop_down),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          enabled: !authState.isLoading,
        ),
        child: Text(
          _birthDate != null
              ? '${_birthDate!.year}年${_birthDate!.month}月${_birthDate!.day}日'
              : '選択してください',
          style: TextStyle(
            color: _birthDate != null
                ? colorScheme.onSurface
                : colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }

  Widget _buildGenderSelection(AuthState authState) {
    final colorScheme = Theme.of(context).colorScheme;

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: Gender.values.map((gender) {
        final isSelected = _selectedGender == gender;

        return ChoiceChip(
          label: Text(gender.label),
          selected: isSelected,
          onSelected: authState.isLoading
              ? null
              : (selected) {
                  setState(() {
                    _selectedGender = selected ? gender : null;
                  });
                },
          selectedColor: colorScheme.primaryContainer,
          labelStyle: TextStyle(
            color: isSelected
                ? colorScheme.onPrimaryContainer
                : colorScheme.onSurfaceVariant,
          ),
        );
      }).toList(),
    );
  }

  Widget _buildFitnessLevelSelection(AuthState authState) {
    final colorScheme = Theme.of(context).colorScheme;

    return RadioGroup<FitnessLevel>(
      groupValue: _selectedFitnessLevel,
      onChanged: (value) {
        if (!authState.isLoading) {
          setState(() {
            _selectedFitnessLevel = value;
          });
        }
      },
      child: Column(
        children: FitnessLevel.values.map((level) {
          final isSelected = _selectedFitnessLevel == level;

          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: InkWell(
              onTap: authState.isLoading
                  ? null
                  : () {
                      setState(() {
                        _selectedFitnessLevel = level;
                      });
                    },
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: isSelected
                        ? colorScheme.primary
                        : colorScheme.outlineVariant,
                    width: isSelected ? 2 : 1,
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  color: isSelected
                      ? colorScheme.primaryContainer.withValues(alpha: 0.3)
                      : null,
                ),
                child: Row(
                  children: [
                    // Radio managed by RadioGroup ancestor
                    Radio<FitnessLevel>.adaptive(value: level),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            level.label,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  fontWeight: isSelected
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                ),
                          ),
                          Text(
                            level.description,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: colorScheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildGoalSelection(AuthState authState) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: FitnessGoal.values.map((goal) {
        final isSelected = _selectedGoal == goal;
        final colorScheme = Theme.of(context).colorScheme;

        return FilterChip(
          label: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                goal.icon,
                size: 18,
                color: isSelected
                    ? colorScheme.onPrimaryContainer
                    : colorScheme.onSurfaceVariant,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(goal.label),
            ],
          ),
          selected: isSelected,
          onSelected: authState.isLoading
              ? null
              : (selected) {
                  setState(() {
                    _selectedGoal = selected ? goal : null;
                  });
                },
          showCheckmark: false,
        );
      }).toList(),
    );
  }
}
