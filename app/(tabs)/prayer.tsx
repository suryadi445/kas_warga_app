import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    const now = new Date();
    const [tab, setTab] = useState<'schedule' | 'qibla'>('schedule');
    const [lat, setLat] = useState<number>(-6.2);
    const [lon, setLon] = useState<number>(106.816666);
    const [dateStr, setDateStr] = useState<string>(now.toISOString().split('T')[0]);
    const [hijriDate, setHijriDate] = useState<string>('');
    const [times, setTimes] = useState<Record<string, string> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [holidays, setHolidays] = useState<string[]>([]);
    const holidaysFetched = useRef(false);

    useEffect(() => { fetchTimes(); }, [dateStr, lat, lon]);
    async function fetchTimes() {
        setLoading(true); setError(null); setTimes(null);
        try {
            const timestamp = Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 1000);
            const url = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lon}&method=2`;
            const res = await fetch(url);
            const json = await res.json();
            if (json?.code === 200 && json?.data?.timings) {
                setTimes(json.data.timings);
                const hij = json.data?.date?.hijri;
                if (hij) {
                    const month = hij.month?.en ?? hij.month?.ar ?? '';
                    setHijriDate(`${hij.day} ${month} ${hij.year}`);
                } else setHijriDate('');
            } else { setError('Failed to get prayer times'); setHijriDate(''); }
        } catch { setError('Network error'); setHijriDate(''); }
        finally { setLoading(false); }
    }

    useEffect(() => {
        if (holidaysFetched.current) return;
        holidaysFetched.current = true;
        fetch('https://api-harilibur.vercel.app/api')
            .then(res => res.json())
            .then(data => {
                // Filter hanya libur nasional
                const dates = data.filter((x: any) => x.is_national_holiday).map((x: any) => x.holiday_date);
                setHolidays(dates);
            })
            .catch(() => { });
    }, []);

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
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <TouchableOpacity onPress={() => {
                        const prevMonth = month - 1 < 1 ? 12 : month - 1;
                        const prevYear = month - 1 < 1 ? year - 1 : year;
                        setDateStr(localIsoDate(prevYear, prevMonth, 1));
                    }}>
                        <Text style={{ color: '#06B6D4' }}>◀</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: '700' }}>{monthNames[month - 1]} {year}</Text>
                    <Text style={{ fontWeight: '700', marginHorizontal: 12 }}>
                        {hijriMonthName} {hijriYear}
                    </Text>
                    <TouchableOpacity onPress={() => {
                        const nextMonth = month + 1 > 12 ? 1 : month + 1;
                        const nextYear = month + 1 > 12 ? year + 1 : year;
                        setDateStr(localIsoDate(nextYear, nextMonth, 1));
                    }}>
                        <Text style={{ color: '#06B6D4' }}>▶</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 2 }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                        <View key={w} style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#6B7280' }}>{w}</Text>
                        </View>
                    ))}
                </View>
                {grow.map((row, ri) => (
                    <View key={ri} style={{ flexDirection: 'row', marginTop: 4 }}>
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
                            let borderColor = '#6366f1';
                            let textColor = '#111827';
                            let hijriColor = '#6366f1';
                            let fontWeight: 'normal' | 'bold' | undefined = 'normal';
                            if (isSelected) {
                                bgColor = '#6366f1';
                                textColor = '#fff';
                                hijriColor = '#fff';
                                borderColor = '#6366f1';
                                fontWeight = 'bold';
                            } else if (isHoliday) {
                                bgColor = '#fecaca'; // merah muda terang
                                textColor = '#b91c1c'; // merah tua
                                hijriColor = '#b91c1c';
                                borderColor = '#fecaca';
                                fontWeight = 'bold';
                            }

                            return (
                                <TouchableOpacity key={ci} onPress={() => setDateStr(c.iso)} style={{ flex: 1, alignItems: 'center' }}>
                                    <View style={{
                                        width: 40, height: 40, borderRadius: 20,
                                        alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: bgColor,
                                        borderWidth: isSelected ? 2 : isHoliday ? 1 : 0,
                                        borderColor: borderColor
                                    }}>
                                        <Text style={{
                                            color: textColor,
                                            fontSize: 16,
                                            fontWeight: fontWeight
                                        }}>
                                            {c.day}
                                            <Text style={{
                                                fontSize: 10,
                                                color: hijriColor,
                                                position: 'absolute',
                                                top: 2,
                                                right: 2
                                            }}>
                                                {' '}<Text style={{ fontSize: 10, color: hijriColor }}>{displayHijriDay}</Text>
                                            </Text>
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
                {/* List nama hari libur di bulan ini */}
                {holidaysInMonth.length > 0 && (
                    <View style={{ marginTop: 6, alignItems: 'center' }}>
                        <Text style={{ color: '#ef4444', fontWeight: '700', marginBottom: 2 }}>Hari Libur Nasional:</Text>
                        {holidaysInMonth.map(date => (
                            <Text key={date} style={{ color: '#ef4444', fontSize: 13 }}>
                                {date} - {holidaysInfo[date] || ''}
                            </Text>
                        ))}
                    </View>
                )}
            </View>
        );
    }

    // --- Qibla ---
    const bearing = computeBearing(lat, lon, KAABA.lat, KAABA.lon);
    const distanceKm = haversineDistanceKm(lat, lon, KAABA.lat, KAABA.lon);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>🕌</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Jadwal Sholat & Kalender</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Lihat jadwal sholat, arah kiblat, dan kalender hijriah serta libur nasional Indonesia.
                </Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                    <TouchableOpacity onPress={() => setTab('schedule')} style={{ flex: 1, padding: 10, backgroundColor: tab === 'schedule' ? '#6366f1' : '#F3F4F6', borderRadius: 8, marginRight: 8 }}>
                        <Text style={{ color: tab === 'schedule' ? '#fff' : '#111827', fontWeight: '700', textAlign: 'center' }}>Schedule</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTab('qibla')} style={{ flex: 1, padding: 10, backgroundColor: tab === 'qibla' ? '#6366f1' : '#F3F4F6', borderRadius: 8 }}>
                        <Text style={{ color: tab === 'qibla' ? '#fff' : '#111827', fontWeight: '700', textAlign: 'center' }}>Qibla</Text>
                    </TouchableOpacity>
                </View>
                {/* Jadwal sholat section di atas */}
                <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 4 }}>Prayer Times</Text>
                    {loading && <ActivityIndicator size="small" color="#6366f1" />}
                    {error && <Text style={{ color: '#EF4444' }}>{error}</Text>}
                    {times && (
                        <View style={{ marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12 }}>
                            {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((k) => (
                                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                                    <Text style={{ color: '#374151', fontWeight: '600' }}>{k}</Text>
                                    <Text style={{ color: '#111827', fontWeight: '700' }}>{times[k]}</Text>
                                </View>
                            ))}
                            <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 12 }}>Note: times from Aladhan API</Text>
                        </View>
                    )}
                </View>

                {tab === 'schedule' ? (
                    <View>
                        {/* Input location dihapus, hanya tampil jadwal dan kalender */}
                        <Text style={{ fontWeight: '700', marginBottom: 4 }}>Calendar</Text>
                        {renderUnifiedCalendar()}
                        <View style={{ height: 12 }} />
                    </View>
                ) : (
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Your location</Text>
                        <Text style={{ fontWeight: '700', color: '#111827' }}>{lat.toFixed(6)}, {lon.toFixed(6)}</Text>
                        <View style={{ marginTop: 16, width: 220, height: 220, borderRadius: 110, borderWidth: 4, borderColor: '#10B981', alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: '#fff' }}>
                            {/* Ka'bah icon at top */}
                            <View style={{ position: 'absolute', top: 8 }}>
                                <Text style={{ fontSize: 24 }}>🕋</Text>
                            </View>
                            {/* Pointer */}
                            <View style={{ position: 'absolute', transform: [{ rotate: `${bearing}deg` }], alignItems: 'center' }}>
                                <View style={{ width: 2, height: 64, marginBottom: 6, alignItems: 'center' }}>
                                    <View style={{ flex: 1, width: 2, borderLeftWidth: 2, borderLeftColor: '#FCA5A5', borderStyle: 'dashed', opacity: 0.95 }} />
                                </View>
                                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                    <View style={{ position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(239,68,68,0.12)' }} />
                                    <View style={{ width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderBottomWidth: 36, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#ef4444', transform: [{ translateY: -6 }] }} />
                                    <View style={{ width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 22, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#fb7185', position: 'absolute', top: 6 }} />
                                    <View style={{ marginTop: 44, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', borderWidth: 3, borderColor: '#ef4444' }} />
                                </View>
                            </View>
                        </View>
                        <Text style={{ marginTop: 12, fontWeight: '700' }}>{bearing.toFixed(1)}° (absolute)</Text>
                        <Text style={{ color: '#6B7280', marginTop: 4 }}>{distanceKm.toFixed(1)} km to Kaaba</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
