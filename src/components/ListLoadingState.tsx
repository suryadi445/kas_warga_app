import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

interface Props {
    message: string;
}

export default function ListLoadingState({ message }: Props) {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <ActivityIndicator size="large" color="#7c3aed" style={{ transform: [{ scale: 1.2 }] }} />
            <Text style={{ color: '#4B5563', marginTop: 16, fontSize: 16, fontWeight: '600' }}>
                {message}
            </Text>
        </View>
    );
}
