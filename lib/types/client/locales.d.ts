/** `pet` namespace dictionaries for the overlay and settings section. */
/** Locale namespace registered by the browser plugin. */
export declare const NS = "pet";
/** Simplified Chinese dictionary and key-set source of truth. */
export declare const zh: {
    nav: string;
    title: string;
    intro: string;
    enabled: string;
    size: string;
    pixels: string;
    refresh: string;
    refreshing: string;
    loading: string;
    loadError: string;
    readOnly: string;
    importPrefix: string;
    importDefault: string;
    importSuffix: string;
    presetGroup: string;
    customGroup: string;
    noCustom: string;
    selected: string;
    select: string;
    selectPet: string;
    selectedPet: string;
    unavailable: string;
    unavailablePet: string;
    noDescription: string;
};
/** Keys accepted by the `pet` locale lookup. */
export type PetKey = keyof typeof zh;
/** English dictionary, complete against the Chinese key set. */
export declare const en: {
    nav: string;
    title: string;
    intro: string;
    enabled: string;
    size: string;
    pixels: string;
    refresh: string;
    refreshing: string;
    loading: string;
    loadError: string;
    readOnly: string;
    importPrefix: string;
    importDefault: string;
    importSuffix: string;
    presetGroup: string;
    customGroup: string;
    noCustom: string;
    selected: string;
    select: string;
    selectPet: string;
    selectedPet: string;
    unavailable: string;
    unavailablePet: string;
    noDescription: string;
};
/**
 * Replace one named locale placeholder.
 * @param template - localized string containing the placeholder.
 * @param name - placeholder name without braces.
 * @param value - replacement text.
 * @returns localized text with the placeholder replaced.
 */
export declare function petLocaleValue(template: string, name: 'pet' | 'size', value: string): string;
//# sourceMappingURL=locales.d.ts.map