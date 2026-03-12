import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSettings, saveSettings } from './services/storage';

export function hexToRgba(hex, alpha = 1) {
    if (!hex || hex.length !== 7) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function isColorBright(hex) {
    if (!hex || hex.length !== 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Relative visual luminance formula
    const luma = (r * 299 + g * 587 + b * 114) / 1000;
    return luma > 160;
}

/**
 * Generate full color palette from accent color + dark/light mode.
 * 
 * IMPORTANT: Backgrounds, cards, borders, text are all NEUTRAL (gray/white).
 * The accent color ONLY applies to interactive elements: buttons, toggles,
 * sliders, progress rings, active labels, links, badges.
 */
export function generateColors(accent, isDark = true) {
    // When accent is empty (none/off), use high contrast black/white
    const resolvedAccent = accent || (isDark ? '#ffffff' : '#000000');
    const accentText = isColorBright(resolvedAccent) ? '#000000' : '#ffffff';

    if (isDark) {
        // ─── Dark mode (from reference: background-dark #121212, surface-dark #1e1e1e, border-dark #2a2a2a) ───
        return {
            // Accent — only for interactive/highlight elements
            primary: resolvedAccent,
            textOnPrimary: accentText,
            primaryDim: hexToRgba(resolvedAccent, 0.10),
            primaryMid: hexToRgba(resolvedAccent, 0.20),
            primaryGlow: hexToRgba(resolvedAccent, 0.30),

            // Backgrounds — neutral dark, NO accent tint
            bg: '#121212',
            bgDark: '#121212',
            bgCard: '#1e1e1e',
            bgCardSolid: '#1e1e1e',
            surface: '#1e1e1e',
            surfaceLight: '#252525',

            // Borders — neutral
            border: '#2a2a2a',
            borderLight: '#3a3a3a',

            // Text — neutral white/gray
            text: '#f1f5f9',
            textSecondary: '#71717a',  // zinc-500
            textMuted: '#52525b',      // zinc-600
            white: '#ffffff',

            // Utility colors (consistent across modes)
            orange500: '#f97316',
            orangeBg: 'rgba(249, 115, 22, 0.1)',
            blue500: '#3b82f6',
            blueBg: 'rgba(59, 130, 246, 0.1)',
            blue400: '#60a5fa',
            yellow400: '#facc15',
            slate400: '#94a3b8',
            slate500: '#64748b',
            slate800: '#1e293b',
            slate900: '#0f172a',
            red500: '#ef4444',

            // Component-specific — neutral
            inputBg: '#121212',
            cardBg: '#1e1e1e',
            modalBg: '#121212',
            tabBarBg: 'rgba(18, 18, 18, 0.95)',
            headerBg: 'rgba(18, 18, 18, 0.90)',
        };
    } else {
        // ─── Light mode (from reference: background #F8F9FA, card #FFFFFF, borders slate-100) ───
        return {
            // Accent — only for interactive/highlight elements
            primary: resolvedAccent,
            textOnPrimary: accentText,
            primaryDim: hexToRgba(resolvedAccent, 0.10),
            primaryMid: hexToRgba(resolvedAccent, 0.15),
            primaryGlow: hexToRgba(resolvedAccent, 0.25),

            // Backgrounds — neutral white/light gray
            bg: '#F8F9FA',
            bgDark: '#F8F9FA',
            bgCard: '#FFFFFF',
            bgCardSolid: '#FFFFFF',
            surface: '#f1f5f9',
            surfaceLight: '#e2e8f0',

            // Borders — neutral
            border: '#e2e8f0',
            borderLight: '#cbd5e1',

            // Text — neutral dark
            text: '#1A1C1E',
            textSecondary: '#64748b',  // slate-500
            textMuted: '#94a3b8',      // slate-400
            white: '#ffffff',

            // Utility colors
            orange500: '#f97316',
            orangeBg: 'rgba(249, 115, 22, 0.06)',
            blue500: '#3b82f6',
            blueBg: 'rgba(59, 130, 246, 0.06)',
            blue400: '#60a5fa',
            yellow400: '#facc15',
            slate400: '#94a3b8',
            slate500: '#64748b',
            slate800: '#1e293b',
            slate900: '#0f172a',
            red500: '#ef4444',

            // Component-specific — neutral
            inputBg: '#f1f5f9',
            cardBg: '#FFFFFF',
            modalBg: '#F8F9FA',
            tabBarBg: 'rgba(255, 255, 255, 0.95)',
            headerBg: 'rgba(248, 249, 250, 0.90)',
        };
    }
}

export function hexToHsv(hex) {
    if (!hex || hex.length !== 7) return { h: 142, s: 0.85, v: 0.96 }; // default #25f46a
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s, v: v };
}

export function hsvToHex(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Applies the mathematical mode-specific brightness constraints to a given hex string, producing what the actual UI will render
export function getProjectedHex(hex, dark) {
    if (!hex) return hex;
    const hsv = hexToHsv(hex);
    const minVal = dark ? 0.6 : 0.2;
    const maxVal = dark ? 1.0 : 0.6;

    // Treat the incoming V as the theoretical percentage
    const relativeV = Math.max(0, Math.min(1.0, hsv.v));
    const projectedV = minVal + (relativeV * (maxVal - minVal));

    return hsvToHex(hsv.h, hsv.s, projectedV);
}

// Default palette
export const COLORS = generateColors('#25f46a', true);

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(true);
    // SINGLE memory location for the user's unified brand hue/sat/val percentage
    // IMPORTANT: `v` here is stored as a RELATIVE percentage (0.0 to 1.0) of whatever the current mode's slider is, 
    // rather than the absolute constrained float, so it can cross-interpolate perfectly.
    const [baseHSV, setBaseHSV] = useState({ h: 142, s: 0.85, v: 1.0 });

    // Calculates what the safe brightness is for the ACTIVE mode by mapping the relative 0-1 percentage
    // across the available bracket for that mode.
    const getClampedHex = (hsv, dark) => {
        const minVal = dark ? 0.6 : 0.2;
        const maxVal = dark ? 1.0 : 0.6;

        // hsv.v represents the 0-1 percentage of the slider (e.g. 100% brightness).
        // We project that percentage onto the available bounded range:
        const relativeV = Math.max(0, Math.min(1.0, hsv.v));
        const projectedV = minVal + (relativeV * (maxVal - minVal));

        return hsvToHex(hsv.h, hsv.s, projectedV);
    };

    const activeAccent = getClampedHex(baseHSV, isDark);
    const [colors, setColorsState] = useState(COLORS);

    useEffect(() => {
        async function load() {
            const s = await getSettings();
            const dark = s.isDark !== undefined ? s.isDark : true;

            // Migrate legacy keys if necessary, or load saved raw HSV if available
            let loadedHSV = s.baseHSV;
            if (!loadedHSV) {
                const legacyHex = s.accent || s.darkAccent || s.lightAccent || '#25f46a';
                loadedHSV = hexToHsv(legacyHex);
            }

            setIsDark(dark);
            setBaseHSV(loadedHSV);

            const activeHex = getClampedHex(loadedHSV, dark);
            setColorsState(generateColors(activeHex, dark));
        }
        load();
    }, []);

    // Accepts raw HSV maps directly from Color Wheel, bypassing lossless hex conversion until project time
    const setAccentHSV = async (hsv) => {
        setBaseHSV(hsv);
        const activeHex = getClampedHex(hsv, isDark);
        setColorsState(generateColors(activeHex, isDark));
        await saveSettings({ baseHSV: hsv, accent: null, lightAccent: null, darkAccent: null }); // Clear out old legacy keys
    };

    // Generic setAccent hex wrapper for Swatch preset buttons
    const setAccent = async (hexColor) => {
        if (!hexColor) {
            // Null state / Monochrome
            await setAccentHSV({ h: 0, s: 0, v: isDark ? 1 : 0 });
            return;
        }
        const parsedHSV = hexToHsv(hexColor);
        await setAccentHSV(parsedHSV);
    };

    const toggleDarkMode = async () => {
        const newDark = !isDark;
        setIsDark(newDark);
        // Recalculate the active hex purely based on the new mode's bounds against the unified Base memory
        const activeHex = getClampedHex(baseHSV, newDark);
        setColorsState(generateColors(activeHex, newDark));
        await saveSettings({ isDark: newDark });
    };

    const setDarkMode = async (dark) => {
        setIsDark(dark);
        const activeHex = getClampedHex(baseHSV, dark);
        setColorsState(generateColors(activeHex, dark));
        await saveSettings({ isDark: dark });
    };

    // Legacy compat
    const updateTheme = async (primary, _secondary) => {
        await setAccent(primary);
    };

    return (
        <ThemeContext.Provider value={{
            colors,
            isDark,
            accent: activeAccent,     // Dynamically points to the cross-interpolated safe active accent!
            baseHSV,
            setAccentHSV,
            setAccent,
            toggleDarkMode,
            setDarkMode,
            updateTheme,
            themeHex: { primary: activeAccent, secondary: activeAccent },
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        return {
            colors: COLORS,
            isDark: true,
            accent: '#25f46a',
            baseHSV: { h: 142, s: 0.85, v: 0.96 },
            setAccentHSV: () => { },
            setAccent: () => { },
            toggleDarkMode: () => { },
            setDarkMode: () => { },
            updateTheme: () => { },
            themeHex: { primary: '#25f46a', secondary: '#25f46a' },
        };
    }
    return context;
}

export const FONTS = {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
};

export const SPACING = {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const RADIUS = {
    sm: 4, md: 8, lg: 12, xl: 16, xxl: 24, full: 9999,
};
