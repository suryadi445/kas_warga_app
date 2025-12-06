import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewStyle
} from 'react-native';

type Option = { label: string; value: string } | string;

type Props = {
    label: string;
    value: string;
    options: Option[];
    onValueChange: (v: string) => void;
    placeholder?: string;
    containerStyle?: StyleProp<ViewStyle>;
    inputStyle?: StyleProp<ViewStyle>;
    onFocus?: () => void;
    onBlur?: () => void;
};

export default function SelectInput({
    label,
    value,
    options,
    onValueChange,
    placeholder,
    containerStyle,
    inputStyle,
    onFocus,
    onBlur,
}: Props) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const PLACEHOLDER_COLOR = '#6B7280';

    const INPUT_BASE: ViewStyle = {
        borderWidth: 2,
        borderColor: '#7c3aed',
        borderRadius: 12,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
    };

    const INPUT_FOCUS: ViewStyle = {
        borderColor: '#5b21b6',
        shadowColor: '#7c3aed',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    };

    const normalized = useMemo(() => options.map((o) =>
        typeof o === 'string' ? { label: o, value: o } : o
    ), [options]);

    const filteredOptions = useMemo(() => {
        if (!searchQuery) return normalized;
        return normalized.filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [normalized, searchQuery]);

    const selectedLabel =
        normalized.find((o) => o.value === value)?.label ?? value;

    const handleOpen = () => {
        setOpen(true);
        setSearchQuery('');
        onFocus?.();
    };

    const handleClose = () => {
        setOpen(false);
        onBlur?.();
    };

    const handleSelect = (val: string) => {
        onValueChange(val);
        handleClose();
    };

    return (
        <View style={[{ marginBottom: 16 }, containerStyle]}>
            <View style={{ position: 'relative' }}>
                {/* Floating label */}
                <Text
                    style={{
                        position: 'absolute',
                        left: 18,
                        top: -9,
                        fontSize: 12,
                        color: open ? '#5b21b6' : PLACEHOLDER_COLOR,
                        backgroundColor: '#fff',
                        paddingHorizontal: 4,
                        fontWeight: '600',
                        zIndex: 4,
                    }}
                >
                    {label}
                </Text>

                {/* Trigger */}
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                        INPUT_BASE,
                        open ? INPUT_FOCUS : undefined,
                        {
                            paddingTop: 18,
                            paddingBottom: 10,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        },
                        inputStyle,
                    ]}
                    onPress={handleOpen}
                >
                    <Text
                        style={{
                            fontSize: 16,
                            color: value ? '#111827' : PLACEHOLDER_COLOR,
                        }}
                    >
                        {value
                            ? selectedLabel
                            : placeholder || `Choose ${label}`}
                    </Text>

                    <Ionicons name="chevron-down" size={14} color="#6B7280" />
                </TouchableOpacity>

                {/* Modal Popup */}
                <Modal
                    visible={open}
                    transparent
                    animationType="slide"
                    onRequestClose={handleClose}
                    statusBarTranslucent
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.modalOverlay}
                    >
                        <TouchableWithoutFeedback onPress={handleClose}>
                            <View style={styles.modalBackdrop} />
                        </TouchableWithoutFeedback>

                        <View style={styles.modalContent}>
                            {/* Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select {label}</Text>
                                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            {/* Search Input */}
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search..."
                                    placeholderTextColor="#9CA3AF"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus={false}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Options List */}
                            <FlatList
                                data={filteredOptions}
                                keyExtractor={(item) => item.value}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>No options found</Text>
                                    </View>
                                }
                                renderItem={({ item }) => {
                                    const isSelected = item.value === value;
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.optionItem,
                                                isSelected && styles.optionItemSelected
                                            ]}
                                            onPress={() => handleSelect(item.value)}
                                        >
                                            <Text style={[
                                                styles.optionText,
                                                isSelected && styles.optionTextSelected
                                            ]}>
                                                {item.label}
                                            </Text>
                                            {isSelected && (
                                                <Ionicons name="checkmark" size={20} color="#7c3aed" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        minHeight: '50%',
        paddingTop: 20,
        paddingBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        marginHorizontal: 20,
        marginBottom: 16,
        paddingHorizontal: 12,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
        height: '100%',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    optionItemSelected: {
        backgroundColor: '#F5F3FF',
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    optionText: {
        fontSize: 16,
        color: '#374151',
    },
    optionTextSelected: {
        color: '#7c3aed',
        fontWeight: '600',
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 14,
    },
});
