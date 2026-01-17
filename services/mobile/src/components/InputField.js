import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, text } from '../theme';

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  textContentType,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  editable = true,
  multiline = false,
  numberOfLines,
  hint,
  error,
  autoCorrect,
}) {
  const [focused, setFocused] = useState(false);
  const inputStyle = [
    styles.input,
    focused && styles.inputFocused,
    error ? styles.inputError : null,
    !editable ? styles.inputDisabled : null,
    multiline ? styles.inputMultiline : null,
  ];

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={text.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.slate500}
        style={inputStyle}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        textContentType={textContentType}
        autoComplete={autoComplete}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={blurOnSubmit}
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCorrect={autoCorrect}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.slate50,
    fontSize: 15,
    color: colors.slate900,
  },
  inputFocused: {
    borderColor: colors.sky500,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  hintText: {
    fontSize: 12,
    color: colors.slate500,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
});
