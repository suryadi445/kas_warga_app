import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

interface Props {
    message?: string;
}

const SkeletonItem = () => {
    const sv = useSharedValue(0);

    useEffect(() => {
        sv.value = withRepeat(
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            sv.value,
            [0, 1],
            ['#E5E7EB', '#F3F4F6'] // Gray-200 to Gray-100
        );
        return { backgroundColor };
    });

    return (
        <View style={styles.card}>
            {/* Title / Header */}
            <Animated.View style={[styles.skeletonBlock, { height: 24, width: '60%', marginBottom: 12 }, animatedStyle]} />

            {/* Subtitle / Date */}
            <Animated.View style={[styles.skeletonBlock, { height: 16, width: '40%', marginBottom: 20 }, animatedStyle]} />

            {/* Content Lines */}
            <Animated.View style={[styles.skeletonBlock, { height: 16, width: '100%', marginBottom: 8 }, animatedStyle]} />
            <Animated.View style={[styles.skeletonBlock, { height: 16, width: '90%', marginBottom: 8 }, animatedStyle]} />
            <Animated.View style={[styles.skeletonBlock, { height: 16, width: '70%' }, animatedStyle]} />
        </View>
    );
};

export default function ListLoadingState({ message }: Props) {
    return (
        <View style={styles.container}>
            {[1, 2, 3, 4, 5].map((key) => (
                <SkeletonItem key={key} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        // Modern soft shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    skeletonBlock: {
        borderRadius: 6,
    }
});
