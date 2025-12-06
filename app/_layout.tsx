import { Stack } from 'expo-router';
import { LogBox, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../src/contexts/ToastContext';
import '../src/i18n';

export default function RootLayout() {
    // Ignore a noisy deprecation warning from older expo-image-picker versions.
    // We'll still prefer upgrading the package; this reduces clutter while we do that.
    LogBox.ignoreLogs(['ImagePicker.MediaTypeOptions']);
    return (
        <ToastProvider>
            <SafeAreaProvider>
                {/* Global translucent status bar so app content can render under it */}
                <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
                <View style={{ flex: 1 }}>
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            // force no extra top padding from navigator
                            contentStyle: { paddingTop: 0 },
                        }}
                    >
                        <Stack.Screen name="login" />
                        <Stack.Screen name="register" />
                        <Stack.Screen name="(tabs)" />
                    </Stack>
                </View>
            </SafeAreaProvider>
        </ToastProvider>
    );
}
