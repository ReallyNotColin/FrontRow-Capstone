import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Dropdown from 'react-native-input-select';
import { StretchOutX } from 'react-native-reanimated';

export default function Screen() {
  const [textSize, setTextSize] = useState<string>('medium'); 
  const [isDarkMode, setIsDarkMode] = useState(false);

  const textSizeOptions = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
  ];

  return (
    <ScrollView>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Settings</ThemedText>
      </ThemedView>
      <ThemedView style={styles.divider} />

      <ThemedView style={styles.text}>
        <View style={styles.settingRow}>
          <View style={styles.iconLabel}>
            <IconSymbol name="moon.fill" color="#000" size={24} />
            <ThemedText style={styles.labelText}>Dark Mode</ThemedText>
          </View>
          <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
        </View>

        <View style={styles.dividerThin} />

        <View style={styles.settingRow}>
          <View style={styles.iconLabel}>
            <IconSymbol name="textformat.size" color="#000" size={24} />
            <ThemedText style={styles.labelText}>Text Size</ThemedText>
          </View>
          <View style={styles.dropdownContainer}>
            <Dropdown
              label=""
              placeholder="Medium"
              options={textSizeOptions}
              selectedValue={textSize}
              onValueChange={(selected) => {
                if (Array.isArray(selected)) {
                  setTextSize(selected[0] as string);
                } else if (typeof selected === 'string') {
                  setTextSize(selected);
                }
              }}
              primaryColor={'#000'}
              dropdownStyle={styles.dropdown}
              dropdownIconStyle={styles.hiddenIcon}
            />
          </View>
        </View>

        <View style={styles.dividerThin} />

        <ThemedText style={{ marginTop: 20 }}>
          Dark mode is {isDarkMode ? 'enabled' : 'disabled'}{'\n'}
          Selected text size: {textSize}
        </ThemedText>
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
    backgroundColor: '#E5E5EA',
    marginBottom: 16,
    width: '100%',
  },
  dividerThin: {
    height: 1,
    width: '150%',
    backgroundColor: '#ccc',
    marginBottom: 15,
    marginTop: 15,
    alignSelf: 'center'
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
    width: 95,
    minHeight: 40,
  },
  hiddenIcon: {
    display: 'none',
  },
});