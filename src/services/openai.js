import { getSettings } from './storage';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

async function callOpenAI(messages, maxTokens = 300, requireJson = false) {
    const settings = await getSettings();
    if (!settings.openAIKey) {
        return null;
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.openAIKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                max_tokens: maxTokens,
                temperature: 0.7,
                ...(requireJson ? { response_format: { type: 'json_object' } } : {}),
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('OpenAI error:', errText);
            return null;
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
        console.error('OpenAI fetch error:', err);
        return null;
    }
}

// Export the search food database function (single result - legacy)
export async function searchFoodDatabase(query, apiKey) {
    if (!apiKey) {
        return {
            name: query.charAt(0).toUpperCase() + query.slice(1),
            calories: '250', protein: '10', carbs: '30', fat: '10', serving: '1 serving',
        };
    }

    const systemPrompt = `You are a nutrition database. The user will give you a food item or meal description.
Return ONLY a valid JSON object with string values:
{ "name": "Food Name", "calories": "250", "protein": "10", "carbs": "30", "fat": "10", "serving": "100g" }
Do not include code blocks or any other text.`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }],
                temperature: 0.1, max_tokens: 150,
            }),
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const content = data.choices[0].message.content.trim();
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(cleaned);
    } catch (err) {
        console.error('OpenAI food search error:', err);
        return null;
    }
}

// Multi-result search for the new food diary UI
export async function searchFoodMultiple(query, apiKey) {
    if (!apiKey) {
        // Fallback mock results
        return [
            { name: query, serving: '1 serving', calories: 200, protein: 15, carbs: 20, fat: 8 },
            { name: `${query} (large)`, serving: '1.5 servings', calories: 300, protein: 22, carbs: 30, fat: 12 },
        ];
    }

    const systemPrompt = `You are a comprehensive nutrition database that knows branded grocery and restaurant products.
The user searches for a food. Return ONLY a valid JSON array of 5-7 food items matching the query.
IMPORTANT: Include brand-name products from popular stores (Costco/Kirkland Signature, Walmart/Great Value, Tyson, Perdue, Foster Farms, Trader Joe's, etc.) when relevant.
- If the user searches a generic food like "chicken breast", return a mix of popular branded versions AND generic.
- If the user includes a brand name like "kirkland chicken breast", prioritize that brand's products.
Each object must have: "name" (string - the food item name), "brand" (string - the brand or store name, use "Generic" if unbranded), "serving" (string like "100g" or "1 breast (170g)"), "calories" (number), "protein" (number), "carbs" (number), "fat" (number).
Return realistic nutrition data based on actual product labels. Do not include code blocks or any other text.`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }],
                temperature: 0.3, max_tokens: 500,
            }),
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const content = data.choices[0].message.content.trim();
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (err) {
        console.error('OpenAI multi search error:', err);
        return [];
    }
}

export async function getNutritionSuggestion(intake, goals) {
    const messages = [
        {
            role: 'system',
            content:
                'You are a concise nutrition assistant. Give brief, practical meal or snack suggestions in 2-3 sentences. Include estimated calories and macros. Be encouraging.',
        },
        {
            role: 'user',
            content: `My daily goal is ${goals.calorieGoal} kcal. Today I've eaten ${intake.calories} kcal (Protein: ${intake.protein}g, Carbs: ${intake.carbs}g, Fat: ${intake.fat}g). I have ${goals.calorieGoal - intake.calories} kcal remaining. Suggest a healthy snack or meal that fits my remaining budget.`,
        },
    ];

    const result = await callOpenAI(messages);
    return (
        result ||
        `You have ${goals.calorieGoal - intake.calories} kcal remaining. Try a protein-rich snack like Greek yogurt with nuts (~180 kcal, 15g protein).`
    );
}

export async function getCoachMessage(workoutHistory, steps, goals) {
    const completedCount = workoutHistory.filter((w) => w.completed).length;
    const totalWorkouts = workoutHistory.length;

    const messages = [
        {
            role: 'system',
            content:
                'You are an energetic, motivating fitness coach. Give a brief motivational message in 1-2 sentences. Reference the user\'s progress data. Be specific and encouraging.',
        },
        {
            role: 'user',
            content: `Today I've done ${steps} steps out of my ${goals.stepGoal} goal. I've completed ${completedCount} out of ${totalWorkouts} scheduled workouts today. Give me a quick motivational message.`,
        },
    ];

    const result = await callOpenAI(messages);
    return (
        result ||
        `You're at ${steps.toLocaleString()} steps — ${steps >= goals.stepGoal ? 'goal smashed!' : 'keep pushing!'} Your recovery is improving every day!`
    );
}

export async function askNutritionQuestion(question, context, history = []) {
    const messages = [
        {
            role: 'system',
            content: `You are a helpful nutrition and fitness AI assistant. Answer questions briefly (2-3 sentences). Here's the user's current context: ${JSON.stringify(context)}`,
        },
        // Include last 20 messages for conversation memory
        ...history.slice(-20).map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text,
        })),
        {
            role: 'user',
            content: question,
        },
    ];

    const result = await callOpenAI(messages, 400);
    return result || "I can't connect to AI right now. Please check your API key in Settings!";
}

export async function generateMeal(prompt) {
    const messages = [
        {
            role: 'system',
            content: `You are a meal planner. Given a description of a meal, return a JSON object with:
- name: string (meal name)
- ingredients: array of objects with { name: string, amount: string, calories: number, protein: number, carbs: number, fat: number }
- calories, protein, carbs, fat: totals (numbers, sum of all ingredients)
Only return valid JSON, no extra text or markdown.`,
        },
        { role: 'user', content: prompt },
    ];

    const result = await callOpenAI(messages, 1500, true);
    if (result) {
        try {
            const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            console.warn('Failed to parse meal JSON');
        }
    }

    // Fallback
    return null;
}

export async function addIngredientToMeal(currentMeal, newIngredientPrompt) {
    const messages = [
        {
            role: 'system',
            content: `You have an existing meal. The user wants to add ingredient(s). Return the FULL updated meal as JSON with the same structure:
- name: string
- ingredients: array of { name, amount, calories, protein, carbs, fat }
- calories, protein, carbs, fat: updated totals
Keep all existing ingredients and add the new one(s). Only return valid JSON.`,
        },
        {
            role: 'user',
            content: `Current meal: ${JSON.stringify(currentMeal)}\n\nAdd: ${newIngredientPrompt}`,
        },
    ];

    const result = await callOpenAI(messages, 1500, true);
    if (result) {
        try {
            const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            console.warn('Failed to parse updated meal JSON');
        }
    }
    return null;
}


export async function generateRecipeFromChat(prompt) {
    const messages = [
        {
            role: 'system',
            content: 'You are a recipe creator. You MUST output ONLY a valid RAW JSON object. DO NOT include markdown formatting, backticks, or conversational text. The JSON object MUST map to this exact structure: { "name": "String", "calories": Number, "protein": Number, "carbs": Number, "fat": Number, "prepTime": "String (e.g., 15 mins)", "tag": "String (e.g., HIGH PROTEIN)", "ingredients": ["Array of Strings"], "steps": ["Array of Strings"] }',
        },
        { role: 'user', content: prompt },
    ];

    const result = await callOpenAI(messages, 2000, true);
    if (result) {
        try {
            // Aggressive JSON extraction
            let cleaned = result.trim();
            const jsonStart = cleaned.indexOf('{');
            const jsonEnd = cleaned.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1) {
                cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
            }

            const parsed = JSON.parse(cleaned);
            if (parsed && parsed.name && Array.isArray(parsed.ingredients) && Array.isArray(parsed.steps)) {
                return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse recipe JSON:', e.message);
        }
    }
    return null;
}

export async function getAISnackSuggestions(intake, goals) {
    const remaining = goals.calorieGoal - intake.calories;
    const messages = [
        {
            role: 'system',
            content:
                'You are a nutrition expert. Return exactly 2 snack suggestions as a JSON array. Each object has: name (string), calories (number), protein (number), carbs (number), fat (number), prepTime (string like "5 mins"), tag (one of "HIGH PROTEIN", "FIBER RICH", "LOW CARB", "ENERGY BOOST"). Only return valid JSON, no extra text.',
        },
        {
            role: 'user',
            content: `I have ${remaining} kcal remaining. Current intake: Protein ${intake.protein}g, Carbs ${intake.carbs}g, Fat ${intake.fat}g. Suggest 2 healthy snacks that fit my budget.`,
        },
    ];

    const result = await callOpenAI(messages);
    if (result) {
        try {
            const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            console.warn('Failed to parse AI snack suggestions');
        }
    }

    // Fallback suggestions
    return [
        { name: 'Greek Yogurt & Berries', calories: 150, protein: 12, carbs: 18, fat: 3, prepTime: '5 mins', tag: 'HIGH PROTEIN' },
        { name: 'Almond Butter Toast', calories: 210, protein: 7, carbs: 22, fat: 12, prepTime: '3 mins', tag: 'FIBER RICH' },
    ];
}

const FALLBACK_RECIPES = [
    {
        name: 'Grilled Chicken Salad', prepTime: '10 mins', tag: 'HIGH PROTEIN', calories: 350, protein: 35, carbs: 15, fat: 18,
        ingredients: ['150g chicken breast', '2 cups mixed greens', '1/2 avocado', '1 tbsp olive oil', 'Lemon juice'],
        steps: ['Season and grill chicken 6-7 min per side', 'Chop and arrange greens', 'Slice avocado on top', 'Drizzle with olive oil and lemon']
    },
    {
        name: 'Turkey & Egg White Wrap', prepTime: '7 mins', tag: 'HIGH PROTEIN', calories: 310, protein: 38, carbs: 22, fat: 8,
        ingredients: ['120g turkey breast slices', '3 egg whites', '1 whole wheat wrap', 'Spinach', 'Mustard'],
        steps: ['Scramble egg whites in non-stick pan', 'Warm wrap for 30 seconds', 'Layer turkey, egg whites, and spinach', 'Add mustard and roll tightly']
    },
    {
        name: 'Cottage Cheese Power Bowl', prepTime: '3 mins', tag: 'HIGH PROTEIN', calories: 280, protein: 30, carbs: 20, fat: 10,
        ingredients: ['1 cup cottage cheese', '1/2 cup pineapple chunks', '2 tbsp granola', '1 tbsp honey', 'Cinnamon'],
        steps: ['Scoop cottage cheese into bowl', 'Top with pineapple and granola', 'Drizzle honey and sprinkle cinnamon']
    },
    {
        name: 'Protein Overnight Oats', prepTime: '5 mins', tag: 'NO-COOK', calories: 380, protein: 28, carbs: 45, fat: 10,
        ingredients: ['1/2 cup oats', '1 scoop protein powder', '3/4 cup milk', '1 tbsp chia seeds', '1/2 cup berries'],
        steps: ['Mix oats, protein powder, and chia seeds', 'Pour in milk and stir well', 'Top with berries', 'Refrigerate overnight or 4+ hours']
    },
    {
        name: 'Greek Yogurt Parfait', prepTime: '3 mins', tag: 'NO-COOK', calories: 260, protein: 22, carbs: 30, fat: 7,
        ingredients: ['200g Greek yogurt', '1/4 cup granola', '1/2 cup mixed berries', '1 tbsp honey'],
        steps: ['Layer yogurt in a glass', 'Add granola layer', 'Top with berries', 'Drizzle honey']
    },
    {
        name: 'Tuna Avocado Lettuce Cups', prepTime: '5 mins', tag: 'NO-COOK', calories: 290, protein: 32, carbs: 8, fat: 15,
        ingredients: ['1 can tuna in water', '1/2 avocado mashed', '4 butter lettuce leaves', 'Lemon juice', 'Salt & pepper'],
        steps: ['Drain tuna and mix with mashed avocado', 'Season with lemon, salt, and pepper', 'Spoon into lettuce cups', 'Serve immediately']
    },
    {
        name: 'Tuna Rice Bowl', prepTime: '8 mins', tag: 'UNDER 10 MIN', calories: 420, protein: 38, carbs: 48, fat: 8,
        ingredients: ['1 can tuna in water', '1 cup cooked rice', '1 tbsp soy sauce', '1/2 cucumber diced', 'Sesame seeds'],
        steps: ['Drain tuna and flake into bowl', 'Add warm rice', 'Dice cucumber and add on top', 'Drizzle soy sauce, sprinkle sesame seeds']
    },
    {
        name: 'Egg & Veggie Scramble', prepTime: '6 mins', tag: 'UNDER 10 MIN', calories: 280, protein: 22, carbs: 10, fat: 18,
        ingredients: ['3 eggs', '1/2 cup diced bell peppers', '1/4 cup onion diced', '1 handful spinach', 'Salt & pepper'],
        steps: ['Heat pan with cooking spray', 'Sauté peppers and onion 2 mins', 'Add beaten eggs and spinach', 'Scramble until set, season']
    },
    {
        name: 'Quick Chicken Quesadilla', prepTime: '8 mins', tag: 'UNDER 10 MIN', calories: 380, protein: 32, carbs: 28, fat: 16,
        ingredients: ['100g shredded chicken', '1 tortilla', '30g shredded cheese', '2 tbsp salsa', 'Cooking spray'],
        steps: ['Spray pan and place tortilla', 'Add chicken, cheese on half', 'Fold and cook 3 min per side', 'Slice and serve with salsa']
    },
    {
        name: 'Post-Workout Protein Smoothie', prepTime: '4 mins', tag: 'POST-WORKOUT', calories: 340, protein: 35, carbs: 40, fat: 5,
        ingredients: ['1 scoop whey protein', '1 banana', '1 cup milk', '1 tbsp peanut butter', 'Ice cubes'],
        steps: ['Add all ingredients to blender', 'Blend until smooth (30 sec)', 'Pour and drink within 30 min of workout']
    },
    {
        name: 'Chicken Sweet Potato Plate', prepTime: '10 mins', tag: 'POST-WORKOUT', calories: 450, protein: 40, carbs: 50, fat: 8,
        ingredients: ['150g chicken breast', '1 medium sweet potato', '1 cup broccoli', '1 tsp olive oil', 'Salt & garlic powder'],
        steps: ['Microwave sweet potato 5 min', 'Season and grill chicken 6 min per side', 'Steam broccoli 3 min', 'Plate together, drizzle olive oil']
    },
    {
        name: 'Rice Cake PB & Banana Stack', prepTime: '2 mins', tag: 'POST-WORKOUT', calories: 260, protein: 10, carbs: 38, fat: 10,
        ingredients: ['2 rice cakes', '2 tbsp peanut butter', '1 banana sliced', 'Drizzle of honey'],
        steps: ['Spread peanut butter on rice cakes', 'Layer banana slices on top', 'Drizzle with honey']
    },
];

export async function getSmartRecipes(remaining, filter = 'All') {
    // Return filtered fallback instantly — much faster than AI
    const tagMap = {
        'High Protein': 'HIGH PROTEIN',
        'No-Cook': 'NO-COOK',
        'Under 10 Min': 'UNDER 10 MIN',
        'Post-Workout': 'POST-WORKOUT',
    };

    const mapped = tagMap[filter];
    const filtered = mapped
        ? FALLBACK_RECIPES.filter(r => r.tag === mapped)
        : FALLBACK_RECIPES.slice(0, 3); // "All" shows first 3

    // Try AI in background for better results, but return fallback fast
    const settings = await getSettings();
    if (!settings.openAIKey) return filtered;

    const filterHint = filter === 'All' ? '' : ` Focus on "${filter}" recipes.`;
    const messages = [
        {
            role: 'system',
            content: `You are a nutrition expert and recipe creator. Return exactly 3 recipes as a JSON array. Each object must have: name (string), prepTime (string like "8 mins"), tag (one of "HIGH PROTEIN", "NO-COOK", "UNDER 10 MIN", "POST-WORKOUT", "LOW CARB"), calories (number), protein (number), carbs (number), fat (number), ingredients (array of strings like "200g chicken breast"), steps (array of short instruction strings). Target recipes that fit within the remaining calorie budget. Only return valid JSON, no extra text.`,
        },
        {
            role: 'user',
            content: `I have ${remaining.calories} kcal remaining (need ${remaining.protein}g more protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat).${filterHint} Suggest 3 recipes.`,
        },
    ];

    const result = await callOpenAI(messages, 1000);
    if (result) {
        try {
            const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            console.warn('Failed to parse AI recipe suggestions');
        }
    }

    return filtered;
}

export async function getMacroSolverSuggestion(remaining) {
    const messages = [
        {
            role: 'system',
            content: 'You are a concise nutrition advisor. Suggest ONE specific food/snack that best fills the remaining macro gap. Reply in 1-2 sentences with the food name, approximate calories, and key macros. Be practical — suggest common foods someone can easily make or buy.',
        },
        {
            role: 'user',
            content: `I still need: ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat (${remaining.calories} kcal). What single food best fills this gap?`,
        },
    ];

    const result = await callOpenAI(messages);
    return result || `Try a protein shake with banana — roughly ${Math.min(remaining.calories, 300)} kcal, 25g protein, 30g carbs.`;
}
