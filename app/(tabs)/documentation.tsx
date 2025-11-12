import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import HeaderCard from '../components/HeaderCard';

type Documentation = {
    id: string;
    activityId: string;
    activityName: string;
    images: string[]; // array of image URIs
    description: string;
    date: string;
};

// Sample activities (normally fetched from activities store/API)
const SAMPLE_ACTIVITIES = [
    { id: 'act1', name: 'Senam Pagi' },
    { id: 'act2', name: 'Rapat RW' },
    { id: 'act3', name: 'Gotong Royong' },
];

const SAMPLE_DOCS: Documentation[] = [
    {
        id: 'd1',
        activityId: 'act1',
        activityName: 'Senam Pagi',
        images: ['https://via.placeholder.com/150'],
        description: 'Dokumentasi senam pagi minggu ini',
        date: '2025-11-09',
    },
];

export default function DocumentationScreen() {
    const [items, setItems] = useState<Documentation[]>(SAMPLE_DOCS);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [activityId, setActivityId] = useState('');
    const [activityName, setActivityName] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [description, setDescription] = useState('');
    const [activityOpen, setActivityOpen] = useState(false);

    function openAdd() {
        setEditingId(null);
        setActivityId('');
        setActivityName('');
        setImages([]);
        setDescription('');
        setModalVisible(true);
    }

    function openEdit(doc: Documentation) {
        setEditingId(doc.id);
        setActivityId(doc.activityId);
        setActivityName(doc.activityName);
        setImages(doc.images);
        setDescription(doc.description);
        setModalVisible(true);
    }

    async function pickImages() {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission required', 'Allow access to photos to upload documentation');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets) {
            const uris = result.assets.map((a: any) => a.uri);
            setImages((prev) => [...prev, ...uris]);
        }
    }

    function removeImage(uri: string) {
        setImages((prev) => prev.filter((i) => i !== uri));
    }

    function save() {
        if (!activityId) {
            Alert.alert('Error', 'Please select an activity');
            return;
        }
        if (images.length === 0) {
            Alert.alert('Error', 'Please upload at least one image');
            return;
        }

        const payload: Documentation = {
            id: editingId ?? Date.now().toString(),
            activityId,
            activityName,
            images,
            description,
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
        Alert.alert('Confirm', 'Delete this documentation?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => setItems((p) => p.filter((i) => i.id !== id)) },
        ]);
    }

    const renderItem = ({ item }: { item: Documentation }) => {
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: '#111827' }}>{item.activityName}</Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>{item.date}</Text>
                            <Text numberOfLines={2} style={{ color: '#374151', marginTop: 6 }}>{item.description || '—'}</Text>
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

                    {/* Image thumbnails */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        {item.images.map((uri, idx) => (
                            <Image key={idx} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
                        ))}
                    </ScrollView>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <HeaderCard icon="📸" title="Documentation" subtitle="Upload photos of community activities" buttonLabel="+ Add Documentation" onButtonPress={openAdd} />

            <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Documentation' : 'Add Documentation'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Activity</Text>
                            <TouchableOpacity onPress={() => setActivityOpen((v) => !v)} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: activityName ? '#111827' : '#9CA3AF' }}>{activityName || 'Select activity'}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {activityOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 6 }}>
                                    {SAMPLE_ACTIVITIES.map((act) => (
                                        <TouchableOpacity key={act.id} onPress={() => { setActivityId(act.id); setActivityName(act.name); setActivityOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
                                            <Text style={{ color: '#111827' }}>{act.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text style={{ color: '#374151', marginTop: 12 }}>Images ({images.length})</Text>
                            <TouchableOpacity onPress={pickImages} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6, alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>📷 Pick Images</Text>
                            </TouchableOpacity>

                            {images.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                    {images.map((uri, idx) => (
                                        <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                                            <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                                            <TouchableOpacity onPress={() => removeImage(uri)} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                                <Text style={{ color: '#fff', fontWeight: '700' }}>×</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}

                            <Text style={{ color: '#374151', marginTop: 12 }}>Description</Text>
                            <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" multiline numberOfLines={4} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6, textAlignVertical: 'top', minHeight: 100 }} />

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
