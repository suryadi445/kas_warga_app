import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type Props = {
    icon?: string;
    title: string;
    subtitle?: string;
    buttonLabel?: string;
    onButtonPress?: () => void;
};

export default function HeaderCard({ icon, title, subtitle, buttonLabel, onButtonPress }: Props) {
    return (
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 12 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#93C5FD', alignItems: 'center', justifyContent: 'center', marginBottom: 10, elevation: 4 }}>
                <Text style={{ fontSize: 32 }}>{icon ?? '🔔'}</Text>
            </View>

            <Text style={{ color: '#3B82F6', fontSize: 20, fontWeight: '700' }}>{title}</Text>
            {subtitle ? <Text style={{ color: '#6B7280', marginTop: 6 }}>{subtitle}</Text> : null}

            {buttonLabel ? (
                <TouchableOpacity onPress={onButtonPress} style={{ marginTop: 12 }}>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 28, minWidth: 220, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{buttonLabel}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
