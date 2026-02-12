import React from 'react';
import { TextInput, View, Text, TextInputProps, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../constants/designTokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'filled';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = 'default',
  style,
  ...textInputProps
}) => {
  const getInputStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderWidth: 1,
    };

    const variantStyles: Record<string, ViewStyle> = {
      default: {
        backgroundColor: COLORS.background.primary,
        borderColor: COLORS.neutral[300],
        borderWidth: 1,
      },
      outlined: {
        backgroundColor: 'transparent',
        borderColor: COLORS.primary[500],
        borderWidth: 2,
      },
      filled: {
        backgroundColor: COLORS.neutral[100],
        borderColor: 'transparent',
        borderWidth: 0,
      },
    };

    const stateStyles: ViewStyle = {
      ...(error && {
        borderColor: COLORS.error[500],
        borderWidth: 2,
      }),
    };

    return Object.assign({}, baseStyles, variantStyles[variant], stateStyles, style);
  };

  const getLabelStyles = (): TextStyle => ({
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600' as const,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.primary,
  });

  const getErrorStyles = (): TextStyle => ({
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error[500],
    marginTop: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.primary,
  });

  const getHelperStyles = (): TextStyle => ({
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.primary,
  });

  return (
    <View style={{ marginBottom: SPACING.md }}>
      {label && <Text style={getLabelStyles()}>{label}</Text>}
      
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {leftIcon && (
          <View style={{ marginRight: SPACING.sm, position: 'absolute', left: SPACING.md, zIndex: 1 }}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          style={[
            getInputStyles(),
            {
              fontSize: TYPOGRAPHY.fontSize.base,
              fontFamily: TYPOGRAPHY.fontFamily.primary,
              ...(leftIcon && { paddingLeft: SPACING.xl }),
              ...(rightIcon && { paddingRight: SPACING.xl }),
            }
          ]}
          placeholderTextColor={COLORS.neutral[400]}
          {...textInputProps}
        />
        
        {rightIcon && (
          <View style={{ position: 'absolute', right: SPACING.md, zIndex: 1 }}>
            {rightIcon}
          </View>
        )}
      </View>
      
      {error && <Text style={getErrorStyles()}>{error}</Text>}
      {helperText && !error && <Text style={getHelperStyles()}>{helperText}</Text>}
    </View>
  );
};
