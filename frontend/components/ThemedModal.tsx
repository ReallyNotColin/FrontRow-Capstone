// components/ThemedModal.tsx
import React from 'react';
import { Modal, View, Text, StyleSheet, ModalProps, ViewStyle, TextStyle, TextProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { useFontSize } from '@/components/FontTheme';

interface ThemedModalProps extends Omit<ModalProps, 'transparent' | 'animationType'> {
    visible: boolean;
    onRequestClose: () => void;
    children: React.ReactNode;
    animationType?: 'none' | 'slide' | 'fade';
    contentStyle?: ViewStyle;
}

export function ThemedModal({
    visible,
    onRequestClose,
    children,
    animationType = 'fade',
    contentStyle,
    ...modalProps
}: ThemedModalProps) {
    return (
        <Modal
        animationType={animationType}
        transparent
        visible={visible}
        onRequestClose={onRequestClose}
        {...modalProps}
        >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
            <View style={[styles.modalContent, contentStyle]}>
            {children}
            </View>
        </BlurView>
        </Modal>
    );
}

// Text components with fixed colors but flexible sizes
interface ThemedModalTextProps extends TextProps {
    children?: React.ReactNode;
    style?: TextStyle | TextStyle[];
}

export function ModalTitle({ style, children, ...props }: ThemedModalTextProps) {
    const { fontSize } = useFontSize();
    const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;
    
    const scaledStyle = {
        fontSize: styles.modalTitle.fontSize * sizeMultiplier,
        lineHeight: styles.modalTitle.lineHeight ? styles.modalTitle.lineHeight * sizeMultiplier : undefined,
    };
    
    return <Text style={[styles.modalTitle, scaledStyle, style]} {...props}>{children}</Text>;
}

export function ModalSubtitle({ style, children, ...props }: ThemedModalTextProps) {
    const { fontSize } = useFontSize();
    const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;
    
    const scaledStyle = {
        fontSize: styles.modalSubtitle.fontSize * sizeMultiplier,
        lineHeight: styles.modalSubtitle.lineHeight ? styles.modalSubtitle.lineHeight * sizeMultiplier : undefined,
    };
    
    return <Text style={[styles.modalSubtitle, scaledStyle, style]} {...props}>{children}</Text>;
    }

export function ModalProductName({ style, children, ...props }: ThemedModalTextProps) {
    const { fontSize } = useFontSize();
    const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;
    
    const scaledStyle = {
        fontSize: styles.productName.fontSize * sizeMultiplier,
        lineHeight: styles.productName.lineHeight ? styles.productName.lineHeight * sizeMultiplier : undefined,
    };
    
    return <Text style={[styles.productName, scaledStyle, style]} {...props}>{children}</Text>;
}

export function ModalBrandName({ style, children, ...props }: ThemedModalTextProps) {
    const { fontSize } = useFontSize();
    const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;
    
    const scaledStyle = {
        fontSize: styles.brandName.fontSize * sizeMultiplier,
        lineHeight: styles.brandName.lineHeight ? styles.brandName.lineHeight * sizeMultiplier : undefined,
    };
    
    return <Text style={[styles.brandName, scaledStyle, style]} {...props}>{children}</Text>;
}

export function ModalSectionTitle({ style, children, ...props }: ThemedModalTextProps) {
    const { fontSize } = useFontSize();
    const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;
    
    const scaledStyle = {
        fontSize: styles.sectionTitle.fontSize * sizeMultiplier,
        lineHeight: styles.sectionTitle.lineHeight ? styles.sectionTitle.lineHeight * sizeMultiplier : undefined,
    };
    
    return <Text style={[styles.sectionTitle, scaledStyle, style]} {...props}>{children}</Text>;
}

export function ModalSectionText({ style, children, ...props }: ThemedModalTextProps) {
    const { fontSize } = useFontSize();
    const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;
    
    const scaledStyle = {
        fontSize: styles.sectionText.fontSize * sizeMultiplier,
        lineHeight: styles.sectionText.lineHeight ? styles.sectionText.lineHeight * sizeMultiplier : undefined,
    };
    
    return <Text style={[styles.sectionText, scaledStyle, style]} {...props}>{children}</Text>;
}

export function ModalErrorText({ style, children, ...props }: ThemedModalTextProps) {
    const { fontSize } = useFontSize();
    const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;
    
    const scaledStyle = {
        fontSize: styles.errorText.fontSize * sizeMultiplier,
        lineHeight: styles.errorText.lineHeight ? styles.errorText.lineHeight * sizeMultiplier : undefined,
    };
    
    return <Text style={[styles.errorText, scaledStyle, style]} {...props}>{children}</Text>;
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        width: '90%',
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#333',
        lineHeight: 36,
    },
    modalSubtitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        lineHeight: 26,
    },
    productName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
        lineHeight: 28,
    },
    brandName: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
        fontStyle: 'italic',
        lineHeight: 22,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
        lineHeight: 22,
    },
    sectionText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 22,
    },
});