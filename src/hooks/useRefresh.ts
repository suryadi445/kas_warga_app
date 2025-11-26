import { useState } from 'react';

/**
 * Custom hook for pull-to-refresh functionality
 * 
 * @param refreshFn - Async function to call when refreshing (e.g., fetch data)
 * @returns Object with refreshing state and onRefresh callback
 * 
 * @example
 * ```typescript
 * const { refreshing, onRefresh } = useRefresh(async () => {
 *   await fetchPrayerTimes();
 *   await fetchHolidays();
 * });
 * 
 * <ScrollView
 *   refreshControl={
 *     <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
 *   }
 * >
 *   ...
 * </ScrollView>
 * ```
 */
export function useRefresh(refreshFn: () => Promise<void>) {
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshFn();
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    };

    return { refreshing, onRefresh };
}
