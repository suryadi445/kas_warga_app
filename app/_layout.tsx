import { Stack } from 'expo-router';
import { ToastProvider } from '../src/contexts/ToastContext';

export default function RootLayout() {
    return (
        <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </ToastProvider>
    );
}
