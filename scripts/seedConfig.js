import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCVOruNPmhISdKhkSIk-ql37Ea0Kj4NGzQ",
  authDomain: "ai-tryouts-cyntexa.firebaseapp.com",
  projectId: "ai-tryouts-cyntexa",
  storageBucket: "ai-tryouts-cyntexa.firebasestorage.app",
  messagingSenderId: "1086519146668",
  appId: "1:1086519146668:web:7e17d86707745ce38a4709",
  measurementId: "G-QG0N76NJGM",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const CONFIG_COLLECTION = "chargeon_config";
const DOC_PROD = "game_content";
const DOC_STAGING = "staging_game_content";
const DOC_DEFAULT = "default_game_content";

async function runSeed() {
  console.log(`\n==============================================`);
  console.log(`ChargeOn Remote Config Manager`);
  console.log(`Collection: ${CONFIG_COLLECTION}`);
  console.log(`==============================================\n`);

  // 1. Fetch current production game_content
  const prodRef = doc(db, CONFIG_COLLECTION, DOC_PROD);
  const prodSnap = await getDoc(prodRef);

  let baseData;
  if (prodSnap.exists()) {
    console.log(`[OK] Found existing production document: ${DOC_PROD}`);
    baseData = prodSnap.data();
  } else {
    console.log(`[INFO] Production document not found, generating base content...`);
    baseData = {
      levels: {
        1: {
          id: 1,
          goodie: "Energy Bar",
          goodieImage: "/img/energy-bar-img.png",
          discount: "5%",
          discountImage: "/img/PercentOff-img.png",
          speedMultiplier: 1.0,
          targetDurationSeconds: 60,
          requiredCount: 22,
          maxPatternDifficulty: 1,
          obstacleDensity: 0.35,
          speedRampMultiplier: 1.08,
        },
        2: {
          id: 2,
          goodie: "Fridge Magnet",
          goodieImage: "/img/badges-img.png",
          discount: "10%",
          discountImage: "/img/PercentOff-img.png",
          speedMultiplier: 1.2,
          targetDurationSeconds: 60,
          requiredCount: 22,
          maxPatternDifficulty: 2,
          obstacleDensity: 0.5,
          speedRampMultiplier: 1.12,
        },
        3: {
          id: 3,
          goodie: "Premium Tote Bag",
          goodieImage: "/img/tote-bag-img.png",
          discount: "15%",
          discountImage: "/img/PercentOff-img.png",
          speedMultiplier: 1.4,
          targetDurationSeconds: 72,
          requiredCount: 10,
          maxPatternDifficulty: 4,
          obstacleDensity: 0.65,
          speedRampMultiplier: 1.15,
        },
      },
      campaignPromo: {
        levelCompleteRunningBox: {
          title: "STILL IN THE RUNNING!",
          desc: "Post your run on LinkedIn, tag Cyntexa, use #ChargeOn and attach your booth selfie.",
          highlight: "Highest engagement wins an exclusive gift!",
        },
        gameOverEligibilityBox: {
          title: "YOU ARE STILL ELIGIBLE FOR THE EXCLUSIVE GIFT: AIRPODS PRO",
          desc: "Post your run on LinkedIn, tag Cyntexa, use #ChargeOn and attach your booth selfie.",
          highlight: "Highest engagement wins an exclusive gift!",
          image: "/img/run-failed-airpod-img.png",
        },
        offerReveal: {
          title: "YOU'VE UNLOCKED SOMETHING BIG",
          instructionsHeader: "To earn this:",
          tasks: [
            { text: "Post your run on LinkedIn", isLinkedIn: true },
            { text: "Attach your booth selfie", highlight: "" },
            { text: "Tag", highlight: "Cyntexa, use #ChargeOn" },
          ],
          highlightBox: "Highest engagement post wins an exclusive AirPods Pro",
          buttonText: "SEE MY RESULTS",
          image: "/img/airpods.png",
        },
      },
      updatedAt: new Date().toISOString(),
    };
    await setDoc(prodRef, baseData);
    console.log(`[CREATED] Created production document: ${DOC_PROD}`);
  }

  // 2. Check / Seed default_game_content (Immutable pristine reference)
  const defaultRef = doc(db, CONFIG_COLLECTION, DOC_DEFAULT);
  const defaultSnap = await getDoc(defaultRef);
  if (!defaultSnap.exists()) {
    const defaultData = {
      ...baseData,
      _description: "Factory default game content backup. Do not edit directly; used to restore production.",
      updatedAt: new Date().toISOString(),
    };
    await setDoc(defaultRef, defaultData);
    console.log(`[CREATED] Created permanent backup document: ${DOC_DEFAULT}`);
  } else {
    console.log(`[EXISTS] Default backup document already exists: ${DOC_DEFAULT}`);
  }

  // 3. Check / Seed staging_game_content (Sandbox for local testing)
  const stagingRef = doc(db, CONFIG_COLLECTION, DOC_STAGING);
  const stagingSnap = await getDoc(stagingRef);
  if (!stagingSnap.exists()) {
    const stagingData = {
      ...baseData,
      _description: "Staging sandbox for testing changes locally before promoting to production.",
      updatedAt: new Date().toISOString(),
    };
    await setDoc(stagingRef, stagingData);
    console.log(`[CREATED] Created staging document: ${DOC_STAGING}`);
  } else {
    console.log(`[EXISTS] Staging document already exists: ${DOC_STAGING}`);
  }

  console.log(`\nAll 3 configuration documents verified in Firestore!`);
  console.log(` - Production:  ${CONFIG_COLLECTION}/${DOC_PROD}`);
  console.log(` - Staging:     ${CONFIG_COLLECTION}/${DOC_STAGING}`);
  console.log(` - Default:     ${CONFIG_COLLECTION}/${DOC_DEFAULT}\n`);
}

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Firestore seed error:", err);
    process.exit(1);
  });
