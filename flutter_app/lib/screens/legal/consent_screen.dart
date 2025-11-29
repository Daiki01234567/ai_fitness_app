// Consent Screen
//
// GDPR-compliant consent screen for Terms of Service and Privacy Policy.
// Based on: docs/specs/00_要件定義書_v3_3.md (FR-024-1)
//
// @version 1.0.0
// @date 2025-11-27

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_state_notifier.dart';
import '../../core/consent/consent_state_notifier.dart';
import '../../core/router/app_router.dart';

/// Consent screen for ToS and PP acceptance
class ConsentScreen extends ConsumerStatefulWidget {
  const ConsentScreen({super.key});

  @override
  ConsumerState<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends ConsumerState<ConsentScreen> {
  bool _tosChecked = false;
  bool _ppChecked = false;
  bool _tosScrolledToEnd = false;
  bool _ppScrolledToEnd = false;
  bool _isSubmitting = false;

  final _tosScrollController = ScrollController();
  final _ppScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _tosScrollController.addListener(_onTosScroll);
    _ppScrollController.addListener(_onPpScroll);
  }

  @override
  void dispose() {
    _tosScrollController.removeListener(_onTosScroll);
    _ppScrollController.removeListener(_onPpScroll);
    _tosScrollController.dispose();
    _ppScrollController.dispose();
    super.dispose();
  }

  void _onTosScroll() {
    if (_tosScrollController.position.pixels >=
        _tosScrollController.position.maxScrollExtent - 50) {
      if (!_tosScrolledToEnd) {
        setState(() {
          _tosScrolledToEnd = true;
        });
      }
    }
  }

  void _onPpScroll() {
    if (_ppScrollController.position.pixels >=
        _ppScrollController.position.maxScrollExtent - 50) {
      if (!_ppScrolledToEnd) {
        setState(() {
          _ppScrolledToEnd = true;
        });
      }
    }
  }

  Future<void> _handleAcceptAll() async {
    if (!_tosChecked || !_ppChecked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('すべての項目に同意してください'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final success =
          await ref.read(consentStateProvider.notifier).acceptAllConsents();

      if (success) {
        if (mounted) {
          context.go(AppRoutes.home);
        }
      } else {
        if (mounted) {
          final error = ref.read(consentStateProvider).error;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(error ?? '同意の記録に失敗しました'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _handleDecline() async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('同意しない'),
        content: const Text(
          '利用規約およびプライバシーポリシーに同意しないと、'
          'アプリを使用できません。ログアウトしますか？',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('いいえ'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Colors.red,
            ),
            child: const Text('はい、ログアウトする'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      // Use forceLogout to ensure router redirects to login screen
      await ref.read(authStateProvider.notifier).forceLogout();
      // Note: context.go is not needed as forceLogout triggers router redirect
    }
  }

  @override
  Widget build(BuildContext context) {
    // Watch consent state for reactive updates
    ref.watch(consentStateProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('利用規約への同意'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Main content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Introduction
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.info_outline,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'サービスご利用の前に',
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'アプリをご利用いただくには、以下の利用規約および'
                              'プライバシーポリシーへの同意が必要です。'
                              '内容をお読みいただき、同意される場合はチェックを入れてください。',
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Terms of Service section
                    _buildConsentSection(
                      context,
                      title: '利用規約',
                      version: 'v$currentTosVersion',
                      scrollController: _tosScrollController,
                      scrolledToEnd: _tosScrolledToEnd,
                      isChecked: _tosChecked,
                      onChecked: (value) {
                        setState(() {
                          _tosChecked = value ?? false;
                        });
                      },
                      content: _tosContent,
                      documentUrl: 'https://example.com/terms',
                    ),
                    const SizedBox(height: 24),

                    // Privacy Policy section
                    _buildConsentSection(
                      context,
                      title: 'プライバシーポリシー',
                      version: 'v$currentPpVersion',
                      scrollController: _ppScrollController,
                      scrolledToEnd: _ppScrolledToEnd,
                      isChecked: _ppChecked,
                      onChecked: (value) {
                        setState(() {
                          _ppChecked = value ?? false;
                        });
                      },
                      content: _ppContent,
                      documentUrl: 'https://example.com/privacy',
                    ),
                  ],
                ),
              ),
            ),

            // Bottom action buttons
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Accept all button
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: (_tosChecked && _ppChecked && !_isSubmitting)
                          ? _handleAcceptAll
                          : null,
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('同意して続ける'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Decline button
                  SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      onPressed: _isSubmitting ? null : _handleDecline,
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.grey,
                      ),
                      child: const Text('同意しない'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConsentSection(
    BuildContext context, {
    required String title,
    required String version,
    required ScrollController scrollController,
    required bool scrolledToEnd,
    required bool isChecked,
    required void Function(bool?) onChecked,
    required String content,
    required String documentUrl,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Title row
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                version,
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Document content
        Container(
          height: 200,
          decoration: BoxDecoration(
            border: Border.all(
              color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.5),
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Stack(
            children: [
              Scrollbar(
                controller: scrollController,
                thumbVisibility: true,
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(12),
                  child: SelectableText(
                    content,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ),
              // Scroll indicator
              if (!scrolledToEnd)
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Theme.of(context).colorScheme.surface.withValues(alpha: 0.0),
                          Theme.of(context).colorScheme.surface,
                        ],
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.arrow_downward,
                          size: 16,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '下までスクロールしてください',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: Theme.of(context).colorScheme.primary,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),

        // Checkbox row
        Row(
          children: [
            Checkbox(
              value: isChecked,
              onChanged: scrolledToEnd ? onChecked : null,
            ),
            Expanded(
              child: GestureDetector(
                onTap: scrolledToEnd
                    ? () => onChecked(!isChecked)
                    : null,
                child: Text(
                  '$titleに同意します',
                  style: TextStyle(
                    color: scrolledToEnd
                        ? null
                        : Theme.of(context).colorScheme.outline,
                  ),
                ),
              ),
            ),
            TextButton(
              onPressed: () => _openDocument(documentUrl),
              child: const Text('全文を表示'),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _openDocument(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  // Simplified ToS content for display
  static const String _tosContent = '''
AIフィットネスアプリ 利用規約 v3.2

第1条（適用）
本利用規約（以下「本規約」）は、AIフィットネスアプリ（以下「本サービス」）の利用に関する条件を定めるものです。

第2条（利用登録）
2.1 本サービスの利用には、本規約およびプライバシーポリシーへの同意が必要です。
2.2 利用者は13歳以上である必要があります。

第3条（禁止事項）
利用者は以下の行為を行ってはなりません：
- 法令または公序良俗に違反する行為
- 他の利用者または第三者の権利を侵害する行為
- 本サービスの運営を妨害する行為

第4条（免責事項）
4.1 本サービスは医療サービスではありません。
4.2 本サービスの利用による健康上の問題について、当社は責任を負いません。

第5条（サービスの変更・終了）
当社は、利用者への事前通知により、本サービスの内容を変更または終了することができます。

第6条（準拠法・管轄）
本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。

（本文は要約版です。全文は「全文を表示」ボタンからご確認ください。）
''';

  // Simplified PP content for display
  static const String _ppContent = '''
AIフィットネスアプリ プライバシーポリシー v3.1

1. 個人情報の収集
当社は以下の情報を収集します：
- アカウント情報（メールアドレス、名前）
- プロフィール情報（身長、体重、年齢）
- トレーニングデータ（骨格座標データ、セッション履歴）

2. 情報の利用目的
収集した情報は以下の目的で利用します：
- サービスの提供・改善
- パーソナライズされたトレーニング体験の提供
- サポート対応

3. 情報の保護
当社は適切な技術的・組織的措置により、お客様の情報を保護します。

4. 第三者への提供
法令に基づく場合を除き、お客様の同意なく第三者に個人情報を提供しません。

5. お客様の権利
GDPR第7条に基づき、以下の権利があります：
- データへのアクセス権
- データの訂正権
- データの削除権（忘れられる権利）
- 同意の撤回権

6. お問い合わせ
プライバシーに関するお問い合わせ：privacy@example.com

（本文は要約版です。全文は「全文を表示」ボタンからご確認ください。）
''';
}
