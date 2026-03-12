/**
 * Food Database Service
 * Uses Open Food Facts (free, no API key needed) for barcode lookups and text search.
 * Future: Add FatSecret, Nutritionix, USDA FoodData Central.
 */

const OFF_BASE = 'https://world.openfoodfacts.org';

/**
 * Parse a serving string like "1 scoop (30g)" or "250 ml" or "2 cups" etc.
 * Returns { qty, unit, gramsPerUnit } so we can scale properly.
 */
function parseServing(servingStr) {
    if (!servingStr) return { qty: 100, unit: 'g', gramsPerUnit: 1, displayServing: '100g' };

    const str = servingStr.toLowerCase().trim();

    // Patterns: "1 scoop (30g)", "2 scoops (62g)", "30 g", "250ml", "1 cup (240ml)", "3 pieces (45g)"
    // Try: <number> <unit> (<number>g)
    const withParens = str.match(/^([\d.]+)\s*(scoops?|cups?|pieces?|slices?|servings?|tablets?|bars?|packets?|sachets?|tbsp|tsp|oz|fl\s*oz)\s*\(?\s*([\d.]+)\s*g\)?/i);
    if (withParens) {
        const qty = parseFloat(withParens[1]);
        const unit = normalizeUnit(withParens[2]);
        const totalGrams = parseFloat(withParens[3]);
        return {
            qty,
            unit,
            gramsPerUnit: totalGrams / qty,
            displayServing: servingStr,
        };
    }

    // Pattern: <number> <unit> (no grams in parens)
    const unitMatch = str.match(/^([\d.]+)\s*(scoops?|cups?|pieces?|slices?|servings?|tablets?|bars?|packets?|sachets?|tbsp|tsp|oz|fl\s*oz|ml|l)/i);
    if (unitMatch) {
        const qty = parseFloat(unitMatch[1]);
        const unit = normalizeUnit(unitMatch[2]);
        // Estimate grams per unit for common units
        const gramsPerUnit = estimateGrams(unit);
        return {
            qty,
            unit,
            gramsPerUnit,
            displayServing: servingStr,
        };
    }

    // Pattern: just grams like "100g" or "30 g"
    const gramsMatch = str.match(/^([\d.]+)\s*g/i);
    if (gramsMatch) {
        return {
            qty: parseFloat(gramsMatch[1]),
            unit: 'g',
            gramsPerUnit: 1,
            displayServing: servingStr,
        };
    }

    // Pattern: ml like "250ml"
    const mlMatch = str.match(/^([\d.]+)\s*ml/i);
    if (mlMatch) {
        return {
            qty: parseFloat(mlMatch[1]),
            unit: 'ml',
            gramsPerUnit: 1, // rough: 1ml ≈ 1g for most liquids
            displayServing: servingStr,
        };
    }

    // Fallback: try to extract any number
    const anyNum = str.match(/([\d.]+)/);
    return {
        qty: anyNum ? parseFloat(anyNum[1]) : 100,
        unit: 'g',
        gramsPerUnit: 1,
        displayServing: servingStr,
    };
}

function normalizeUnit(raw) {
    const u = raw.toLowerCase().trim();
    if (u.startsWith('scoop')) return 'scoop';
    if (u.startsWith('cup')) return 'cup';
    if (u.startsWith('piece')) return 'piece';
    if (u.startsWith('slice')) return 'slice';
    if (u.startsWith('serving')) return 'serving';
    if (u.startsWith('tablet')) return 'tablet';
    if (u.startsWith('bar')) return 'bar';
    if (u.startsWith('packet') || u.startsWith('sachet')) return 'packet';
    if (u === 'tbsp') return 'tbsp';
    if (u === 'tsp') return 'tsp';
    if (u === 'oz') return 'oz';
    if (u.startsWith('fl')) return 'fl oz';
    if (u === 'ml') return 'ml';
    if (u === 'l') return 'l';
    return u;
}

function estimateGrams(unit) {
    // rough estimates when no gram weight is provided
    switch (unit) {
        case 'scoop': return 30;
        case 'cup': return 240;
        case 'tbsp': return 15;
        case 'tsp': return 5;
        case 'oz': return 28;
        case 'fl oz': return 30;
        case 'piece': return 30;
        case 'slice': return 25;
        case 'serving': return 100;
        case 'tablet': return 5;
        case 'bar': return 50;
        case 'packet': return 30;
        case 'ml': return 1;
        case 'l': return 1000;
        default: return 100;
    }
}

function buildItem(p, barcodeStr) {
    const n = p.nutriments || {};
    const servingInfo = parseServing(p.serving_size || p.quantity);

    // Use per-100g data as our base (this is what OFF provides reliably)
    return {
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands || 'Generic',
        serving: p.serving_size || p.quantity || '100g',
        // Macros are per 100g
        calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
        protein: Math.round((n.proteins_100g || n.proteins || 0) * 10) / 10,
        carbs: Math.round((n.carbohydrates_100g || n.carbohydrates || 0) * 10) / 10,
        fat: Math.round((n.fat_100g || n.fat || 0) * 10) / 10,
        barcode: barcodeStr || p.code || null,
        source: 'Open Food Facts',
        image: p.image_front_small_url || null,
        // Parsed serving info for the UI
        servingQty: servingInfo.qty,
        servingUnit: servingInfo.unit,
        gramsPerUnit: servingInfo.gramsPerUnit,
    };
}

/**
 * Look up a product by barcode via Open Food Facts
 */
export async function lookupBarcode(barcode) {
    try {
        const res = await fetch(`${OFF_BASE}/api/v2/product/${barcode}.json`, {
            headers: { 'User-Agent': 'AbWork/1.0 (fitness app)' },
        });
        const data = await res.json();
        if (data.status !== 1 || !data.product) return null;
        return buildItem(data.product, barcode);
    } catch (err) {
        console.error('Barcode lookup failed:', err);
        return null;
    }
}

/**
 * Text search via Open Food Facts
 */
export async function searchFoodDatabase(query, limit = 10) {
    try {
        const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=product_name,brands,serving_size,quantity,nutriments,image_front_small_url,code`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'AbWork/1.0 (fitness app)' },
        });
        const data = await res.json();
        if (!data.products || data.products.length === 0) return [];
        return data.products
            .filter(p => p.product_name && p.nutriments)
            .map(p => buildItem(p, null));
    } catch (err) {
        console.error('Food database search failed:', err);
        return [];
    }
}
