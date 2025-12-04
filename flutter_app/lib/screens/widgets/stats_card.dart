/// Stats Card Widget
///
/// Reusable statistics display card for history and analytics screens.
/// Reference: docs/tickets/012_history_analytics.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'package:flutter/material.dart';

/// A card displaying a single statistic with icon and optional trend
class StatsCard extends StatelessWidget {
  const StatsCard({
    super.key,
    required this.title,
    required this.value,
    this.icon,
    this.valueColor,
    this.trend,
    this.subtitle,
    this.onTap,
  });

  /// Title of the stat
  final String title;

  /// Main value to display
  final String value;

  /// Optional icon
  final IconData? icon;

  /// Optional color for the value
  final Color? valueColor;

  /// Optional trend indicator (-1 = down, 0 = neutral, 1 = up)
  final int? trend;

  /// Optional subtitle
  final String? subtitle;

  /// Optional tap handler
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header row with icon and trend
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (icon != null)
                    Icon(
                      icon,
                      size: 20,
                      color: theme.colorScheme.primary.withValues(alpha: 0.7),
                    )
                  else
                    const SizedBox(width: 20),
                  if (trend != null) _buildTrendIndicator(trend!),
                ],
              ),
              const SizedBox(height: 8),
              // Value
              Text(
                value,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: valueColor,
                ),
              ),
              const SizedBox(height: 4),
              // Title
              Text(
                title,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: Colors.grey.shade600,
                ),
              ),
              // Optional subtitle
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.grey.shade500,
                    fontSize: 10,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTrendIndicator(int trend) {
    IconData icon;
    Color color;

    switch (trend) {
      case 1:
        icon = Icons.trending_up;
        color = Colors.green;
        break;
      case -1:
        icon = Icons.trending_down;
        color = Colors.red;
        break;
      default:
        icon = Icons.trending_flat;
        color = Colors.grey;
    }

    return Icon(icon, size: 16, color: color);
  }
}

/// A larger stats card for prominent display
class LargeStatsCard extends StatelessWidget {
  const LargeStatsCard({
    super.key,
    required this.title,
    required this.value,
    this.icon,
    this.valueColor,
    this.subtitle,
    this.progress,
    this.progressColor,
    this.onTap,
  });

  final String title;
  final String value;
  final IconData? icon;
  final Color? valueColor;
  final String? subtitle;
  final double? progress; // 0.0 to 1.0
  final Color? progressColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  if (icon != null) ...[
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(icon, color: theme.colorScheme.primary),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Text(title, style: theme.textTheme.titleMedium),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Value
              Text(
                value,
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: valueColor,
                ),
              ),
              // Subtitle
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(
                  subtitle!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
              // Progress bar
              if (progress != null) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.grey.shade200,
                    valueColor: AlwaysStoppedAnimation(
                      progressColor ?? theme.colorScheme.primary,
                    ),
                    minHeight: 8,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A horizontal row of mini stats
class MiniStatsRow extends StatelessWidget {
  const MiniStatsRow({super.key, required this.items});

  final List<MiniStatItem> items;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: items
          .map((item) => Expanded(child: _MiniStatCard(item: item)))
          .toList(),
    );
  }
}

/// Data class for mini stat items
class MiniStatItem {
  const MiniStatItem({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;
}

class _MiniStatCard extends StatelessWidget {
  const _MiniStatCard({required this.item});

  final MiniStatItem item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        children: [
          Text(
            item.value,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
              color: item.color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            item.label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: Colors.grey.shade600,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
