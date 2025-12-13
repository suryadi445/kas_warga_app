import React, { useRef, useState } from 'react';
import { StyleProp, Text, TextInput, TextInputProps, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';

type Props = {
    label: string;
    value: string;
    onChangeText?: (v: string) => void;
    onPress?: () => void;
    secureTextEntry?: boolean;
    keyboardType?: TextInputProps['keyboardType'];
    multiline?: boolean;
    numberOfLines?: number;
    editable?: boolean;
    placeholder?: string;
    containerStyle?: StyleProp<ViewStyle>;
    inputStyle?: StyleProp<TextStyle>;
};

export default function FloatingLabelInput({
    label,
    value,
    onChangeText,
    onPress,
    secureTextEntry,
    keyboardType,
    multiline,
    numberOfLines,
    editable = true,
    placeholder,
    containerStyle,
    inputStyle,
}: Props) {
    const [focused, setFocused] = useState(false);
    const ref = useRef<TextInput | null>(null);

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
    const INPUT_MULTILINE: any = { minHeight: 80, textAlignVertical: 'top' };
    const PLACEHOLDER_COLOR = '#6B7280';

    const labelColor = focused ? '#5b21b6' : PLACEHOLDER_COLOR;

    return (
        <View style={[{ position: 'relative', marginBottom: 16 }, containerStyle]}>
            <Text
                style={{
                    position: 'absolute',
                    left: 16,
                    top: -9,
                    fontSize: 12,
                    color: labelColor,
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
                // use onPressIn so focus happens immediately (prevents keyboard from hiding when switching inputs)
                onPressIn={() => {
                    if (onPress) {
                        try {
                            onPress();
                        } catch (e) {
                            // ignore
                        }
                        return;
                    }
                    if (ref.current && editable) ref.current.focus();
                }}
            >
                <TextInput
                    ref={ref}
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    secureTextEntry={secureTextEntry}
                    keyboardType={keyboardType}
                    editable={editable}
                    placeholder={undefined}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                    style={[
                        INPUT_BASE,
                        multiline ? INPUT_MULTILINE : null,
                        focused ? INPUT_FOCUS : null,
                        { paddingTop: 18 },
                        inputStyle,
                    ]}
                />

                {/* custom placeholder overlay */}
                {!value && placeholder && !focused && (
                    <Text
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: 16,
                            top: 18,
                            color: PLACEHOLDER_COLOR,
                            fontSize: 16,
                        }}
                    >
                        {placeholder}
                    </Text>
                )}
            </TouchableOpacity>
        </View >
    );
}
