import React, { useState } from 'react';
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

type Option = { label: string; value: string } | string;

type Props = {
    label: string;
    value: string;
    options: Option[]; // string[] or {label,value}[]
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

    const INPUT_BASE: any = {
        borderWidth: 2,
        borderColor: '#7c3aed',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
    };
    const INPUT_FOCUS: any = {
        borderColor: '#5b21b6',
        shadowColor: '#7c3aed',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    };
    const PLACEHOLDER_COLOR = '#6B7280';

    const normalized = options.map((o) =>
        typeof o === 'string' ? { label: o, value: o } : o
    );

    return (
        <View style={[{ position: 'relative', marginBottom: 16 }, containerStyle]}>
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

            <TouchableOpacity
                activeOpacity={1}
                style={[
                    INPUT_BASE,
                    open ? INPUT_FOCUS : null,
                    // match FloatingLabelInput vertical spacing (paddingTop 18, paddingBottom 10)
                    { paddingTop: 18, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                    inputStyle,
                ]}
                onPress={() => {
                    const next = !open;
                    setOpen(next);
                    if (next && onFocus) onFocus();
                    if (!next && onBlur) onBlur();
                }}
            >
                <Text style={{ color: value ? '#111827' : PLACEHOLDER_COLOR, fontSize: 16 }}>
                    {value ? (normalized.find((o) => o.value === value)?.label ?? value) : (placeholder || `Choose ${label}`)}
                </Text>
                <Text style={{ color: '#6B7280' }}>▾</Text>
            </TouchableOpacity>

            {open && (
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 8, zIndex: 2 }}>
                    {normalized.map((opt) => (
                        <TouchableOpacity
                            key={opt.value}
                            onPress={() => {
                                onValueChange(opt.value);
                                // delay closing to ensure selected value renders
                                setTimeout(() => {
                                    setOpen(false);
                                    if (onBlur) onBlur();
                                }, 0);
                            }}
                            style={{ paddingVertical: 12, paddingHorizontal: 12 }}
                        >
                            <Text style={{ color: '#111827' }}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}
