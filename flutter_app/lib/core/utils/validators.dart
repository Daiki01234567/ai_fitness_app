// フォームバリデーター
// 認証およびユーザー入力用のバリデーションユーティリティ
//
// @version 1.0.0
// @date 2025-11-26

/// メールバリデーター
class EmailValidator {
  static final _emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  );

  /// メール形式を検証
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

/// パスワードバリデーター
class PasswordValidator {
  /// 最小パスワード長（要件定義書に基づく）
  static const minLength = 8;

  /// パスワードを検証
  static String? validate(String? value) {
    if (value == null || value.isEmpty) {
      return 'パスワードを入力してください';
    }
    if (value.length < minLength) {
      return 'パスワードは$minLength文字以上で入力してください';
    }
    return null;
  }

  /// パスワード強度を検証（新規登録用）
  static String? validateStrength(String? value) {
    if (value == null || value.isEmpty) {
      return 'パスワードを入力してください';
    }
    if (value.length < minLength) {
      return 'パスワードは$minLength文字以上で入力してください';
    }
    // 少なくとも1つの数字をチェック
    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'パスワードには数字を含めてください';
    }
    // 少なくとも1つの英字をチェック
    if (!RegExp(r'[a-zA-Z]').hasMatch(value)) {
      return 'パスワードには英字を含めてください';
    }
    return null;
  }

  /// パスワード確認を検証
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

/// 名前バリデーター
class NameValidator {
  static const minLength = 1;
  static const maxLength = 20;

  /// 名前を検証
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

/// 身長バリデーター（cm）
class HeightValidator {
  static const minHeight = 100.0;
  static const maxHeight = 250.0;

  /// 身長を検証
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

/// 体重バリデーター（kg）
class WeightValidator {
  static const minWeight = 30.0;
  static const maxWeight = 200.0;

  /// 体重を検証
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

/// 年齢バリデーター（日本: 13歳以上）
class AgeValidator {
  static const minAge = 13;
  static const maxAge = 120;

  /// 生年月日から年齢を検証
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

/// 必須フィールドバリデーター
class RequiredValidator {
  /// 必須フィールドを検証
  static String? validate(String? value, [String? fieldName]) {
    if (value == null || value.isEmpty) {
      return fieldName != null ? '$fieldNameを入力してください' : '入力してください';
    }
    return null;
  }
}

/// 統合バリデーター（便利なアクセス用）
class Validators {
  Validators._();

  /// メールアドレスを検証
  static String? email(String? value) => EmailValidator.validate(value);

  /// パスワードを検証
  static String? password(String? value) => PasswordValidator.validate(value);

  /// パスワード強度を検証（新規登録用）
  static String? passwordStrength(String? value) =>
      PasswordValidator.validateStrength(value);

  /// パスワード確認を検証
  static String? passwordConfirmation(String? value, String password) =>
      PasswordValidator.validateConfirmation(value, password);

  /// 名前を検証
  static String? name(String? value) => NameValidator.validate(value);

  /// 身長を検証
  static String? height(String? value) => HeightValidator.validate(value);

  /// 体重を検証
  static String? weight(String? value) => WeightValidator.validate(value);

  /// 生年月日を検証
  static String? birthdate(DateTime? value) =>
      AgeValidator.validateBirthdate(value);

  /// 必須フィールドを検証
  static String? required(String? value, [String? fieldName]) =>
      RequiredValidator.validate(value, fieldName);
}
