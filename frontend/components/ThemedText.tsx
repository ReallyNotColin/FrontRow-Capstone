import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { useFontSize } from '@/components/FontTheme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const { fontSize } = useFontSize();

  const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;

  const getScaledStyle = (base: any) => ({
    ...base,
    fontSize: base.fontSize * sizeMultiplier,
    lineHeight: base.lineHeight ? base.lineHeight * sizeMultiplier : undefined,
  });

  return (
    <Text
      style={[
        { color },
        type === 'default' ? getScaledStyle(styles.default) : undefined,
        type === 'title' ? getScaledStyle(styles.title) : undefined,
        type === 'defaultSemiBold' ? getScaledStyle(styles.defaultSemiBold) : undefined,
        type === 'subtitle' ? getScaledStyle(styles.subtitle) : undefined,
        type === 'link' ? getScaledStyle(styles.link) : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
