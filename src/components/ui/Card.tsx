import React from 'react';
import { View, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/designTokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  backgroundColor?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padding = 'md',
  backgroundColor,
}) => {
  const getCardStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      borderRadius: BORDER_RADIUS.xl,
      backgroundColor: backgroundColor || COLORS.background.primary,
      overflow: 'hidden',
    };

    const variantStyles: Record<string, ViewStyle> = {
      default: {
        ...SHADOWS.sm,
      },
      elevated: {
        ...SHADOWS.lg,
      },
      outlined: {
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        shadowOpacity: 0,
        elevation: 0,
      },
    };

    const paddingStyles: Record<string, ViewStyle> = {
      none: {},
      sm: { padding: SPACING.sm },
      md: { padding: SPACING.md },
      lg: { padding: SPACING.lg },
    };

    return {
      ...baseStyles,
      ...variantStyles[variant],
      ...paddingStyles[padding],
      ...style,
    };
  };

  return <View style={getCardStyles()}>{children}</View>;
};
