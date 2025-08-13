import React, { createContext, useContext, useState } from 'react';

type FontSizeType = 'small' | 'medium' | 'large';

interface FontSizeThemeProps {
    fontSize: FontSizeType;
    setFontSize: (size: FontSizeType) => void;
}

const FontSizeTheme = createContext<FontSizeThemeProps>({
    fontSize: 'small',
    setFontSize: () => {},
});

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [fontSize, setFontSize] = useState<FontSizeType>('small');

    return(
        <FontSizeTheme.Provider value={{ fontSize, setFontSize }}>
            {children}
        </FontSizeTheme.Provider>
    );
};

export const useFontSize = () => useContext(FontSizeTheme);