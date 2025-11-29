/// Session Detail Screen
///
/// Displays detailed information about a single training session.
/// Reference: docs/tickets/012_history_analytics.md
/// Reference: docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/form_analyzer/form_analyzer.dart';
import '../../core/history/history_models.dart';
import '../../core/history/history_service.dart';
import '../../core/auth/auth_state_notifier.dart';
import '../../core/theme/app_theme.dart';
import '../widgets/stats_card.dart';

/// Screen displaying detailed session information
class SessionDetailScreen extends ConsumerStatefulWidget {
  const SessionDetailScreen({
    super.key,
    required this.session,
  });

  final HistorySession session;

  @override
  ConsumerState<SessionDetailScreen> createState() => _SessionDetailScreenState();
}

class _SessionDetailScreenState extends ConsumerState<SessionDetailScreen> {
  final _noteController = TextEditingController();
  bool _isEditingNote = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _noteController.text = widget.session.note ?? '';
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final exerciseName = AnalyzerFactory.getDisplayName(session.exerciseType);
    final dateFormat = DateFormat('yyyy/MM/dd (E) HH:mm', 'ja');

    return Scaffold(
      appBar: AppBar(
        title: const Text('セッション詳細'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) => _handleMenuAction(value),
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'export',
                child: ListTile(
                  leading: Icon(Icons.file_download),
                  title: Text('エクスポート'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'share',
                child: ListTile(
                  leading: Icon(Icons.share),
                  title: Text('共有'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'delete',
                child: ListTile(
                  leading: Icon(Icons.delete, color: Colors.red),
                  title: Text('削除', style: TextStyle(color: Colors.red)),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Session header
            _buildSessionHeader(session, exerciseName, dateFormat),
            const SizedBox(height: 24),

            // Summary stats
            _buildSummaryStats(session),
            const SizedBox(height: 24),

            // Set details
            _buildSetDetails(session),
            const SizedBox(height: 24),

            // Issues section
            if (session.primaryIssues.isNotEmpty) ...[
              _buildIssuesSection(session),
              const SizedBox(height: 24),
            ],

            // Body condition
            if (session.bodyCondition != null) ...[
              _buildBodyConditionSection(session.bodyCondition!),
              const SizedBox(height: 24),
            ],

            // Tags section
            _buildTagsSection(session),
            const SizedBox(height: 24),

            // Note section
            _buildNoteSection(session),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSessionHeader(
    HistorySession session,
    String exerciseName,
    DateFormat dateFormat,
  ) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Exercise icon
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _getExerciseIcon(session.exerciseType),
                size: 32,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(width: 16),
            // Exercise info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    exerciseName,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    dateFormat.format(session.startTime),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.grey.shade600,
                    ),
                  ),
                  Text(
                    '${session.duration.inMinutes}分',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
            // Score badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: _getScoreColor(session.averageScore).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Text(
                    session.averageScore.toStringAsFixed(0),
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: _getScoreColor(session.averageScore),
                    ),
                  ),
                  Text(
                    '点',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: _getScoreColor(session.averageScore),
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

  Widget _buildSummaryStats(HistorySession session) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '概要',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: StatsCard(
                title: 'セット数',
                value: '${session.totalSets}',
                icon: Icons.layers,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: 'レップ数',
                value: '${session.totalReps}',
                icon: Icons.repeat,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatsCard(
                title: 'ベストスコア',
                value: session.bestSetScore.toStringAsFixed(0),
                icon: Icons.emoji_events,
                valueColor: _getScoreColor(session.bestSetScore),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSetDetails(HistorySession session) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'セット別詳細',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        ...session.sets.map((set) => _buildSetCard(set)),
      ],
    );
  }

  Widget _buildSetCard(HistorySetRecord set) {
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.1),
          child: Text(
            '${set.setNumber}',
            style: TextStyle(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        title: Row(
          children: [
            Text(
              '${set.reps}回',
              style: theme.textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _getScoreColor(set.averageScore).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${set.averageScore.toStringAsFixed(0)}点',
                style: TextStyle(
                  color: _getScoreColor(set.averageScore),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        subtitle: Text(
          '${set.duration.inSeconds}秒',
          style: theme.textTheme.bodySmall,
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Best/worst scores
                if (set.bestRepScore != null || set.worstRepScore != null)
                  Row(
                    children: [
                      if (set.bestRepScore != null)
                        Expanded(
                          child: _buildMiniStat(
                            'ベスト',
                            '${set.bestRepScore!.toStringAsFixed(0)}点',
                            Colors.green,
                          ),
                        ),
                      if (set.worstRepScore != null)
                        Expanded(
                          child: _buildMiniStat(
                            'ワースト',
                            '${set.worstRepScore!.toStringAsFixed(0)}点',
                            Colors.orange,
                          ),
                        ),
                    ],
                  ),
                // Issues
                if (set.issues.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    '改善ポイント',
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: set.issues
                        .map((issue) => Chip(
                              label: Text(
                                issue,
                                style: const TextStyle(fontSize: 12),
                              ),
                              backgroundColor: Colors.orange.shade50,
                              padding: EdgeInsets.zero,
                              materialTapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                            ))
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey.shade600,
              ),
        ),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: color,
                fontWeight: FontWeight.bold,
              ),
        ),
      ],
    );
  }

  Widget _buildIssuesSection(HistorySession session) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '主な改善ポイント',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: session.primaryIssues
                  .map((issue) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Icon(
                              Icons.warning_amber,
                              color: Colors.orange.shade600,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(issue)),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBodyConditionSection(BodyCondition condition) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '体調記録',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildConditionRow('元気度', condition.energyLevel),
                const SizedBox(height: 8),
                _buildConditionRow('睡眠の質', condition.sleepQuality),
                const SizedBox(height: 8),
                _buildConditionRow('筋肉のはり', condition.muscleStiffness),
                if (condition.notes != null && condition.notes!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  Text(
                    condition.notes!,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildConditionRow(String label, int value) {
    return Row(
      children: [
        SizedBox(
          width: 100,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
        Expanded(
          child: Row(
            children: List.generate(
              5,
              (index) => Icon(
                index < value ? Icons.star : Icons.star_border,
                color: Colors.amber,
                size: 20,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTagsSection(HistorySession session) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'タグ',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            TextButton.icon(
              onPressed: _showTagEditor,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('追加'),
            ),
          ],
        ),
        if (session.tags != null && session.tags!.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: session.tags!
                .map((tag) => Chip(
                      label: Text(tag),
                      onDeleted: () => _removeTag(tag),
                    ))
                .toList(),
          )
        else
          Text(
            'タグはまだありません',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey.shade500,
                ),
          ),
      ],
    );
  }

  Widget _buildNoteSection(HistorySession session) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'メモ',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            if (!_isEditingNote)
              TextButton.icon(
                onPressed: () => setState(() => _isEditingNote = true),
                icon: const Icon(Icons.edit, size: 18),
                label: const Text('編集'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: _isEditingNote
                ? Column(
                    children: [
                      TextField(
                        controller: _noteController,
                        maxLines: 4,
                        maxLength: 200,
                        decoration: const InputDecoration(
                          hintText: 'メモを入力...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () {
                              _noteController.text = session.note ?? '';
                              setState(() => _isEditingNote = false);
                            },
                            child: const Text('キャンセル'),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            onPressed: _isSaving ? null : _saveNote,
                            child: _isSaving
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text('保存'),
                          ),
                        ],
                      ),
                    ],
                  )
                : Text(
                    session.note?.isNotEmpty == true
                        ? session.note!
                        : 'メモはまだありません',
                    style: session.note?.isNotEmpty == true
                        ? null
                        : Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey.shade500,
                            ),
                  ),
          ),
        ),
      ],
    );
  }

  IconData _getExerciseIcon(ExerciseType type) {
    switch (type) {
      case ExerciseType.squat:
        return Icons.accessibility_new;
      case ExerciseType.armCurl:
        return Icons.fitness_center;
      case ExerciseType.sideRaise:
        return Icons.pan_tool;
      case ExerciseType.shoulderPress:
        return Icons.upload;
      case ExerciseType.pushUp:
        return Icons.sports_gymnastics;
    }
  }

  Color _getScoreColor(double score) {
    if (score >= 80) return AppColors.scoreExcellent;
    if (score >= 60) return AppColors.scoreGood;
    if (score >= 40) return AppColors.scoreAverage;
    return AppColors.scorePoor;
  }

  void _handleMenuAction(String action) {
    switch (action) {
      case 'export':
        _showExportOptions();
        break;
      case 'share':
        _shareSession();
        break;
      case 'delete':
        _confirmDelete();
        break;
    }
  }

  void _showExportOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.picture_as_pdf),
              title: const Text('PDFでエクスポート'),
              onTap: () {
                Navigator.pop(context);
                _exportToPdf();
              },
            ),
            ListTile(
              leading: const Icon(Icons.table_chart),
              title: const Text('CSVでエクスポート'),
              onTap: () {
                Navigator.pop(context);
                _exportToCsv();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _exportToPdf() {
    // TODO: Implement PDF export
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('PDF出力は今後実装予定です')),
    );
  }

  void _exportToCsv() {
    // TODO: Implement CSV export
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('CSV出力は今後実装予定です')),
    );
  }

  void _shareSession() {
    // TODO: Implement sharing
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('共有機能は今後実装予定です')),
    );
  }

  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('セッションを削除'),
        content: const Text('このセッションを削除してもよろしいですか？この操作は取り消せません。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('キャンセル'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(context);
              _deleteSession();
            },
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            child: const Text('削除'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteSession() async {
    final authState = ref.read(authStateProvider);
    final userId = authState.user?.uid;
    if (userId == null) return;

    try {
      await ref.read(historyServiceProvider).deleteSession(
            userId: userId,
            sessionId: widget.session.id,
          );

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('セッションを削除しました')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('削除に失敗しました: $e')),
        );
      }
    }
  }

  void _showTagEditor() {
    final controller = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('タグを追加'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'タグ名を入力',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('キャンセル'),
          ),
          FilledButton(
            onPressed: () {
              if (controller.text.isNotEmpty) {
                Navigator.pop(context);
                _addTag(controller.text);
              }
            },
            child: const Text('追加'),
          ),
        ],
      ),
    );
  }

  Future<void> _addTag(String tag) async {
    final authState = ref.read(authStateProvider);
    final userId = authState.user?.uid;
    if (userId == null) return;

    final currentTags = widget.session.tags ?? [];
    if (currentTags.contains(tag)) return;

    try {
      await ref.read(historyServiceProvider).saveSessionTags(
            userId: userId,
            sessionId: widget.session.id,
            tags: [...currentTags, tag],
          );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('タグ「$tag」を追加しました')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('タグの追加に失敗しました: $e')),
        );
      }
    }
  }

  Future<void> _removeTag(String tag) async {
    final authState = ref.read(authStateProvider);
    final userId = authState.user?.uid;
    if (userId == null) return;

    final currentTags = widget.session.tags ?? [];
    final newTags = currentTags.where((t) => t != tag).toList();

    try {
      await ref.read(historyServiceProvider).saveSessionTags(
            userId: userId,
            sessionId: widget.session.id,
            tags: newTags,
          );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('タグ「$tag」を削除しました')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('タグの削除に失敗しました: $e')),
        );
      }
    }
  }

  Future<void> _saveNote() async {
    final authState = ref.read(authStateProvider);
    final userId = authState.user?.uid;
    if (userId == null) return;

    setState(() => _isSaving = true);

    try {
      await ref.read(historyServiceProvider).saveSessionNote(
            userId: userId,
            sessionId: widget.session.id,
            note: _noteController.text,
          );

      if (mounted) {
        setState(() {
          _isEditingNote = false;
          _isSaving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('メモを保存しました')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('メモの保存に失敗しました: $e')),
        );
      }
    }
  }
}
