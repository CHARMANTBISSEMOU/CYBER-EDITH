import React from 'react';
import { TextInput, View, Text } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../constants/designTokens';

interface SimpleInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  style?: any;
}

export const SimpleInput: React.FC<SimpleInputProps> = ({
  label,
  error,
  helperText,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  style,
}) => {
  const getInputStyles = () => ({
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    borderWidth: 1,
    backgroundColor: COLORS.background.primary,
    borderColor: COLORS.neutral[300],
    fontFamily: TYPOGRAPHY.fontFamily.primary,
    ...(error && {
      borderColor: COLORS.error[500],
      borderWidth: 2,
    }),
  });

  const getLabelStyles = () => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.primary,
  });

  const getErrorStyles = () => ({
    fontSize: 12,
    color: COLORS.error[500],
    marginTop: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.primary,
  });

  const getHelperStyles = () => ({
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.primary,
  });

  return (
    <View style={{ marginBottom: SPACING.md, ...style }}>
      {label && <Text style={getLabelStyles()}>{label}</Text>}
      
      <TextInput
        style={getInputStyles()}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={COLORS.neutral[400]}
      />
      
      {error && <Text style={getErrorStyles()}>{error}</Text>}
      {helperText && !error && <Text style={getHelperStyles()}>{helperText}</Text>}
    </View>
  );
};
