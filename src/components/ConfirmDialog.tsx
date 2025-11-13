import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

interface ConfirmDialogProps {
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
}

export default function ConfirmDialog({
    visible,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Delete',
    cancelText = 'Cancel',
}: ConfirmDialogProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '80%', maxWidth: 400 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>{title}</Text>
                    <Text style={{ color: '#6B7280', marginBottom: 20, lineHeight: 20 }}>{message}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <TouchableOpacity onPress={onCancel} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#F3F4F6', marginRight: 8 }}>
                            <Text style={{ color: '#374151', fontWeight: '600' }}>{cancelText}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onConfirm} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#EF4444' }}>
                            <Text style={{ color: '#fff', fontWeight: '600' }}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
