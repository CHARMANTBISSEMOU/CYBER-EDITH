import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/designTokens';

interface SimpleButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: any;
}

export const SimpleButton: React.FC<SimpleButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}) => {
  const getButtonStyles = () => {
    const baseStyles = {
      borderRadius: 16,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: size === 'sm' ? 36 : size === 'lg' ? 56 : 48,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    };

    const variantStyles = {
      primary: {
        backgroundColor: COLORS.primary[600],
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: COLORS.accent[500],
        borderWidth: 0,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: COLORS.primary[600],
      },
    };

    const stateStyles = {
      ...(disabled && {
        opacity: 0.5,
        shadowOpacity: 0,
        elevation: 0,
      }),
      ...(fullWidth && {
        width: '100%' as any,
      }),
    };

    return {
      ...baseStyles,
      ...variantStyles[variant],
      ...stateStyles,
      ...style,
    };
  };

  const getTextStyles = () => {
    const baseStyles = {
      fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 16,
      fontWeight: '600' as const,
    };

    const variantStyles = {
      primary: {
        color: COLORS.text.inverse,
      },
      secondary: {
        color: COLORS.text.inverse,
      },
      outline: {
        color: COLORS.primary[600],
      },
    };

    return {
      ...baseStyles,
      ...variantStyles[variant],
    };
  };

  return (
    <TouchableOpacity
      style={getButtonStyles()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' ? COLORS.primary[600] : COLORS.text.inverse} 
        />
      ) : (
        <Text style={getTextStyles()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
