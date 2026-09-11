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
const CONFIG_DOC = "game_content";

async function checkAndSeed() {
  console.log(`Checking Firestore doc: ${CONFIG_COLLECTION}/${CONFIG_DOC}...`);
  const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    console.log("Document already exists in Firestore! Current data:");
    console.log(JSON.stringify(snap.data(), null, 2));
  } else {
    console.log("Document does not exist. Seeding initial configuration...");
    const initialData = {
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
          desc: "Post your run on LinkedIn, tag Cyntexa, and attach your booth selfie.",
          highlight: "Highest engagement wins an exclusive gift!",
        },
        gameOverEligibilityBox: {
          title: "YOU ARE STILL ELIGIBLE FOR THE EXCLUSIVE GIFT: AIRPODS PRO",
          desc: "Post your run on LinkedIn, tag Cyntexa, and attach your booth selfie.",
          highlight: "Highest engagement wins an exclusive gift!",
          image: "/img/run-failed-airpod-img.png",
        },
        offerReveal: {
          title: "YOU'VE UNLOCKED SOMETHING BIG",
          instructionsHeader: "To earn this:",
          tasks: [
            { text: "Post your run on LinkedIn", isLinkedIn: true },
            { text: "Attach your booth selfie", highlight: "" },
            { text: "Tag", highlight: "Cyntexa" },
          ],
          highlightBox: "Highest engagement post wins an exclusive AirPods Pro",
          buttonText: "SEE MY RESULTS",
          image: "/img/airpods.png",
        },
      },
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, initialData);
    console.log(
      "Successfully seeded chargeon_config/game_content in Firestore!",
    );
  }
}

checkAndSeed()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Firestore test error:", err);
    process.exit(1);
  });
