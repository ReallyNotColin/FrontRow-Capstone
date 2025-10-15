import React, { createContext, useContext, useState, ReactNode } from 'react';

type TextSize = 'small' | 'medium' | 'large';

const colors = {
    light: {
        gradientBackground: ['#C6E9DD','#f0f0f0','#f0f0f0','#CAE5EE'] as const,
        background: '#f0f0f0',
        backgroundTitle: '#ffffff',
        text: '#212D39',
        secondaryText: '#555E67',
        buttonText: '#ffffff',
        divider: '#c7c7ccff',
        icon: '#212D39',
        switchTrack: '#555E67',
        switchThumb: '#27778E',
        primary: '#27778E',
    },
    dark: {
        gradientBackground: ['#06261dff','#0C1924','#0C1924','#06222bff'] as const,
        background: '#0C1924',
        backgroundTitle: '#0A121B',
        text: '#E0E0E0',
        secondaryText: '#96a4b1',
        buttonText: '#ffffff',
        divider: '#212D39',
        icon: '#E0E0E0',
        switchTrack: '#3A3A3A',
        switchThumb: '#239dbe',  // light blue thumb in dark mode
        primary: '#239dbe',      // light blue primary color
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

