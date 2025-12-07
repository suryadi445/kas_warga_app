import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRefresh } from '../../src/hooks/useRefresh';

// --- Helper: Hijri <-> Gregorian ---
const HIJRI_MONTHS = [
    'Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Shaʿban', 'Ramadan', 'Syawal', 'Zulqadah', 'Dzulhijjah'
];
function gregorianToJDN(gy: number, gm: number, gd: number) { const a = Math.floor((14 - gm) / 12); const y = gy + 4800 - a; const m = gm + 12 * a - 3; return gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045; }
function jdnToGregorian(jd: number) { const z = Math.floor(jd); let a = z; if (z >= 2299161) { const alpha = Math.floor((z - 1867216.25) / 36524.25); a = z + 1 + alpha - Math.floor(alpha / 4); } const b = a + 1524; const c = Math.floor((b - 122.1) / 365.25); const d = Math.floor(365.25 * c); const e = Math.floor((b - d) / 30.6001); const day = b - d - Math.floor(30.6001 * e); const month = e < 14 ? e - 1 : e - 13; const year = month > 2 ? c - 4716 : c - 4715; return { year, month, day }; }
function islamicToJDN(iy: number, im: number, id: number) { const n = id + Math.ceil(29.5 * (im - 1)) + (iy - 1) * 354 + Math.floor((3 + 11 * iy) / 30); return n + 1948439; }
function jdnToIslamic(jd: number) { const jd0 = Math.floor(jd) + 0.5; const days = jd0 - 1948439; const iy = Math.floor((30 * days + 10646) / 10631); const startOfYearJdn = islamicToJDN(iy, 1, 1); let dayOfYear = jd0 - startOfYearJdn + 1; if (dayOfYear <= 0) { return jdnToIslamic(jd); } const im = Math.ceil(dayOfYear / 29.5); const id = Math.floor(jd0 - islamicToJDN(iy, im, 1) + 1); return { iy, im, id }; }
function islamicToGregorian(iy: number, im: number, id: number) { const j = islamicToJDN(iy, im, id); const g = jdnToGregorian(j); const mm = String(g.month).padStart(2, '0'); const dd = String(g.day).padStart(2, '0'); return `${g.year}-${mm}-${dd}`; }
function gregorianToIslamic(gy: number, gm: number, gd: number) { const jd = gregorianToJDN(gy, gm, gd); return jdnToIslamic(jd); }

// --- Helper: Qibla ---
const KAABA = { lat: 21.422487, lon: 39.826206 };
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
    const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
}
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function PrayerPage() {
    const { t } = useTranslation();
    const now = new Date();
    const [tab, setTab] = useState<'times' | 'schedule' | 'qibla'>('times');
    const [lat, setLat] = useState<number>(-6.2);
    const [lon, setLon] = useState<number>(106.816666);
    const [dateStr, setDateStr] = useState<string>(now.toISOString().split('T')[0]);
    const [hijriDate, setHijriDate] = useState<string>('');
    const [times, setTimes] = useState<Record<string, string> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [holidays, setHolidays] = useState<string[]>([]);
    const holidaysFetched = useRef(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [locationName, setLocationName] = useState<string>(t('locating', { defaultValue: 'Locating...' }));
    const [cityKeyword, setCityKeyword] = useState<string | null>(null);
    const [deviceHeading, setDeviceHeading] = useState(0);
    const [magnetometerData, setMagnetometerData] = useState(0); // in microTesla (uT)
    const [bearing, setBearing] = useState(0);
    const [distanceKm, setDistanceKm] = useState(0);
    const [source, setSource] = useState<string>('');
    const fetchIdRef = useRef(0);
    const [refreshKey, setRefreshKey] = useState(0);

    // Update current time every second for real-time countdown
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Subscribe to magnetometer for compass rotation
    useEffect(() => {
        const subscription = Magnetometer.addListener((data: { x: number; y: number; z: number }) => {
            const { x, y, z } = data;

            // Calculate Magnetic Field Strength (Magnitude)
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            setMagnetometerData(magnitude);

            // Convert Math Angle to Compass Heading
            // Math.atan2(y, x) gives angle CCW from X-axis.
            // We need CW from Y-axis (North).
            // Based on sensor axis: North(y=1,x=0)=90deg, East(y=0,x=-1)=180deg

            let angle = Math.atan2(y, x) * (180 / Math.PI);

            // Correct formula for CW rotation: angle - 90
            let heading = angle - 90;

            // Normalize to 0-360
            if (heading < 0) heading += 360;

            // Simple Low-Pass Filter to smooth movement
            setDeviceHeading(prev => {
                const delta = heading - prev;
                // Handle wrap-around (e.g. 359 -> 1)
                if (Math.abs(delta) > 180) {
                    return heading;
                }
                // Smoothing factor (0.1 = very smooth/slow, 1.0 = instant/jittery)
                return prev + delta * 0.15;
            });
        });

        Magnetometer.setUpdateInterval(50); // Faster update for smoother animation

        return () => subscription.remove();
    }, []);

    // Ensure status bar is transparent (esp. on Android)
    useEffect(() => {
        if (Platform.OS === 'android') {
            // Make status bar fully transparent and translucent on Android
            StatusBar.setBackgroundColor('transparent', true);
            StatusBar.setTranslucent(true);
        }
    }, []);

    const updateQibla = (latitude: number, longitude: number) => {
        const qibla = computeBearing(latitude, longitude, KAABA.lat, KAABA.lon);
        setBearing(qibla);
        const dist = haversineDistanceKm(latitude, longitude, KAABA.lat, KAABA.lon);
        setDistanceKm(dist);
    };

    const getLocationFromGPS = async () => {
        setLoading(true);
        setTimes(null);
        setError(null);
        setLocationName(t('locating', { defaultValue: 'Locating...' }));

        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError(t('location_permission_denied', { defaultValue: 'Permission to access location was denied' }));
                setLocationName(t('unknown_location', { defaultValue: 'Unknown Location' }));
                setLoading(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;
            setLat(latitude);
            setLon(longitude);
            updateQibla(latitude, longitude);

            try {
                const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (reverseGeocode.length > 0) {
                    const address = reverseGeocode[0];
                    console.log('Detected Address:', JSON.stringify(address));

                    // Prioritize district, fallback to city or subregion
                    const name = address.district || address.city || address.subregion || address.region;
                    const finalName = name || t('unknown_location', { defaultValue: 'Unknown Location' });
                    setLocationName(finalName);

                    // Set keyword for MyQuran search
                    // Try to find a suitable city name. Prioritize subregion (often Kota/Kabupaten) over city.
                    let keyword = address.subregion || address.city || address.region;

                    // If the picked keyword contains 'Kecamatan', try to find a better field
                    if (keyword && keyword.toLowerCase().includes('kecamatan')) {
                        const candidates = [address.subregion, address.city, address.region];
                        const better = candidates.find(c => c && !c.toLowerCase().includes('kecamatan'));
                        if (better) keyword = better;
                    }

                    if (keyword) setCityKeyword(keyword);

                    // Save to storage
                    AsyncStorage.setItem('prayer_location', JSON.stringify({
                        lat: latitude,
                        lon: longitude,
                        locationName: finalName,
                        cityKeyword: keyword
                    }));
                }
            } catch (e) {
                console.log('Reverse geocoding failed', e);
                setLocationName(t('unknown_location', { defaultValue: 'Unknown Location' }));
            }
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            setLoading(false);
            setError(t('location_error', { defaultValue: 'Failed to get location' }));
        }
    };

    const loadLocation = async () => {
        try {
            const saved = await AsyncStorage.getItem('prayer_location');
            if (saved) {
                const data = JSON.parse(saved);
                setLat(data.lat);
                setLon(data.lon);
                setLocationName(data.locationName);
                setCityKeyword(data.cityKeyword);
                updateQibla(data.lat, data.lon);
            } else {
                getLocationFromGPS();
            }
        } catch {
            getLocationFromGPS();
        }
    };

    useEffect(() => {
        loadLocation();
    }, []);
    useEffect(() => { fetchTimes(); }, [dateStr, lat, lon, cityKeyword, refreshKey]);
    async function fetchTimes() {
        const myId = fetchIdRef.current + 1;
        fetchIdRef.current = myId;

        setLoading(true); setError(null); setTimes(null);

        try {
            let myQuranSuccess = false;

            // 1. Try MyQuran API if cityKeyword is available
            if (cityKeyword) {
                try {
                    // Independent controller for MyQuran
                    const mqController = new AbortController();
                    const mqTimeout = setTimeout(() => mqController.abort(), 5000); // 5s timeout

                    console.log('Searching city in MyQuran:', cityKeyword);
                    const searchRes = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(cityKeyword)}`, { signal: mqController.signal });
                    const searchJson = await searchRes.json();

                    if (searchJson.status && searchJson.data && searchJson.data.length > 0) {
                        const cityId = searchJson.data[0].id;
                        const [y, m, d] = dateStr.split('-');

                        console.log('Fetching schedule from MyQuran for ID:', cityId);
                        const scheduleRes = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/${y}/${m}/${d}`, { signal: mqController.signal });
                        const scheduleJson = await scheduleRes.json();

                        clearTimeout(mqTimeout);

                        if (scheduleJson.status && scheduleJson.data && scheduleJson.data.jadwal) {
                            if (fetchIdRef.current !== myId) return;
                            const j = scheduleJson.data.jadwal;
                            setTimes({
                                Fajr: j.subuh,
                                Dhuhr: j.dzuhur,
                                Asr: j.ashar,
                                Maghrib: j.maghrib,
                                Isha: j.isya,
                                Sunrise: j.terbit,
                                Imsak: j.imsak
                            });

                            // Calculate Hijri date locally
                            const [gy, gm, gd] = dateStr.split('-').map(Number);
                            const h = gregorianToIslamic(gy, gm, gd);
                            const hMonth = HIJRI_MONTHS[h.im - 1];
                            setHijriDate(`${h.id} ${hMonth} ${h.iy}`);

                            myQuranSuccess = true;
                            setSource('MyQuran');
                        }
                    } else {
                        clearTimeout(mqTimeout);
                        console.log('MyQuran search returned no results for:', cityKeyword);
                    }
                } catch (err) {
                    console.log('MyQuran API failed/timed out, falling back to Aladhan', err);
                }
            }

            if (fetchIdRef.current !== myId) return;

            if (myQuranSuccess) {
                setLoading(false);
                return;
            }

            // 2. Fallback to Aladhan API
            console.log('Fetching from Aladhan API...');
            const aladhanController = new AbortController();
            const aladhanTimeout = setTimeout(() => aladhanController.abort(), 10000); // 10s timeout

            const timestamp = Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 1000);
            const url = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lon}&method=2`;

            try {
                const res = await fetch(url, { signal: aladhanController.signal });
                clearTimeout(aladhanTimeout);

                const json = await res.json();
                if (fetchIdRef.current !== myId) return;

                if (json?.code === 200 && json?.data?.timings) {
                    setTimes(json.data.timings);
                    const hij = json.data?.date?.hijri;
                    if (hij) {
                        const month = hij.month?.en ?? hij.month?.ar ?? '';
                        setHijriDate(`${hij.day} ${month} ${hij.year}`);
                    } else setHijriDate('');
                    setSource('Aladhan');
                } else {
                    setError(t('failed_get_prayer_times', { defaultValue: 'Failed to get prayer times' }));
                    setHijriDate('');
                }
            } catch (err: any) {
                clearTimeout(aladhanTimeout);
                throw err;
            }

        } catch (err: any) {
            if (fetchIdRef.current !== myId) return;
            if (err.name === 'AbortError') {
                setError(t('request_timeout', { defaultValue: 'Request timed out. Please check your connection.' }));
            } else {
                setError(t('network_error', { defaultValue: 'Network error. Please try again.' }));
            }
            setHijriDate('');
        }
        finally {
            if (fetchIdRef.current === myId) {
                setLoading(false);
            }
        }
    } async function fetchHolidays() {
        try {
            const res = await fetch('https://api-harilibur.vercel.app/api');
            const data = await res.json();
            const dates = data.filter((x: any) => x.is_national_holiday).map((x: any) => x.holiday_date);
            setHolidays(dates);

            const info: Record<string, string> = {};
            data.forEach((x: any) => {
                if (x.is_national_holiday) info[x.holiday_date] = x.holiday_name;
            });
            setHolidaysInfo(info);
        } catch { }
    }

    useEffect(() => {
        if (holidaysFetched.current) return;
        holidaysFetched.current = true;
        fetchHolidays();
    }, []);

    // Use custom refresh hook
    const { refreshing, onRefresh } = useRefresh(async () => {
        await Promise.all([fetchTimes(), fetchHolidays()]);
    });

    // Helper: get local ISO date string (YYYY-MM-DD) for given year, month, day
    function localIsoDate(year: number, month: number, day: number) {
        // month: 1..12
        const d = new Date(year, month - 1, day);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // --- Unified Calendar Grid (Masehi + Hijri) ---
    const [holidaysInfo, setHolidaysInfo] = useState<Record<string, string>>({});
    useEffect(() => {
        fetch('https://api-harilibur.vercel.app/api')
            .then(res => res.json())
            .then(data => {
                const info: Record<string, string> = {};
                data.forEach((x: any) => {
                    if (x.is_national_holiday) info[x.holiday_date] = x.holiday_name;
                });
                setHolidaysInfo(info);
            })
            .catch(() => { });
    }, []);

    function renderUnifiedCalendar() {
        const [gy, gm, gd] = dateStr.split('-').map(Number);
        const month = gm, year = gy;
        const firstWeekday = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const gcells: Array<{ day: number; iso: string; hijri: { iy: number; im: number; id: number } } | null> = [];
        for (let b = 0; b < firstWeekday; b++) gcells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hijri = gregorianToIslamic(year, month, d);
            gcells.push({ day: d, iso, hijri });
        }
        while (gcells.length % 7 !== 0) gcells.push(null);
        const grow: Array<typeof gcells> = [];
        for (let r = 0; r < gcells.length; r += 7) grow.push(gcells.slice(r, r + 7));
        const monthNames = [
            t('month_jan', { defaultValue: 'Jan' }),
            t('month_feb', { defaultValue: 'Feb' }),
            t('month_mar', { defaultValue: 'Mar' }),
            t('month_apr', { defaultValue: 'Apr' }),
            t('month_may', { defaultValue: 'May' }),
            t('month_jun', { defaultValue: 'Jun' }),
            t('month_jul', { defaultValue: 'Jul' }),
            t('month_aug', { defaultValue: 'Aug' }),
            t('month_sep', { defaultValue: 'Sep' }),
            t('month_oct', { defaultValue: 'Oct' }),
            t('month_nov', { defaultValue: 'Nov' }),
            t('month_dec', { defaultValue: 'Dec' }),
        ];

        // Ambil hijri dari tanggal yang sedang dipilih (dateStr)
        const hijriSelected = gregorianToIslamic(gy, gm, gd);
        const hijriMonthName = HIJRI_MONTHS[hijriSelected.im - 1];
        const hijriYear = hijriSelected.iy;

        // Cari semua tanggal libur di bulan ini
        const holidaysInMonth = holidays
            .filter(date => {
                // date: 'YYYY-MM-DD'
                const [y, m] = date.split('-');
                return Number(y) === year && Number(m) === month;
            });

        return (
            <View>
                {/* Month Navigation */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <TouchableOpacity onPress={() => {
                        const prevMonth = month - 1 < 1 ? 12 : month - 1;
                        const prevYear = month - 1 < 1 ? year - 1 : year;
                        setDateStr(localIsoDate(prevYear, prevMonth, 1));
                    }} style={{
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Text style={{ color: '#7C3AED', fontSize: 18, fontWeight: '700' }}>◀</Text>
                    </TouchableOpacity>

                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontWeight: '800', fontSize: 16, color: '#1F2937' }}>{monthNames[month - 1]} {year}</Text>
                        <Text style={{ fontWeight: '600', fontSize: 13, color: '#7C3AED', marginTop: 2 }}>
                            {hijriMonthName} {hijriYear}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => {
                        const nextMonth = month + 1 > 12 ? 1 : month + 1;
                        const nextYear = month + 1 > 12 ? year + 1 : year;
                        setDateStr(localIsoDate(nextYear, nextMonth, 1));
                    }} style={{
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Text style={{ color: '#7C3AED', fontSize: 18, fontWeight: '700' }}>▶</Text>
                    </TouchableOpacity>
                </View>

                {/* Weekday Headers */}
                <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 8 }}>
                    {[
                        t('weekday_short_sunday', { defaultValue: 'Sun' }),
                        t('weekday_short_monday', { defaultValue: 'Mon' }),
                        t('weekday_short_tuesday', { defaultValue: 'Tue' }),
                        t('weekday_short_wednesday', { defaultValue: 'Wed' }),
                        t('weekday_short_thursday', { defaultValue: 'Thu' }),
                        t('weekday_short_friday', { defaultValue: 'Fri' }),
                        t('weekday_short_saturday', { defaultValue: 'Sat' }),
                    ].map((w, i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#9CA3AF' }}>{w}</Text>
                        </View>
                    ))}
                </View>

                {/* Calendar Grid */}
                {grow.map((row, ri) => (
                    <View key={ri} style={{ flexDirection: 'row', marginTop: 6 }}>
                        {row.map((c, ci) => {
                            if (!c) return <View key={ci} style={{ flex: 1 }} />;
                            const isSelected = c.iso === dateStr;
                            const hijriDay = c.hijri.id;
                            const hijriMonth = HIJRI_MONTHS[c.hijri.im - 1];
                            let displayHijriDay = hijriDay;
                            if (hijriDay <= 0) {
                                let found29 = false;
                                for (let k = 0; k < row.length; k++) {
                                    const cell = row[k];
                                    if (cell && cell.hijri.id === 29) {
                                        found29 = true;
                                        break;
                                    }
                                }
                                displayHijriDay = found29 ? 30 : 29;
                            }
                            // Cek apakah tanggal merah dari API (state holidays)
                            const isHoliday = holidays.includes(c.iso);

                            // Prioritas: selected > holiday > default
                            let bgColor = 'transparent';
                            let borderColor = '#7C3AED';
                            let textColor = '#1F2937';
                            let hijriColor = '#7C3AED';
                            let fontWeight: 'normal' | 'bold' | undefined = 'normal';
                            if (isSelected) {
                                bgColor = '#7C3AED';
                                textColor = '#fff';
                                hijriColor = '#fff';
                                borderColor = '#7C3AED';
                                fontWeight = 'bold';
                            } else if (isHoliday) {
                                bgColor = '#FEE2E2';
                                textColor = '#DC2626';
                                hijriColor = '#DC2626';
                                borderColor = '#FCA5A5';
                                fontWeight = 'bold';
                            }

                            return (
                                <TouchableOpacity key={ci} onPress={() => setDateStr(c.iso)} style={{ flex: 1, alignItems: 'center' }}>
                                    <View style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 21,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: bgColor,
                                        borderWidth: isSelected ? 2 : isHoliday ? 1.5 : 0,
                                        borderColor: borderColor,
                                        shadowColor: isSelected ? '#7C3AED' : 'transparent',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 4,
                                        elevation: isSelected ? 4 : 0
                                    }}>
                                        <Text style={{
                                            color: textColor,
                                            fontSize: 16,
                                            fontWeight: fontWeight
                                        }}>
                                            {c.day}
                                            <Text style={{
                                                fontSize: 9,
                                                color: hijriColor,
                                                position: 'absolute',
                                                top: 2,
                                                right: 2
                                            }}>
                                                {' '}<Text style={{ fontSize: 9, color: hijriColor }}>{displayHijriDay}</Text>
                                            </Text>
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}

                {/* National Holidays List */}
                {holidaysInMonth.length > 0 && (
                    <View style={{
                        marginTop: 16,
                        backgroundColor: 'rgba(220, 38, 38, 0.05)',
                        borderRadius: 12,
                        padding: 12,
                        borderLeftWidth: 3,
                        borderLeftColor: '#DC2626'
                    }}>
                        <Text style={{ color: '#DC2626', fontWeight: '800', marginBottom: 8, fontSize: 14 }}>{t('national_holidays', { defaultValue: '🎉 National Holidays' })}</Text>
                        {holidaysInMonth.map(date => {
                            // Format date from "YYYY-MM-DD" to "01 Jan 2025"
                            const formatHolidayDate = (dateStr: string) => {
                                const [year, month, day] = dateStr.split('-');
                                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                return `${day} ${monthNames[parseInt(month) - 1]} ${year}`;
                            };

                            return (
                                <Text key={date} style={{ color: '#991B1B', fontSize: 13, marginTop: 4, fontWeight: '600' }}>
                                    • {formatHolidayDate(date)} - {holidaysInfo[date] || ''}
                                </Text>
                            );
                        })}
                    </View>
                )}
            </View>
        );
    }

    // --- Helper: Next Prayer & Countdown ---
    function getNextPrayer() {
        if (!times) return null;

        const prayerKeys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const now = currentTime;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSeconds = now.getSeconds();
        const currentTotalSeconds = currentHour * 3600 + currentMinute * 60 + currentSeconds;

        for (const key of prayerKeys) {
            const timeStr = times[key]; // format: "HH:MM"
            if (!timeStr) continue;

            const [h, m] = timeStr.split(':').map(Number);
            const prayerTotalSeconds = h * 3600 + m * 60;

            if (prayerTotalSeconds > currentTotalSeconds) {
                const diff = prayerTotalSeconds - currentTotalSeconds;
                const name = t(`prayer_${key.toLowerCase()}`, { defaultValue: key });
                return { name, timeStr, remainingSeconds: diff };
            }
        }

        // If no prayer left today, return Fajr tomorrow
        const fajrTime = times['Fajr'];
        if (fajrTime) {
            const [h, m] = fajrTime.split(':').map(Number);
            const fajrTotalSeconds = h * 3600 + m * 60;
            const diff = (24 * 3600) - currentTotalSeconds + fajrTotalSeconds;
            const name = t('prayer_fajr', { defaultValue: 'Fajr' });
            return { name, timeStr: fajrTime, remainingSeconds: diff };
        }

        return null;
    }

    function formatCountdown(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) {
            return `${h}h ${m}m ${s}s`;
        } else if (m > 0) {
            return `${m}m ${s}s`;
        } else {
            return `${s}s`;
        }
    }

    const nextPrayer = getNextPrayer();



    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Purple Gradient Background for Header */}
            <LinearGradient
                colors={['#7c3aed', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 200,
                }}
            />

            {/* Header - Horizontal Layout */}
            <View style={{ padding: 16, paddingBottom: 30 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    {/* Icon on left */}
                    <View style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 6
                    }}>
                        <Text style={{ fontSize: 32 }}>🕌</Text>
                    </View>

                    {/* Text on right */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{t('prayer_schedule_title', { defaultValue: 'Prayer Schedule' })}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            {t('prayer_schedule_subtitle', { defaultValue: 'View prayer times, qibla direction, and Hijri calendar' })}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Tab Switcher - Fixed, Not Scrollable */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 30 }}>
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 16,
                    padding: 4,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)'
                }}>
                    <TouchableOpacity
                        onPress={() => setTab('times')}
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            backgroundColor: tab === 'times' ? '#FFFFFF' : 'transparent',
                            borderRadius: 12,
                            shadowColor: tab === 'times' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: tab === 'times' ? 4 : 0
                        }}
                    >
                        <Text style={{
                            color: tab === 'times' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            textAlign: 'center',
                            fontSize: 14
                        }}>{t('tab_times', { defaultValue: '🕐 Times' })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setTab('schedule')}
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            backgroundColor: tab === 'schedule' ? '#FFFFFF' : 'transparent',
                            borderRadius: 12,
                            shadowColor: tab === 'schedule' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: tab === 'schedule' ? 4 : 0
                        }}
                    >
                        <Text style={{
                            color: tab === 'schedule' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            textAlign: 'center',
                            fontSize: 14
                        }}>{t('tab_calendar', { defaultValue: '📅 Calendar' })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setTab('qibla')}
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            backgroundColor: tab === 'qibla' ? '#FFFFFF' : 'transparent',
                            borderRadius: 12,
                            shadowColor: tab === 'qibla' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: tab === 'qibla' ? 4 : 0
                        }}
                    >
                        <Text style={{
                            color: tab === 'qibla' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            textAlign: 'center',
                            fontSize: 14
                        }}>{t('tab_qibla', { defaultValue: '🧭 Qibla' })}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView
                style={{ backgroundColor: '#F8FAFC' }}
                contentContainerStyle={{ padding: 20, paddingTop: 20 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
                }
            >
                {/* Tab Content */}
                {tab === 'times' && (
                    <View style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: 20,
                        padding: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.15,
                        shadowRadius: 20,
                        elevation: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.3)'
                    }}>
                        <Text style={{ fontWeight: '800', fontSize: 18, color: '#1F2937', marginBottom: 12 }}>{t('prayer_times_title', { defaultValue: '🕐 Prayer Times' })}</Text>

                        {/* Next Prayer Countdown */}
                        {nextPrayer && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '400', color: '#10B981' }}>
                                    {nextPrayer.name}
                                </Text>
                                <Text style={{ fontSize: 12, fontWeight: '400', color: '#10B981', letterSpacing: 0.5 }}>
                                    {formatCountdown(nextPrayer.remainingSeconds)}
                                </Text>
                            </View>
                        )}

                        {loading && <ActivityIndicator size="small" color="#7C3AED" />}
                        {error && (
                            <View style={{ alignItems: 'center', padding: 20 }}>
                                <Text style={{ color: '#EF4444', fontWeight: '600', marginBottom: 10, textAlign: 'center' }}>{error}</Text>
                                <TouchableOpacity
                                    onPress={fetchTimes}
                                    style={{ backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700' }}>{t('retry', { defaultValue: 'Retry' })}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {times && (
                            <View>
                                {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((k, idx) => (
                                    <View key={k} style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                        paddingHorizontal: 16,
                                        backgroundColor: idx % 2 === 0 ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
                                        borderRadius: 12,
                                        marginBottom: 4
                                    }}>
                                        <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 16 }}>{t(`prayer_${k.toLowerCase()}`, { defaultValue: k })}</Text>
                                        <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 16 }}>{times[k]}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Location Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '600', marginRight: 8 }} numberOfLines={1}>
                                    {locationName}
                                </Text>
                                <TouchableOpacity onPress={getLocationFromGPS}>
                                    <Ionicons name="reload" size={16} color="#7C3AED" />
                                </TouchableOpacity>
                            </View>
                            {source ? (
                                <Text style={{ color: '#9CA3AF', fontSize: 10, marginLeft: 8 }}>
                                    {source === 'MyQuran' ? 'Powered by MyQuran.com' : t('powered_by_aladhan', { defaultValue: 'Powered by Aladhan API' })}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                )}

                {tab === 'schedule' && (
                    <View style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: 20,
                        padding: 20,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.15,
                        shadowRadius: 20,
                        elevation: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.3)'
                    }}>
                        <Text style={{ fontWeight: '800', fontSize: 18, color: '#1F2937', marginBottom: 16 }}>{t('calendar_title', { defaultValue: '📆 Calendar' })}</Text>
                        {renderUnifiedCalendar()}
                        <View style={{ height: 12 }} />
                    </View>
                )}

                {tab === 'qibla' && (
                    <View style={{
                        flex: 1,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 24,
                        padding: 16, // Reduced padding
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        // Shadow properties
                        shadowColor: "#000",
                        shadowOffset: {
                            width: 0,
                            height: 4,
                        },
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        elevation: 5,
                    }}>
                        {/* Top Info Bar */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 }}>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ color: '#7C3AED', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>{t('label_true_north_upper', { defaultValue: 'UTARA SEJATI' })}</Text>
                                <Text style={{ color: '#FF0000', fontSize: 16, fontWeight: 'bold' }}>
                                    {deviceHeading.toFixed(0)}° N
                                </Text>
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ color: '#7C3AED', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>{t('label_kaabah_upper', { defaultValue: "KA'BAH" })}</Text>
                                {(() => {
                                    let delta = bearing - deviceHeading;
                                    while (delta < -180) delta += 360;
                                    while (delta > 180) delta -= 360;

                                    const isAligned = Math.abs(delta) < 5;
                                    const direction = delta > 0 ? '➡️' : '⬅️';

                                    return (
                                        <View style={{ alignItems: 'center' }}>
                                            <Text style={{
                                                color: isAligned ? '#34D399' : '#FF0000', // Green-400 for aligned
                                                fontSize: 16,
                                                fontWeight: 'bold'
                                            }}>
                                                {Math.abs(delta).toFixed(0)}° {isAligned ? '✅' : direction}
                                            </Text>
                                        </View>
                                    );
                                })()}
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ color: '#7C3AED', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>{t('label_magnetic_field_upper', { defaultValue: 'MEDAN MAGNET' })}</Text>
                                <Text style={{ color: '#FF0000', fontSize: 16, fontWeight: 'bold' }}>
                                    {magnetometerData.toFixed(0)} µT
                                </Text>
                            </View>
                        </View>

                        {/* Professional Compass Dial - Compact Size */}
                        <View style={{
                            width: 240, // Reduced from 300
                            height: 240, // Reduced from 300
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}>
                            {/* Static Crosshair (Fixed Center) */}
                            <View style={{ position: 'absolute', zIndex: 20, pointerEvents: 'none' }}>
                                <View style={{ width: 2, height: 30, backgroundColor: '#FF0000', opacity: 0.8 }} />
                                <View style={{ width: 30, height: 2, backgroundColor: '#FF0000', position: 'absolute', top: 14, left: -14, opacity: 0.8 }} />
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF0000', position: 'absolute', top: 12, left: -2 }} />
                            </View>

                            {/* Static Top Indicator Line */}
                            <View style={{ position: 'absolute', top: -15, zIndex: 20, alignItems: 'center' }}>
                                <View style={{ width: 2, height: 20, backgroundColor: '#7C3AED' }} />
                            </View>

                            {/* Rotating Dial */}
                            <View style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 120,
                                borderWidth: 2,
                                borderColor: 'rgba(255,255,255,0.1)',
                                backgroundColor: '#140234ff',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: [{ rotate: `${-deviceHeading}deg` }]
                            }}>
                                {/* Degree Ticks */}
                                {Array.from({ length: 72 }).map((_, i) => {
                                    const deg = i * 5;
                                    const isMajor = deg % 30 === 0;
                                    const isCardinal = deg % 90 === 0;
                                    return (
                                        <View key={i} style={{
                                            position: 'absolute',
                                            height: '100%',
                                            width: 2,
                                            alignItems: 'center',
                                            transform: [{ rotate: `${deg}deg` }]
                                        }}>
                                            <View style={{
                                                width: isCardinal ? 3 : (isMajor ? 2 : 1),
                                                height: isCardinal ? 12 : (isMajor ? 8 : 4),
                                                backgroundColor: isCardinal ? '#7C3AED' : '#7C3AED',
                                                marginTop: 4
                                            }} />
                                        </View>
                                    );
                                })}

                                {/* Cardinal Directions */}
                                {[
                                    { label: 'N', deg: 0, color: '#7C3AED' },
                                    { label: 'NE', deg: 45, color: '#7C3AED' },
                                    { label: 'E', deg: 90, color: '#7C3AED' },
                                    { label: 'SE', deg: 135, color: '#7C3AED' },
                                    { label: 'S', deg: 180, color: '#7C3AED' },
                                    { label: 'SW', deg: 225, color: '#7C3AED' },
                                    { label: 'W', deg: 270, color: '#7C3AED' },
                                    { label: 'NW', deg: 315, color: '#7C3AED' },
                                ].map((item, i) => (
                                    <View key={i} style={{
                                        position: 'absolute',
                                        height: '100%',
                                        alignItems: 'center',
                                        transform: [{ rotate: `${item.deg}deg` }]
                                    }}>
                                        <Text style={{
                                            color: item.color,
                                            fontWeight: 'bold',
                                            fontSize: item.label.length > 1 ? 10 : 14,
                                            marginTop: 20,
                                            transform: [{ rotate: `${-item.deg}deg` }]
                                        }}>
                                            {item.label}
                                        </Text>
                                    </View>
                                ))}

                                {/* Kaaba Icon Fixed on Dial */}
                                <View style={{
                                    position: 'absolute',
                                    height: '100%',
                                    alignItems: 'center',
                                    transform: [{ rotate: `${bearing}deg` }]
                                }}>
                                    <View style={{
                                        marginTop: 35, // Adjusted for smaller dial
                                        transform: [{ rotate: `${-bearing}deg` }]
                                    }}>
                                        <View style={{
                                            borderWidth: 1.5,
                                            borderColor: '#7C3AED',
                                            borderRadius: 6,
                                            padding: 3,
                                            backgroundColor: 'rgba(255,255,255,0.1)'
                                        }}>
                                            <Text style={{ fontSize: 16 }}>🕋</Text>
                                        </View>
                                    </View>
                                </View>

                            </View>
                        </View>

                        {/* Bottom Info */}
                        <View style={{ width: '100%', marginTop: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={{ fontSize: 18, marginRight: 8 }}>🕋</Text>
                                <Text style={{ color: '#7C3AED', fontSize: 14, fontWeight: 'bold' }}>
                                    {t('bearing_from_true_north', { deg: bearing.toFixed(0), defaultValue: '{{deg}}° from True North' })}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, marginRight: 8 }}>📍</Text>
                                <Text style={{ color: '#7C3AED', fontSize: 12 }}>
                                    {locationName} ({lat.toFixed(4)}, {lon.toFixed(4)})
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView >
        </SafeAreaView >
    );
}
