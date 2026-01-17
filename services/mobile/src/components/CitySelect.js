import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { searchCities } from '../data/cities';

export function CitySelect({ label, value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => searchCities(value || ''), [value]);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={text.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.slate500}
        style={styles.input}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {focused && suggestions.length > 0 ? (
        <View style={styles.dropdown}>
          {suggestions.map((city) => (
            <Pressable key={city.name} onPress={() => onChange(city.name)} style={styles.option}>
              <Text style={styles.optionText}>{city.name}</Text>
              {city.region ? <Text style={styles.optionMeta}>{city.region}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
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
  dropdown: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate900,
  },
  optionMeta: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
});
