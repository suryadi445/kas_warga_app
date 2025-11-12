import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Announcement = {
    id: string;
    title: string;
    content: string;
    priority: 'low' | 'medium' | 'high';
    date: string;
};

const PRIORITIES = [
    { value: 'low', label: 'Low', color: '#10B981' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#EF4444' },
];

const SAMPLE: Announcement[] = [
    { id: 'a1', title: 'Rapat RW', content: 'Rapat bulanan RW akan diadakan...', priority: 'high', date: '2024-11-20' },
];

export default function AnnouncementsScreen() {
    const [items, setItems] = useState<Announcement[]>(SAMPLE);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [priorityOpen, setPriorityOpen] = useState(false);

    function openAdd() {
        setEditingId(null);
        setTitle('');
        setContent('');
        setPriority('medium');
        setModalVisible(true);
    }

    function openEdit(a: Announcement) {
        setEditingId(a.id);
        setTitle(a.title);
        setContent(a.content);
        setPriority(a.priority);
        setModalVisible(true);
    }

    function save() {
        if (!title.trim()) {
            Alert.alert('Error', 'Title is required');
            return;
        }
        const payload: Announcement = {
            id: editingId ?? Date.now().toString(),
            title,
            content,
            priority,
            date: new Date().toISOString().split('T')[0],
        };
        if (editingId) {
            setItems((p) => p.map((i) => (i.id === editingId ? payload : i)));
        } else {
            setItems((p) => [payload, ...p]);
        }
        setModalVisible(false);
    }

    function remove(id: string) {
        Alert.alert('Confirm', 'Delete this announcement?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => setItems((p) => p.filter((i) => i.id !== id)) },
        ]);
    }

    const renderItem = ({ item }: { item: Announcement }) => {
        const priorityInfo = PRIORITIES.find((p) => p.value === item.priority) ?? PRIORITIES[1];
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: '#111827' }}>{item.title}</Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>{item.date}</Text>
                            <Text numberOfLines={3} style={{ color: '#374151', marginTop: 6 }}>{item.content}</Text>
                            <View style={{ backgroundColor: priorityInfo.color, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginTop: 8, alignSelf: 'flex-start' }}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{priorityInfo.label}</Text>
                            </View>
                        </View>

                        <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>
                            <TouchableOpacity onPress={() => openEdit(item)} style={{ marginBottom: 8 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => remove(item.id)}>
                                <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Header */}
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>📢</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Announcements</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Manage community announcements
                </Text>
            </View>

            {/* Add button */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity onPress={openAdd}>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ paddingVertical: 12, borderRadius: 999, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Announcement</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Announcement' : 'Add Announcement'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Title</Text>
                            <TextInput value={title} onChangeText={setTitle} placeholder="Announcement title" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 12 }}>Content</Text>
                            <TextInput value={content} onChangeText={setContent} placeholder="Announcement content" multiline numberOfLines={6} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6, textAlignVertical: 'top', minHeight: 120 }} />

                            <Text style={{ color: '#374151', marginTop: 12 }}>Priority</Text>
                            <TouchableOpacity onPress={() => setPriorityOpen((v) => !v)} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text>{PRIORITIES.find((p) => p.value === priority)?.label ?? priority}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {priorityOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 6 }}>
                                    {PRIORITIES.map((p) => (
                                        <TouchableOpacity key={p.value} onPress={() => { setPriority(p.value as any); setPriorityOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
                                            <Text style={{ color: '#111827' }}>{p.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 10 }}>
                                    <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={save} style={{ padding: 10 }}>
                                    <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Add'}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
