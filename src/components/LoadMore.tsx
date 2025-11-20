import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

type Props = {
    loading?: boolean;
    hasMore?: boolean;
};

export default function LoadMore({ loading = false, hasMore = true }: Props) {
    if (!hasMore) {
        // small spacer when no more items
        return <View style={{ height: 20 }} />;
    }
    if (loading) {
        return (
            <View style={{ paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 8 }}>Loading more...</Text>
            </View>
        );
    }
    return (
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF', fontSize: 13 }}>Pull up to load more</Text>
        </View>
    );
}
