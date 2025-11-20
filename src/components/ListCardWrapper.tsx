import React from 'react';
import { View, ViewStyle } from 'react-native';

type Props = {
    children: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
};

export default function ListCardWrapper({ children, style }: Props) {
    return (
        <View
            style={[
                {
                    marginHorizontal: 12,
                    marginBottom: 12,
                    borderTopWidth: 1,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderBottomWidth: 0,
                    borderColor: '#E5E7EB',
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                    backgroundColor: '#fff',
                    // shadow mengarah ke atas / samping (iOS)
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    // elevation untuk Android
                    elevation: 4,
                    // biarkan overflow visible agar shadow atau last-item tidak terpotong
                    overflow: 'visible',
                    // beri wrapper ruang untuk FlatList agar onEndReached terpanggil
                    flex: 1,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}
