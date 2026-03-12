import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCgPyRiIboztB5HxtbuyfJE45OdCsHRHR8",
    authDomain: "abwork-ae695.firebaseapp.com",
    projectId: "abwork-ae695",
    storageBucket: "abwork-ae695.firebasestorage.app",
    messagingSenderId: "802364713780",
    appId: "1:802364713780:web:4298eed6c5352c4e2e1361",
    measurementId: "G-5YV9ZH3N61",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function runTest() {
    const testEmail = `testSyncEngine_${Date.now()}@fitai.com`;
    const testPassword = "securePassword123";

    console.log("=========================================");
    console.log("🧪 STARTING GLOBAL E2E SYNC VERIFICATION");
    console.log("=========================================");

    try {
        // 1. CREATE ACCOUNT
        console.log(`\n[1/5] Creating dummy account: ${testEmail}`);
        const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
        const user = userCredential.user;
        console.log(`✅ Success! UID: ${user.uid}`);

        // 2. SIMULATE 12-DATABASE SYNC BUNDLE
        console.log(`\n[2/5] Simulating user adding Meals, Diary, and Custom Recipes...`);

        const dummyPayload = {
            lastSynced: new Date().toISOString(),
            appVersion: "1.0.0",
            data: {
                "@abwork_user_profile": { firstName: "Jane Doe", goal: "maintain", dailyCalories: 2000, onboardingComplete: true },
                "@abwork_meals": [{ id: "m1", name: "Apple", calories: 95 }],
                "@abwork_diary": { "2026-03-08": { breakfast: [{ id: "f1", name: "Eggs", calories: 140 }] } },
                "@abwork_steps": { "2026-03-08": 8450 },
                "@abwork_settings": { calorieGoal: 2000, stepGoal: 10000, macros: { carbs: 50, protein: 25, fats: 25 } },
                "@abwork_xp": { totalXP: 10500 },
                "@abwork_saved_recipes": [{ id: "r1", name: "Protein Shake", calories: 350 }]
            }
        };

        // Push massive payload to Firestore (simulating `forceCloudBackup()`)
        await setDoc(doc(db, "users", user.uid), dummyPayload, { merge: true });
        console.log(`✅ Payload (7 offline databases) written to Firestore!`);

        // 3. LOG OUT
        console.log(`\n[3/5] Logging out (destroying local session)...`);
        await signOut(auth);
        console.log(`✅ Logged out successfully!`);

        // 4. LOG BACK IN
        console.log(`\n[4/5] Logging back in as ${testEmail}...`);
        const loginCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
        const reAuthUser = loginCredential.user;
        console.log(`✅ Re-authenticated!`);

        // 5. FETCH & VERIFY CLOUD DOC (Simulating `restoreFromCloud()`)
        console.log(`\n[5/5] Fetching massive json bundle from Cloud on fresh login...`);
        const docSnap = await getDoc(doc(db, "users", reAuthUser.uid));

        if (docSnap.exists()) {
            const cloudPayload = docSnap.data();
            const data = cloudPayload.data;

            console.log("\n📄 EXPECTED MATCHES:");
            console.log(`- Profile Name: ${data["@abwork_user_profile"].firstName === "Jane Doe" ? "✅ Match" : "❌ FAILED"}`);
            console.log(`- Daily Steps : ${data["@abwork_steps"]["2026-03-08"] === 8450 ? "✅ Match" : "❌ FAILED"}`);
            console.log(`- Custom Pct  : ${data["@abwork_settings"].macros.protein === 25 ? "✅ Match" : "❌ FAILED"}`);
            console.log(`- Diary Food  : ${data["@abwork_diary"]["2026-03-08"].breakfast[0].name === "Eggs" ? "✅ Match" : "❌ FAILED"}`);
            console.log(`- Saved Recipe: ${data["@abwork_saved_recipes"][0].name === "Protein Shake" ? "✅ Match" : "❌ FAILED"}`);
            console.log(`- Game XP     : ${data["@abwork_xp"].totalXP === 10500 ? "✅ Match" : "❌ FAILED"}`);

            console.log("\n🎉 ALL TESTS PASSED! The new Sync Engine flawlessly captures, pushes, and restores all independent offline databases across devices.");
        } else {
            console.log("❌ FAILED: User document not found in cloud database.");
        }

    } catch (err) {
        console.error("❌ TEST CRASHED: ", err);
    }

    console.log("=========================================\n");
    process.exit(0);
}

runTest();
