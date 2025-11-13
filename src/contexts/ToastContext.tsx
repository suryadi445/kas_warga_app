import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, Easing, Platform, StatusBar, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
    showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

const getToastIcon = (type: ToastType) => {
    switch (type) {
        case 'success':
            return 'checkmark-circle';
        case 'error':
            return 'close-circle';
        case 'info':
        default:
            return 'information-circle';
    }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = (msg: string, type: ToastType = 'info') => {
        setToast({ msg, type });
        toastAnim.setValue(0);
        Animated.timing(toastAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
        }).start(() => {
            setTimeout(() => {
                Animated.timing(toastAnim, {
                    toValue: 0,
                    duration: 300,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true
                }).start(() => setToast(null));
            }, 1800);
        });
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44,
                        left: 16,
                        right: 16,
                        alignItems: 'center',
                        opacity: toastAnim,
                        transform: [{
                            translateY: toastAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-8, 0]
                            })
                        }],
                        zIndex: 9999,
                    }}
                >
                    <View style={{
                        backgroundColor: toast.type === 'success' ? '#16a34a' : toast.type === 'error' ? '#dc2626' : '#0ea5e9',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 10,
                        elevation: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                    }}>
                        <Ionicons name={getToastIcon(toast.type)} size={22} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>{toast.msg}</Text>
                    </View>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};
