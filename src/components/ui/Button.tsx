import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, ANIMATIONS, TYPOGRAPHY } from '../../constants/designTokens';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}) => {
  const getButtonStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      borderRadius: BORDER_RADIUS.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: size === 'sm' ? 36 : size === 'lg' ? 56 : 48,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      ...SHADOWS.md,
      };

    const variantStyles: Record<string, ViewStyle> = {
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
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        shadowOpacity: 0,
        elevation: 0,
      },
    };

    const stateStyles: ViewStyle = {
      ...(disabled && {
        opacity: 0.5,
        shadowOpacity: 0,
        elevation: 0,
      }),
      ...(fullWidth && {
        width: '100%',
      }),
    };

    return {
      ...baseStyles,
      ...variantStyles[variant],
      ...stateStyles,
      ...style,
    };
  };

  const getTextStyles = (): TextStyle => {
    const baseStyles: TextStyle = {
      fontFamily: TYPOGRAPHY.fontFamily.primary,
      fontWeight: '600',
      fontSize: size === 'sm' ? TYPOGRAPHY.fontSize.sm : size === 'lg' ? TYPOGRAPHY.fontSize.lg : TYPOGRAPHY.fontSize.base,
    };

    const variantStyles: Record<string, TextStyle> = {
      primary: {
        color: COLORS.text.inverse,
      },
      secondary: {
        color: COLORS.text.inverse,
      },
      outline: {
        color: COLORS.primary[600],
      },
      ghost: {
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
          color={variant === 'outline' || variant === 'ghost' ? COLORS.primary[600] : COLORS.text.inverse} 
        />
      ) : (
        <>
          {icon && <View style={{ marginRight: SPACING.sm }}>{icon}</View>}
          <Text style={getTextStyles()}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
