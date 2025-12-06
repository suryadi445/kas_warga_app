import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle } from 'react-native';

type CardItemProps = {
    // Icon/Emoji
    icon?: string; // emoji string

    // Badge section (top right of content)
    badge?: string;
    badgeBg?: string;
    badgeTextColor?: string;
    badgeBorderColor?: string;

    // Main content
    title: string;
    titleColor?: string;
    subtitle?: string;
    subtitleColor?: string;
    description?: string;
    descriptionColor?: string;

    // Category or meta info
    category?: string;
    categoryColor?: string;
    categoryBg?: string;

    // Actions (right side)
    actions?: Array<{
        label: string;
        onPress: () => void;
        bg?: string;
        textColor?: string;
        disabled?: boolean;
    }>;

    // Card styling
    borderLeftColor?: string;
    containerStyle?: ViewStyle;

    // Date or time info
    date?: string;
    dateColor?: string;
    // Optional extra line or node displayed below description (e.g., image count)
    meta?: string | React.ReactNode;
};

export default function CardItem({
    icon,
    badge,
    badgeBg = '#E0E7FF',
    badgeTextColor = '#3730A3',
    badgeBorderColor,
    title,
    titleColor = '#111827',
    subtitle,
    subtitleColor = '#6B7280',
    description,
    descriptionColor = '#6B7280',
    category,
    categoryColor = '#6366F1',
    categoryBg = '#F3F4F6',
    actions = [],
    borderLeftColor = '#6366F1',
    containerStyle,
    date,
    dateColor = '#6B7280',
    meta,
}: CardItemProps) {
    return (
        <View style={[{ marginHorizontal: 16, marginVertical: 8 }, containerStyle]}>
            <View style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 16,
                elevation: 2,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                borderLeftWidth: 4,
                borderLeftColor: borderLeftColor,
            }}>
                {/* Top row: badge + date */}
                {(badge || date) && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        {badge && (
                            <View style={{
                                backgroundColor: badgeBg,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 999,
                                borderWidth: badgeBorderColor ? 1 : 0,
                                borderColor: badgeBorderColor,
                            }}>
                                <Text style={{
                                    color: badgeTextColor,
                                    fontWeight: '700',
                                    fontSize: 11,
                                }}>
                                    {badge}
                                </Text>
                            </View>
                        )}
                        {date && (
                            <Text style={{ color: dateColor, fontSize: 11, fontWeight: '500' }}>
                                📅 {date}
                            </Text>
                        )}
                    </View>
                )}

                {/* Main content row: icon + title/subtitle + actions */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                        {/* Icon emoji */}
                        {icon && (
                            <Text style={{ fontSize: 24, marginRight: 12 }}>{icon}</Text>
                        )}

                        <View style={{ flex: 1 }}>
                            {/* Title */}
                            <Text style={{
                                fontWeight: '800',
                                color: titleColor,
                                fontSize: 18,
                                marginBottom: 4,
                                letterSpacing: -0.5,
                            }}>
                                {title}
                            </Text>

                            {/* Subtitle */}
                            {subtitle && (
                                <Text style={{ color: subtitleColor, fontSize: 12, marginBottom: 4 }}>
                                    {subtitle}
                                </Text>
                            )}

                            {/* Category chip */}
                            {category && (
                                <View style={{
                                    backgroundColor: categoryBg,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                    alignSelf: 'flex-start',
                                    marginBottom: 4,
                                }}>
                                    <Text style={{ color: categoryColor, fontSize: 11, fontWeight: '600' }}>
                                        🏷️ {category}
                                    </Text>
                                </View>
                            )}

                            {/* Description */}
                            {description && (
                                <Text numberOfLines={2} style={{ color: descriptionColor, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                                    {description}
                                </Text>
                            )}
                            {meta && (
                                typeof meta === 'string' ? (
                                    <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>{meta}</Text>
                                ) : (
                                    <View style={{ marginTop: 6 }}>{meta}</View>
                                )
                            )}
                        </View>
                    </View>

                    {/* Right: action buttons stacked */}
                    {actions.length > 0 && (
                        <View style={{ marginLeft: 12, alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                            {actions.map((action, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    disabled={action.disabled}
                                    onPress={action.onPress}
                                    style={{
                                        backgroundColor: action.bg || '#E0F2FE',
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        marginBottom: idx < actions.length - 1 ? 8 : 0,
                                        opacity: action.disabled ? 0.5 : 1,
                                    }}
                                >
                                    <Text style={{ color: action.textColor || '#0369A1', fontWeight: '700', fontSize: 11 }}>
                                        {action.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}
