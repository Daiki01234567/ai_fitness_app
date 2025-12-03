// Consent Management Section Widget
//
// Widget for displaying and managing consent status in profile screen.
// Based on: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md (Section 3.12)
// Based on: docs/specs/00_要件定義書_v3_3.md (FR-002-1)
//
// @version 1.1.0
// @date 2025-12-02

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/consent/consent_state_notifier.dart';
import '../../core/router/app_router.dart';

/// Consent management section for profile screen
class ConsentManagementSection extends ConsumerWidget {
  const ConsentManagementSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consentState = ref.watch(consentStateProvider);
    final dateFormat = DateFormat('yyyy年MM月dd日 HH:mm');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section title
            Row(
              children: [
                Icon(
                  Icons.verified_user,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Text(
                  '同意状態',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
            const Divider(height: 24),

            // Terms of Service status
            _buildConsentStatusRow(
              context,
              title: '利用規約',
              version: consentState.tosVersion ?? '未同意',
              isAccepted: consentState.tosAccepted,
              acceptedAt: consentState.tosAcceptedAt,
              dateFormat: dateFormat,
              needsUpdate:
                  consentState.tosAccepted &&
                  consentState.tosVersion != currentTosVersion,
            ),
            const SizedBox(height: 12),

            // Privacy Policy status
            _buildConsentStatusRow(
              context,
              title: 'プライバシーポリシー',
              version: consentState.ppVersion ?? '未同意',
              isAccepted: consentState.ppAccepted,
              acceptedAt: consentState.ppAcceptedAt,
              dateFormat: dateFormat,
              needsUpdate:
                  consentState.ppAccepted &&
                  consentState.ppVersion != currentPpVersion,
            ),
            const SizedBox(height: 16),

            // Update notice if needed
            if (consentState.needsUpdate) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.update,
                      color: Colors.orange,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '新しいバージョンの規約があります。確認をお願いします。',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.orange.shade800,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Actions
            Row(
              children: [
                // View documents
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      _showDocumentViewer(context);
                    },
                    icon: const Icon(Icons.description, size: 18),
                    label: const Text('規約を確認'),
                  ),
                ),
                const SizedBox(width: 12),
                // Revoke consent
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      _showRevokeDialog(context, ref);
                    },
                    icon: const Icon(Icons.cancel, size: 18),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                    ),
                    label: const Text('同意を解除'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConsentStatusRow(
    BuildContext context, {
    required String title,
    required String version,
    required bool isAccepted,
    required DateTime? acceptedAt,
    required DateFormat dateFormat,
    required bool needsUpdate,
  }) {
    return Row(
      children: [
        // Status icon
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isAccepted
                ? (needsUpdate ? Colors.orange : Colors.green)
                : Colors.red,
          ),
          child: Icon(
            isAccepted
                ? (needsUpdate ? Icons.update : Icons.check)
                : Icons.close,
            color: Colors.white,
            size: 16,
          ),
        ),
        const SizedBox(width: 12),

        // Title and version
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .primaryContainer
                          .withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'v$version',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ),
                ],
              ),
              if (acceptedAt != null)
                Text(
                  '同意日: ${dateFormat.format(acceptedAt)}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  void _showDocumentViewer(BuildContext context) {
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
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Title
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.description),
                  const SizedBox(width: 8),
                  Text(
                    '利用規約・プライバシーポリシー',
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
            // Content tabs
            Expanded(
              child: DefaultTabController(
                length: 2,
                child: Column(
                  children: [
                    const TabBar(
                      tabs: [
                        Tab(text: '利用規約'),
                        Tab(text: 'プライバシーポリシー'),
                      ],
                    ),
                    Expanded(
                      child: TabBarView(
                        children: [
                          SingleChildScrollView(
                            controller: scrollController,
                            padding: const EdgeInsets.all(16),
                            child: const SelectableText(_tosFullContent),
                          ),
                          SingleChildScrollView(
                            controller: scrollController,
                            padding: const EdgeInsets.all(16),
                            child: const SelectableText(_ppFullContent),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showRevokeDialog(BuildContext context, WidgetRef ref) async {
    bool requestDeletion = false;

    // Confirmation dialog based on wireframe specification
    // docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md Section 3.12
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.warning_amber, color: Colors.orange),
              SizedBox(width: 8),
              Text('同意を解除しますか？'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '同意を解除すると、サービスを利用できなくなります。',
              ),
              const SizedBox(height: 8),
              const Text(
                'この操作を行うと、自動的にログアウトされます。',
              ),
              const SizedBox(height: 16),
              CheckboxListTile(
                value: requestDeletion,
                onChanged: (value) {
                  setState(() {
                    requestDeletion = value ?? false;
                  });
                },
                title: const Text(
                  'アカウントとデータも削除する',
                  style: TextStyle(fontSize: 14),
                ),
                subtitle: const Text(
                  '30日後にすべてのデータが削除されます',
                  style: TextStyle(fontSize: 12),
                ),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('キャンセル'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(
                foregroundColor: Colors.red,
              ),
              child: const Text('解除する'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && context.mounted) {
      // Show loading
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(),
        ),
      );

      debugPrint('[ConsentRevoke] Starting consent revocation...');

      // Revoke consent via Cloud Function
      final result = await ref
          .read(consentStateProvider.notifier)
          .revokeAllConsents(requestDataDeletion: requestDeletion);

      debugPrint('[ConsentRevoke] Cloud Function result: success=${result.success}, error=${result.error}');

      // Close loading dialog first
      if (context.mounted) {
        Navigator.of(context).pop();
      }

      // Always force logout when user confirms consent revocation
      // Even if Cloud Function fails, we should log out the user
      // Based on: FR-002-1 同意撤回時の強制ログアウト
      //
      // IMPORTANT: We call forceLogout() regardless of context.mounted status
      // because the router will handle navigation based on auth state changes.
      // The forceLogout() sets isForceLogout flag which triggers router redirect.
      debugPrint('[ConsentRevoke] Calling forceLogout()...');
      await ref.read(authStateProvider.notifier).forceLogout();
      debugPrint('[ConsentRevoke] forceLogout() completed');

      // Show warning if Cloud Function failed
      // Note: At this point, context may be unmounted due to auth state change
      if (!result.success && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result.error ?? '同意解除の記録に問題が発生しました。ログアウトします。',
            ),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 3),
          ),
        );
      }

      // Note: Explicit navigation is no longer needed here because:
      // 1. forceLogout() sets isForceLogout flag in auth state
      // 2. Router's redirect function detects forceLoggedOut status
      // 3. Router automatically redirects to login screen
      // Keeping this as a fallback only if context is still valid
      debugPrint('[ConsentRevoke] context.mounted=${context.mounted}');
      if (context.mounted) {
        debugPrint('[ConsentRevoke] Explicitly navigating to login...');
        context.goToLogin();
      }
    }
  }

  // Full ToS content
  static const String _tosFullContent = '''
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

  // Full PP content
  static const String _ppFullContent = '''
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
