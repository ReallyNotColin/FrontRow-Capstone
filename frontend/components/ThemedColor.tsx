import React, { createContext, useContext, useState, ReactNode } from 'react';

type TextSize = 'small' | 'medium' | 'large';

const colors = {
    light: {
        background: '#f0f0f0',
        backgroundTitle: '#ffffff',
        text: '#000000',
        secondaryText: '#555555',
        buttonText: '#ffffff',
        divider: '#c7c7ccff',
        icon: '#000000',
        switchTrack: '#767577',
        switchThumb: '#60A5FA',
        primary: '#60A5FA',
    },
    dark: {
        background: '#121212',
        backgroundTitle: '#0a0a0aff',
        text: '#E0E0E0',
        secondaryText: '#B0B0B0',
        buttonText: '#ffffff',
        divider: '#333333',
        icon: '#E0E0E0',
        switchTrack: '#3A3A3A',
        switchThumb: '#60A5FA',  // light blue thumb in dark mode
        primary: '#60A5FA',      // light blue primary color
    },
};

type ThemeColors = typeof colors;

type ThemedColorType = {
    isDarkMode: boolean;
    setIsDarkMode: (val: boolean) => void;
    textSize: TextSize;
    setTextSize: (val: TextSize) => void;
    colors: ThemeColors;
    activeColors: ThemeColors['light'] | ThemeColors['dark'];
};

const ThemedColor = createContext<ThemedColorType | undefined>(undefined);

export function ThemedColorProvider({ children }: { children: ReactNode }) {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [textSize, setTextSize] = useState<TextSize>('medium');

    const activeColors = isDarkMode ? colors.dark : colors.light;

    return (
        <ThemedColor.Provider value={{ isDarkMode, setIsDarkMode, textSize, setTextSize, colors, activeColors }}>
            {children}
        </ThemedColor.Provider>
    );
}


export function useThemedColor() {
    const context = useContext(ThemedColor);
    if (!context) throw new Error('useThemedColor must be used within a ThemedColorProvider');
    return context;
}

