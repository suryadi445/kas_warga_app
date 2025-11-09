import { Stack } from 'expo-router';
import React from 'react';

// Replace default Tabs layout with a Stack-only layout so no bottom tab bar is shown.
export default function TabsLayout() {
    return (
        // children routes under /(tabs) will be rendered by Stack (no bottom tabs)
        <Stack screenOptions={{ headerShown: false }} />
    );
}
