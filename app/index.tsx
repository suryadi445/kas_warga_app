import { Redirect } from 'expo-router';

export default function Index() {
    // Cek autentikasi di sini jika perlu
    // const isAuthenticated = false; // dari AsyncStorage atau context

    return <Redirect href="/login" />;
}
