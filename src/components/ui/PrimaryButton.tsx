import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, StyleProp, Text, TouchableOpacity, ViewStyle } from 'react-native';

type Props = {
    label?: string;
    loading?: boolean;
    disabled?: boolean;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    gradient?: boolean;
    colors?: string[];
};

export default function PrimaryButton({ label, loading, disabled, onPress, style, gradient = false, colors = ['#7c3aed', '#6366f1'] }: Props) {
    const isDisabled = !!disabled || !!loading;

    if (gradient) {
        const wrapStyle = [{ borderRadius: 12, overflow: 'hidden' }, style, isDisabled && { opacity: 0.7 }];
        return (
            <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.9} style={wrapStyle as any}>
                <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 16, alignItems: 'center', justifyContent: 'center' }}>
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{label}</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    const btnStyle = [{ backgroundColor: '#6366f1', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, style, isDisabled && { opacity: 0.7 }];
    return (
        <TouchableOpacity onPress={onPress} disabled={isDisabled} style={btnStyle as any} activeOpacity={0.9}>
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{label}</Text>
            )}
        </TouchableOpacity>
    );
}
