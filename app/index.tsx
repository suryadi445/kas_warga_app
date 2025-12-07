import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function Index() {
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Show splash for 1.2s then redirect to login (or change as needed)
        const t = setTimeout(() => {
            setLoading(false);
            router.replace('/login');
        }, 1200);
        return () => clearTimeout(t);
    }, [router]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <View style={styles.content}>
                <Text style={styles.title}>Community App</Text>
                <ActivityIndicator size="small" color="#fff" style={{ marginTop: 12 }} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#6366f1' },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title: { color: '#fff', fontSize: 22, fontWeight: '800' },
});
