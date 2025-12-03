import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import id from './locales/id.json';

const resources = {
    en: { translation: en },
    id: { translation: id }
};

const LANGUAGE_KEY = 'appLang';

i18n.use(initReactI18next).init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
});

// try to read saved language
(async () => {
    try {
        const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (lang) i18n.changeLanguage(lang);
    } catch (e) {
        // ignore
    }
})();

export async function setAppLanguage(lang: string) {
    try {
        await AsyncStorage.setItem(LANGUAGE_KEY, lang);
        await i18n.changeLanguage(lang);
    } catch (e) {
        // ignore
    }
}

export default i18n;
