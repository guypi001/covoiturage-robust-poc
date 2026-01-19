import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, fonts, radius, shadows, text } from '../theme';

export function DateTimeField({ label, mode, value, onChange, hint, error }) {
  const [show, setShow] = useState(false);
  const hasValue = Boolean(value);
  const formatted = value
    ? mode === 'date'
      ? value.toLocaleDateString('fr-FR')
      : value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : mode === 'date'
      ? 'Choisir une date'
      : 'Choisir une heure';

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={text.label}>{label}</Text> : null}
      <Pressable
        style={[styles.input, error ? styles.inputError : null]}
        onPress={() => setShow(true)}
      >
        <Text style={[styles.inputText, !hasValue && styles.placeholderText]}>{formatted}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display="default"
          onChange={(_, selected) => {
            setShow(false);
            if (selected) onChange(selected);
          }}
        />
      )}
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
    paddingVertical: 12,
    backgroundColor: colors.white,
    ...shadows.soft,
  },
  inputError: {
    borderColor: colors.rose600,
    backgroundColor: colors.rose100,
  },
  inputText: {
    fontSize: 15,
    color: colors.slate900,
    fontFamily: fonts.text,
  },
  placeholderText: {
    color: colors.slate500,
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
