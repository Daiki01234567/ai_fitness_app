/// Form Validators
/// Validation utilities for authentication and user input
///
/// @version 1.0.0
/// @date 2025-11-26

/// Email validator
class EmailValidator {
  static final _emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  );

  /// Validate email format
  static String? validate(String? value) {
    if (value == null || value.isEmpty) {
      return 'メールアドレスを入力してください';
    }
    if (!_emailRegex.hasMatch(value)) {
      return 'メールアドレスの形式が正しくありません';
    }
    return null;
  }
}

/// Password validator
class PasswordValidator {
  /// Minimum password length (per requirements document)
  static const minLength = 8;

  /// Validate password
  static String? validate(String? value) {
    if (value == null || value.isEmpty) {
      return 'パスワードを入力してください';
    }
    if (value.length < minLength) {
      return 'パスワードは$minLength文字以上で入力してください';
    }
    return null;
  }

  /// Validate password strength (for registration)
  static String? validateStrength(String? value) {
    if (value == null || value.isEmpty) {
      return 'パスワードを入力してください';
    }
    if (value.length < minLength) {
      return 'パスワードは$minLength文字以上で入力してください';
    }
    // Check for at least one number
    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'パスワードには数字を含めてください';
    }
    // Check for at least one letter
    if (!RegExp(r'[a-zA-Z]').hasMatch(value)) {
      return 'パスワードには英字を含めてください';
    }
    return null;
  }

  /// Validate password confirmation
  static String? validateConfirmation(String? value, String password) {
    if (value == null || value.isEmpty) {
      return 'パスワード（確認）を入力してください';
    }
    if (value != password) {
      return 'パスワードが一致しません';
    }
    return null;
  }
}

/// Name validator
class NameValidator {
  static const minLength = 1;
  static const maxLength = 20;

  /// Validate name
  static String? validate(String? value) {
    if (value == null || value.isEmpty) {
      return '名前を入力してください';
    }
    if (value.length < minLength) {
      return '名前は$minLength文字以上で入力してください';
    }
    if (value.length > maxLength) {
      return '名前は$maxLength文字以下で入力してください';
    }
    return null;
  }
}

/// Height validator (cm)
class HeightValidator {
  static const minHeight = 100.0;
  static const maxHeight = 250.0;

  /// Validate height
  static String? validate(String? value) {
    if (value == null || value.isEmpty) {
      return '身長を入力してください';
    }
    final height = double.tryParse(value);
    if (height == null) {
      return '数値を入力してください';
    }
    if (height < minHeight || height > maxHeight) {
      return '身長は${minHeight.toInt()}〜${maxHeight.toInt()}cmで入力してください';
    }
    return null;
  }
}

/// Weight validator (kg)
class WeightValidator {
  static const minWeight = 30.0;
  static const maxWeight = 200.0;

  /// Validate weight
  static String? validate(String? value) {
    if (value == null || value.isEmpty) {
      return '体重を入力してください';
    }
    final weight = double.tryParse(value);
    if (weight == null) {
      return '数値を入力してください';
    }
    if (weight < minWeight || weight > maxWeight) {
      return '体重は${minWeight.toInt()}〜${maxWeight.toInt()}kgで入力してください';
    }
    return null;
  }
}

/// Age validator (Japan: 13+)
class AgeValidator {
  static const minAge = 13;
  static const maxAge = 120;

  /// Validate age from birthdate
  static String? validateBirthdate(DateTime? value) {
    if (value == null) {
      return '生年月日を選択してください';
    }
    final now = DateTime.now();
    int age = now.year - value.year;
    if (now.month < value.month ||
        (now.month == value.month && now.day < value.day)) {
      age--;
    }
    if (age < minAge) {
      return '$minAge歳以上の方のみご利用いただけます';
    }
    if (age > maxAge) {
      return '生年月日を確認してください';
    }
    return null;
  }
}

/// Required field validator
class RequiredValidator {
  /// Validate required field
  static String? validate(String? value, [String? fieldName]) {
    if (value == null || value.isEmpty) {
      return fieldName != null ? '$fieldNameを入力してください' : '入力してください';
    }
    return null;
  }
}
