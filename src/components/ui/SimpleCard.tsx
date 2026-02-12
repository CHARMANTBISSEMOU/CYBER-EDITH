import React from 'react';
import { View } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/designTokens';

interface SimpleCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  backgroundColor?: string;
  style?: any;
}

export const SimpleCard: React.FC<SimpleCardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  backgroundColor,
  style,
}) => {
  const getCardStyles = () => {
    const baseStyles = {
      borderRadius: 16,
      backgroundColor: backgroundColor || COLORS.background.primary,
      overflow: 'hidden' as const,
    };

    const variantStyles = {
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
      elevated: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
      },
      outlined: {
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        shadowOpacity: 0,
        elevation: 0,
      },
    };

    const paddingStyles = {
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
