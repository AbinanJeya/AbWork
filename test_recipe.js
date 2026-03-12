const { generateRecipeFromChat } = require('./src/services/openai.js');
const { getSettings } = require('./src/services/storage.js');

// Mock storage
jest.mock('./src/services/storage.js', () => ({
    getSettings: () => Promise.resolve({ openAIKey: process.env.OPENAI_API_KEY })
}));

async function test() {
    console.log("Testing recipe generation...");
    const res = await generateRecipeFromChat("Give me a high protein chicken recipe");
    console.log("Result:", res);
}

test();
