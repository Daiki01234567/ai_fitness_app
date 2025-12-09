/**
 * AppCard - Card container component
 * Wraps React Native Paper Card with consistent styling
 */

import React from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { Card, CardProps } from "react-native-paper";

import { colors, spacing, borderRadius } from "../../lib/theme";

/**
 * AppCard props interface
 */
export interface AppCardProps extends Omit<CardProps, "theme" | "elevation"> {
  /** Card children */
  children: React.ReactNode;
  /** Custom card style */
  style?: ViewStyle;
  /** Whether to remove default margins */
  noMargin?: boolean;
}

/**
 * AppCard component
 * A themed card container with subcomponents for structured content
 *
 * @example
 * ```tsx
 * <AppCard>
 *   <AppCard.Title title="Workout Summary" subtitle="Today's session" />
 *   <AppCard.Content>
 *     <Text>Your workout details here</Text>
 *   </AppCard.Content>
 *   <AppCard.Actions>
 *     <AppButton variant="primary">Start</AppButton>
 *   </AppCard.Actions>
 * </AppCard>
 * ```
 */
function AppCardComponent({
  children,
  style,
  noMargin = false,
  accessibilityLabel,
  ...props
}: AppCardProps): React.ReactElement {
  return (
    <Card
      style={[styles.card, noMargin && styles.noMargin, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="none"
      {...props}
    >
      {children}
    </Card>
  );
}

/**
 * AppCard.Title component
 * Header section for the card with title and optional subtitle
 */
interface AppCardTitleProps {
  /** Main title text */
  title: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Optional left component */
  left?: (props: { size: number }) => React.ReactNode;
  /** Optional right component */
  right?: (props: { size: number }) => React.ReactNode;
  /** Custom style */
  style?: ViewStyle;
}

function AppCardTitle({
  title,
  subtitle,
  left,
  right,
  style,
}: AppCardTitleProps): React.ReactElement {
  return (
    <Card.Title
      title={title}
      subtitle={subtitle}
      left={left}
      right={right}
      style={[styles.title, style]}
      titleStyle={styles.titleText}
      subtitleStyle={styles.subtitleText}
      accessible
      accessibilityLabel={title}
    />
  );
}

/**
 * AppCard.Content component
 * Main content area of the card
 */
interface AppCardContentProps {
  /** Content children */
  children: React.ReactNode;
  /** Custom style */
  style?: ViewStyle;
}

function AppCardContent({ children, style }: AppCardContentProps): React.ReactElement {
  return <Card.Content style={[styles.content, style]}>{children}</Card.Content>;
}

/**
 * AppCard.Actions component
 * Action buttons area at the bottom of the card
 */
interface AppCardActionsProps {
  /** Action children (usually buttons) */
  children: React.ReactNode;
  /** Custom style */
  style?: ViewStyle;
}

function AppCardActions({ children, style }: AppCardActionsProps): React.ReactElement {
  return <Card.Actions style={[styles.actions, style]}>{children}</Card.Actions>;
}

/**
 * AppCard.Cover component
 * Cover image for the card
 */
interface AppCardCoverProps {
  /** Image source */
  source: { uri: string } | number;
  /** Alt text for accessibility */
  accessibilityLabel?: string;
  /** Custom style */
  style?: ViewStyle;
}

function AppCardCover({
  source,
  accessibilityLabel,
  style,
}: AppCardCoverProps): React.ReactElement {
  return (
    <Card.Cover
      source={source}
      style={[styles.cover, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    />
  );
}

// Attach subcomponents to main component
export const AppCard = Object.assign(AppCardComponent, {
  Title: AppCardTitle,
  Content: AppCardContent,
  Actions: AppCardActions,
  Cover: AppCardCover,
});

const styles = StyleSheet.create({
  card: {
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    elevation: 2,
  },
  noMargin: {
    marginVertical: 0,
    marginHorizontal: 0,
  },
  title: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  subtitleText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  cover: {
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
  },
});

export default AppCard;
