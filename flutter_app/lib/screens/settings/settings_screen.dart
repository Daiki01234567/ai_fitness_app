// Settings Screen
//
// Application settings with logout functionality.
// Based on: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 3.13)
//
// @version 1.0.0
// @date 2025-12-02

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';

/// User settings provider for persisting app settings
final settingsProvider = StateNotifierProvider<SettingsNotifier, SettingsState>(
  (ref) => SettingsNotifier(),
);

/// Settings state
class SettingsState {
  final bool audioFeedbackEnabled;
  final bool reminderNotificationEnabled;
  final bool newsNotificationEnabled;

  const SettingsState({
    this.audioFeedbackEnabled = true,
    this.reminderNotificationEnabled = false,
    this.newsNotificationEnabled = true,
  });

  SettingsState copyWith({
    bool? audioFeedbackEnabled,
    bool? reminderNotificationEnabled,
    bool? newsNotificationEnabled,
  }) {
    return SettingsState(
      audioFeedbackEnabled: audioFeedbackEnabled ?? this.audioFeedbackEnabled,
      reminderNotificationEnabled:
          reminderNotificationEnabled ?? this.reminderNotificationEnabled,
      newsNotificationEnabled:
          newsNotificationEnabled ?? this.newsNotificationEnabled,
    );
  }
}

/// Settings state notifier
class SettingsNotifier extends StateNotifier<SettingsState> {
  SettingsNotifier() : super(const SettingsState());

  void setAudioFeedback(bool value) {
    state = state.copyWith(audioFeedbackEnabled: value);
  }

  void setReminderNotification(bool value) {
    state = state.copyWith(reminderNotificationEnabled: value);
  }

  void setNewsNotification(bool value) {
    state = state.copyWith(newsNotificationEnabled: value);
  }
}

/// Settings screen widget
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final settingsNotifier = ref.read(settingsProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('設定'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(AppRoutes.profile),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            // Training settings section
            _buildSectionTitle(context, 'トレーニング'),
            Card(
              child: SwitchListTile(
                title: const Text('音声フィードバック'),
                subtitle: const Text('トレーニング中の音声案内'),
                value: settings.audioFeedbackEnabled,
                onChanged: (value) {
                  settingsNotifier.setAudioFeedback(value);
                },
                secondary: const Icon(Icons.volume_up_outlined),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // Notification settings section
            _buildSectionTitle(context, '通知'),
            Card(
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('リマインダー通知'),
                    subtitle: const Text('トレーニングの時間をお知らせ'),
                    value: settings.reminderNotificationEnabled,
                    onChanged: (value) {
                      settingsNotifier.setReminderNotification(value);
                    },
                    secondary: const Icon(Icons.alarm_outlined),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: const Text('お知らせ通知'),
                    subtitle: const Text('アプリからのお知らせ'),
                    value: settings.newsNotificationEnabled,
                    onChanged: (value) {
                      settingsNotifier.setNewsNotification(value);
                    },
                    secondary: const Icon(Icons.notifications_outlined),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // Account section
            _buildSectionTitle(context, 'アカウント'),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.card_membership_outlined),
                    title: const Text('サブスクリプション管理'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      // TODO: Navigate to subscription management
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('開発中です')),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.description_outlined),
                    title: const Text('利用規約'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _showTermsOfService(context),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined),
                    title: const Text('プライバシーポリシー'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _showPrivacyPolicy(context),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.mail_outlined),
                    title: const Text('お問い合わせ'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _launchContactEmail(context),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(
                      Icons.logout,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    title: Text(
                      'ログアウト',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    onTap: () => _showLogoutDialog(context, ref),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(
                      Icons.delete_forever,
                      color: Theme.of(context).colorScheme.error,
                    ),
                    title: Text(
                      'アカウント削除',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                    subtitle: const Text('30日後に完全削除されます'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.goToAccountDeletion(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // App info section
            _buildSectionTitle(context, 'アプリ情報'),
            Card(
              child: ListTile(
                leading: const Icon(Icons.info_outline),
                title: const Text('バージョン'),
                trailing: Text(
                  '1.0.0',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(
        left: AppSpacing.xs,
        bottom: AppSpacing.sm,
      ),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
      ),
    );
  }

  /// Show logout confirmation dialog
  Future<void> _showLogoutDialog(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('ログアウト'),
        content: const Text('ログアウトしますか？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('キャンセル'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.primary,
            ),
            child: const Text('ログアウト'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      await ref.read(authStateProvider.notifier).signOut();
      if (context.mounted) {
        context.go(AppRoutes.login);
      }
    }
  }

  /// Show terms of service
  void _showTermsOfService(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.description),
                  const SizedBox(width: 8),
                  Text(
                    '利用規約',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.all(16),
                child: const SelectableText(_tosContent),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Show privacy policy
  void _showPrivacyPolicy(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.privacy_tip),
                  const SizedBox(width: 8),
                  Text(
                    'プライバシーポリシー',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.all(16),
                child: const SelectableText(_ppContent),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Launch contact email
  Future<void> _launchContactEmail(BuildContext context) async {
    final Uri emailLaunchUri = Uri(
      scheme: 'mailto',
      path: 'support@example.com',
      queryParameters: {
        'subject': 'AIフィットネスアプリ お問い合わせ',
      },
    );

    try {
      if (await canLaunchUrl(emailLaunchUri)) {
        await launchUrl(emailLaunchUri);
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('メールアプリを開けませんでした')),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('メールアプリを開けませんでした')),
        );
      }
    }
  }

  // Terms of Service content
  static const String _tosContent = '''
AIフィットネスアプリ 利用規約 v3.2

第1条（適用）
本利用規約（以下「本規約」）は、当社が提供するAIフィットネスアプリ（以下「本サービス」）の利用に関する条件を、本サービスを利用するすべてのユーザー（以下「利用者」）と当社との間で定めるものです。

第2条（利用登録）
2.1 利用登録
本サービスの利用を希望する者は、本規約に同意のうえ、当社が定める方法により利用登録を行うものとします。

2.2 年齢制限
本サービスは13歳以上の方を対象としています。13歳未満の方は利用できません。

2.3 登録情報
利用者は、登録情報を正確かつ最新に保つ義務があります。

第3条（アカウント管理）
3.1 利用者は、自己のアカウント情報を適切に管理する責任を負います。
3.2 アカウントの不正使用による損害について、当社は責任を負いません。

第4条（禁止事項）
利用者は以下の行為を行ってはなりません：
- 法令または公序良俗に違反する行為
- 他の利用者または第三者の権利を侵害する行為
- 本サービスの運営を妨害する行為
- 不正アクセスまたはそれを試みる行為
- 虚偽の情報を登録する行為

第5条（免責事項）
5.1 本サービスは医療サービスではありません。
5.2 本サービスの利用による健康上の問題について、当社は責任を負いません。
5.3 利用者は、医療上の助言については医療専門家に相談してください。

第6条（サービスの変更・中断・終了）
6.1 当社は、事前通知により、本サービスの内容を変更することができます。
6.2 システムメンテナンス等により、一時的にサービスを中断することがあります。

第7条（退会）
利用者は、当社が定める方法により、いつでも退会できます。

第8条（規約の変更）
当社は、必要に応じて本規約を変更できます。変更後の規約は、本サービス内での公表をもって効力を生じます。

第9条（準拠法・管轄）
本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。

制定日：2025年11月1日
''';

  // Privacy Policy content
  static const String _ppContent = '''
AIフィットネスアプリ プライバシーポリシー v3.1

1. 個人情報の収集
当社は以下の情報を収集します：

1.1 アカウント情報
- メールアドレス
- 名前（ニックネーム）
- パスワード（暗号化して保存）

1.2 プロフィール情報
- 身長、体重
- 生年月日、年齢
- 性別
- フィットネスレベル

1.3 トレーニングデータ
- 骨格座標データ（33関節の位置情報）
- トレーニングセッション履歴
- スコアと評価

2. 情報の利用目的
収集した情報は以下の目的で利用します：
- サービスの提供・改善
- パーソナライズされたトレーニング体験の提供
- サポート対応
- 統計・分析（個人を特定しない形で）

3. 情報の保護
当社は適切な技術的・組織的措置により、お客様の情報を保護します：
- TLS 1.3による通信の暗号化
- 保存データの暗号化
- アクセス制御

4. 第三者への提供
法令に基づく場合を除き、お客様の同意なく第三者に個人情報を提供しません。

5. データの保存期間
- アカウント情報：アカウント削除後30日間
- トレーニングデータ：2年間
- 同意記録：7年間（法的要件）

6. お客様の権利（GDPR準拠）
お客様には以下の権利があります：
- データへのアクセス権
- データの訂正権
- データの削除権（忘れられる権利）
- データポータビリティの権利
- 同意の撤回権

7. Cookie・トラッキング
本アプリはCookieを使用しません。

8. お問い合わせ
プライバシーに関するお問い合わせ：
privacy@example.com

9. 改定
本ポリシーは必要に応じて改定されます。重要な変更がある場合はアプリ内で通知します。

制定日：2025年11月1日
''';
}
