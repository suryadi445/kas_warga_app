declare module 'expo-clipboard' {
    /**
     * Set the clipboard string.
     * @param value text to copy
     */
    export function setStringAsync(value: string): Promise<void>;

    /**
     * Get the clipboard string.
     */
    export function getStringAsync(): Promise<string>;

    const Clipboard: {
        setStringAsync(value: string): Promise<void>;
        getStringAsync(): Promise<string>;
    };

    export default Clipboard;
}
