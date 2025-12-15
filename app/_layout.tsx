import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { Image, LogBox, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DashboardNotificationManager from '../src/components/DashboardNotificationManager';
import UpdateChecker from '../src/components/UpdateChecker';
import { ToastProvider } from '../src/contexts/ToastContext';
import '../src/i18n';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    // Ignore a noisy deprecation warning from older expo-image-picker versions.
    // We'll still prefer upgrading the package; this reduces clutter while we do that.
    LogBox.ignoreLogs(['ImagePicker.MediaTypeOptions']);

    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        async function prepare() {
            try {
                // Pre-load fonts, make any API calls you need to do here
                // await Font.loadAsync(Entypo.font);

                // Artificially delay for a few seconds to show the splash
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.warn(e);
            } finally {
                // Tell the application to render
                setAppIsReady(true);
            }
        }

        prepare();
    }, []);

    const onLayoutRootView = useCallback(async () => {
        if (appIsReady) {
            // This tells the splash screen to hide immediately! If we call this after
            // `setAppIsReady`, then we may see a blank screen while the app is
            // loading its initial state and rendering its first pixels. So instead,
            // we hide it immediately when the root view is laid out.
            await SplashScreen.hideAsync();
        }
    }, [appIsReady]);

    if (!appIsReady) {
        return (
            <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
                <View style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 3,
                    borderColor: 'rgba(255,255,255,0.3)',
                    overflow: 'hidden',
                }}>
                    <Image
                        source={require('../assets/images/logo.png')}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                </View>
            </LinearGradient>
        );
    }

    return (
        <ToastProvider>
            <DashboardNotificationManager />
            <UpdateChecker />
            <SafeAreaProvider onLayout={onLayoutRootView}>
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


