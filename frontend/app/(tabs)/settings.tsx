import React from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Dropdown from 'react-native-input-select';

import { useThemedColor } from '@/components/ThemedColor';

export default function Screen() {
  const { isDarkMode, setIsDarkMode, textSize, setTextSize, colors } = useThemedColor();

  const activeColors = isDarkMode ? colors.dark : colors.light;

  const textSizeOptions = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
  ];

  return (
    <ScrollView style={{ backgroundColor: activeColors.background }}>
      <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
        <ThemedText type="title" style={{ color: activeColors.text }}>Settings</ThemedText>
      </ThemedView>
      <View style={[styles.divider, { backgroundColor: activeColors.divider }]} />

      <ThemedView style={styles.text}>
        {/* Dark Mode toggle */}
        <View style={styles.settingRow}>
          <View style={styles.iconLabel}>
            <IconSymbol name="moon.fill" color={activeColors.icon} size={24} />
            <ThemedText style={[styles.labelText, { color: activeColors.text }]}>Dark Mode</ThemedText>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={setIsDarkMode}
            trackColor={{ false: activeColors.switchTrack, true: activeColors.switchTrack }}
            thumbColor={isDarkMode ? activeColors.switchThumb : activeColors.switchThumb}
          />
        </View>

        <View style={[styles.dividerThin, { backgroundColor: activeColors.divider }]} />

        {/* Text Size dropdown */}
        <View style={styles.settingRow}>
          <View style={styles.iconLabel}>
            <IconSymbol name="textformat.size" color={activeColors.icon} size={24} />
            <ThemedText style={[styles.labelText, { color: activeColors.text }]}>Text Size</ThemedText>
          </View>
          <View style={styles.dropdownContainer}>
            <Dropdown
              label=""
              placeholder="Medium"
              options={textSizeOptions}
              selectedValue={textSize}
              onValueChange={(selected) => {
                if (Array.isArray(selected)) {
                  setTextSize(selected[0] as 'small' | 'medium' | 'large');
                } else if (typeof selected === 'string') {
                  setTextSize(selected as 'small' | 'medium' | 'large');
                }
              }}
              primaryColor={activeColors.primary}
              dropdownStyle={{
                ...styles.dropdown,
                backgroundColor: activeColors.background,
                borderColor: activeColors.divider,
              }}
              dropdownTextStyle={{
                color: activeColors.text,
              }}
              selectedItemStyle={{
                color: activeColors.text,
              }}
              dropdownIconStyle={styles.hiddenIcon}
            />
          </View>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    marginBottom: 16,
    width: '100%',
  },
  dividerThin: {
    height: 1,
    width: '150%',
    marginBottom: 15,
    marginTop: 15,
    alignSelf: 'center',
  },
  text: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  settingRowDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    flexWrap: 'nowrap',
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelText: {
    marginLeft: 8,
  },
  dropdownContainer: {
    alignSelf: 'flex-end',
  },
  dropdown: {
    width: 91,
    minHeight: 40,
    alignItems: 'center',
    borderWidth: 1,
  },
  hiddenIcon: {
    display: 'none',
  },
});
