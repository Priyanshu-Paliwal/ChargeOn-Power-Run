import { reactive } from "vue";

// Level Configurations:
// - speedMultiplier: Speed of the runner (1.0 = base speed, 1.2, 1.4, etc.)
// - targetDurationSeconds: Target playtime in seconds (e.g. 60 for ~1.0 min, 72 for ~1.2 min, 84 for ~1.4 min).
//   Coin spacing is automatically calculated to distribute coins across this duration.
// - coinSpacing: (Optional) Direct manual distance between coin spawns. If omitted, automatically derived.
export const levels = reactive([
  {
    id: 1,
    speedMultiplier: 1.0, // Speed
    targetDurationSeconds: 60, // Target Playtime in Seconds (~1.0 min)
    requiredCount: 22, // Number of Coins to Collect
    maxPatternDifficulty: 1, // Patterns Difficulty
    obstacleDensity: 0.35, // Density of Obstacles
    speedRampMultiplier: 1.08, // Speed Ramp Multiplier
    goodie: "Energy Bar",
    goodieImage: "/img/energy-bar-img.png",
    discount: "5%",
    discountImage: "/img/PercentOff-img.png",
    features: [
      { name: "Multiple Payment Gateways", category: "Admin" },
      { name: "Default Payment Gateway", category: "Admin" },
      { name: "Tokenization", category: "Admin" },
      { name: "Custom Mapping", category: "Admin" },
      { name: "Reports & Dashboards", category: "Admin" },
      { name: "Multiple Payer Relations", category: "Admin" },
      { name: "Payment Method Active", category: "Admin" },
      { name: "Payment Types & Methods", category: "Business" },
      { name: "Instant Payments", category: "Business" },
      { name: "Scheduled Payments", category: "Business" },
      { name: "Recurring Payments", category: "Business" },
      { name: "Payment Links", category: "Business" },
      { name: "Refunds", category: "Business" },
      { name: "Transaction History", category: "Business" },
      { name: "Multicurrency Support", category: "Business" },
      { name: "Auto-populated Fields", category: "Business" },
      { name: "Automatic Data Retrieval", category: "Business" },
      { name: "Account Payment Method Update", category: "Admin" },
      { name: "Recaptcha on Payment Links", category: "Admin" },
      { name: "Payment Gateway Environment Switching", category: "Admin" },
      { name: "Recurring Payment Summary Preview", category: "Business" },
      { name: "Advance Payments", category: "Business" },
    ],
    blockers: [
      { id: "b1", text: "Fragmented Processes" },
      { id: "b2", text: "Limited Flexibility" },
      { id: "b3", text: "Manual Reconciliation" },
      { id: "b4", text: "Inefficient Tracking" },
    ],
  },
  {
    id: 2,
    speedMultiplier: 1.2, // Speed
    targetDurationSeconds: 60, // Target Playtime in Seconds (~1.2 min)
    requiredCount: 22, // Number of Coins to Collect
    maxPatternDifficulty: 2, // Patterns Difficulty
    obstacleDensity: 0.5, // Density of Obstacles
    speedRampMultiplier: 1.12, // Speed Ramp Multiplier
    goodie: "Fridge Magnet",
    goodieImage: "/img/badges-img.png",
    discount: "10%",
    discountImage: "/img/PercentOff-img.png",
    features: [
      { name: "Unresolved Transaction", category: "Admin" },
      { name: "Error Logs", category: "Admin" },
      { name: "Automated Collection", category: "Admin" },
      { name: "Payment Links", category: "Admin" },
      { name: "Payment Gateway Fallback", category: "Admin" },
      { name: "Invoice", category: "Admin" },
      { name: "Global Settings", category: "Admin" },
      { name: "Authorization Hold", category: "Business" },
      { name: "Register Token", category: "Business" },
      { name: "Add Cash", category: "Business" },
      { name: "Add Check", category: "Business" },
      { name: "Refund Reason & Notes Capture", category: "Business" },
      { name: "Transaction Summary", category: "Business" },
      { name: "Upfront Installment", category: "Business" },
      { name: "Email Notifications", category: "Business" },
      { name: "Add Wire Transfer", category: "Business" },
      { name: "Credit Memo", category: "Business" },
      { name: "Net Terms and Late Fee Configuration", category: "Admin" },
      { name: "Abort Scheduled Payment", category: "Business" },
      { name: "Email Notification", category: "Business" },
      { name: "ChargeOn Agent Assistant", category: "Business" },
      { name: "Experience Cloud Payment Portal", category: "Business" },
    ],
    blockers: [
      { id: "b5", text: "Global Payment Complexity" },
      { id: "b6", text: "Poor Customer Experience" },
      { id: "b7", text: "Disconnected Systems" },
      { id: "b8", text: "Chasing Manual Payments" },
    ],
  },
  {
    id: 3,
    speedMultiplier: 1.4, // Speed
    targetDurationSeconds: 72, // Target Playtime in Seconds (~1.4 min)
    requiredCount: 10, // Number of coins to Collect
    maxPatternDifficulty: 4, // Patterns Difficulty
    obstacleDensity: 0.65, // Density of Obstacles
    speedRampMultiplier: 1.15, // Speed Ramp Multiplier
    goodie: "Premium Tote Bag",
    goodieImage: "/img/tote-bag-img.png",
    discount: "15%",
    discountImage: "/img/PercentOff-img.png",
    features: [
      { name: "Payment Link Customization", category: "Admin" },
      { name: "Surcharging", category: "Admin" },
      { name: "Invoice PDF", category: "Admin" },
      { name: "3D Secure Card Enablement", category: "Admin" },
      { name: "Gateway Hosted Fields", category: "Admin" },
      { name: "Headless 360", category: "Admin" },
      { name: "Surcharging", category: "Business" },
      { name: "Transaction Reconciliation", category: "Business" },
      { name: "Mobile Experience", category: "Business" },
      { name: "Headless 360", category: "Business" },
    ],
    blockers: [
      { id: "b9", text: "Gateway Timeout" },
      { id: "b10", text: "Functional Limits" },
      { id: "b11", text: "Geographic Limits" },
    ],
  },
]);

// -----------------------------------------------------------------------
// 📢 EVENT CAMPAIGN & PROMOTIONAL COPY
// Centralized control of LinkedIn giveaway & booth challenge text
// Any edit here will instantly update Level 1 & 2 clear, Game Over, and Offer Reveal!
// -----------------------------------------------------------------------
export const campaignPromo = reactive({
  // 1. Appears on Level 1 & Level 2 Winning Popups (LevelComplete.vue)
  levelCompleteRunningBox: {
    title: "STILL IN THE RUNNING!",
    desc: "Post your run on LinkedIn, tag Cyntexa, and attach your booth selfie.",
    highlight: "Highest engagement wins an exclusive gift!", // 👈 Automatically styled in gold
  },

  // 2. Appears on Game Over Screen (GameOver.vue)
  gameOverEligibilityBox: {
    title: "YOU ARE STILL ELIGIBLE FOR THE EXCLUSIVE GIFT: AIRPODS PRO",
    desc: "Post your run on LinkedIn, tag Cyntexa, and attach your booth selfie.",
    highlight: "Highest engagement wins an exclusive gift!", // 👈 Automatically styled in gold
    image: "/img/run-failed-airpod-img.png",
  },

  // 3. Appears on Offer Reveal Screen after Level 3 (OfferReveal.vue)
  offerReveal: {
    title: "YOU'VE UNLOCKED SOMETHING BIG",
    instructionsHeader: "To earn this:",
    tasks: [
      { text: "Post your run on LinkedIn", isLinkedIn: true },
      { text: "Attach your booth selfie", highlight: "" },
      { text: "Tag", highlight: "Cyntexa" },
    ],
    highlightBox: "Highest engagement post wins an exclusive AirPods Pro", // 👈 Gold highlight banner
    buttonText: "SEE MY RESULTS",
    image: "/img/airpods.png",
  },
});

/**
 * Applies dynamic remote overrides from Firebase Firestore or localStorage cache.
 * Leaves features and blockers intact.
 */
export function applyRemoteContent(remoteData) {
  if (!remoteData) return;

  try {
    // 1. Update Levels
    if (remoteData.levels) {
      const levelsMap = Array.isArray(remoteData.levels)
        ? Object.fromEntries(remoteData.levels.map((l) => [l.id, l]))
        : remoteData.levels;

      for (const [lvlId, overrides] of Object.entries(levelsMap)) {
        const target = levels.find((l) => l.id === Number(lvlId));
        if (target && overrides) {
          // If goodie is explicitly null or empty string, set it so UI properly hides it
          if ("goodie" in overrides) target.goodie = overrides.goodie || null;
          if (
            "goodieImage" in overrides &&
            overrides.goodieImage !== undefined
          ) {
            target.goodieImage = overrides.goodieImage;
          }
          if ("discount" in overrides && overrides.discount) {
            target.discount = overrides.discount;
          }
          if (
            "discountImage" in overrides &&
            overrides.discountImage !== undefined
          ) {
            target.discountImage = overrides.discountImage;
          }
          if (typeof overrides.speedMultiplier === "number") {
            target.speedMultiplier = overrides.speedMultiplier;
          }
          if (typeof overrides.targetDurationSeconds === "number") {
            target.targetDurationSeconds = overrides.targetDurationSeconds;
          }
          if (typeof overrides.coinSpacing === "number") {
            target.coinSpacing = overrides.coinSpacing;
          }
          if (typeof overrides.requiredCount === "number") {
            target.requiredCount = overrides.requiredCount;
          }
          if (typeof overrides.maxPatternDifficulty === "number") {
            target.maxPatternDifficulty = overrides.maxPatternDifficulty;
          }
          if (typeof overrides.obstacleDensity === "number") {
            target.obstacleDensity = overrides.obstacleDensity;
          }
          if (typeof overrides.speedRampMultiplier === "number") {
            target.speedRampMultiplier = overrides.speedRampMultiplier;
          }
        }
      }
    }

    // 2. Update Promotional Copy
    if (remoteData.campaignPromo) {
      if (remoteData.campaignPromo.levelCompleteRunningBox) {
        Object.assign(
          campaignPromo.levelCompleteRunningBox,
          remoteData.campaignPromo.levelCompleteRunningBox,
        );
      }
      if (remoteData.campaignPromo.gameOverEligibilityBox) {
        Object.assign(
          campaignPromo.gameOverEligibilityBox,
          remoteData.campaignPromo.gameOverEligibilityBox,
        );
      }
      if (remoteData.campaignPromo.offerReveal) {
        Object.assign(
          campaignPromo.offerReveal,
          remoteData.campaignPromo.offerReveal,
        );
      }
    }
  } catch (err) {
    console.warn("[GameContent] Failed to apply remote overrides:", err);
  }
}

/**
 * Returns a clean JSON representation of syncable properties
 * (used to seed or update Firestore).
 */
export function getSyncableContent() {
  const syncLevels = {};
  levels.forEach((l) => {
    syncLevels[l.id] = {
      id: l.id,
      goodie: l.goodie,
      goodieImage: l.goodieImage,
      discount: l.discount,
      discountImage: l.discountImage,
      speedMultiplier: l.speedMultiplier,
      targetDurationSeconds: l.targetDurationSeconds,
      requiredCount: l.requiredCount,
      maxPatternDifficulty: l.maxPatternDifficulty,
      obstacleDensity: l.obstacleDensity,
      speedRampMultiplier: l.speedRampMultiplier,
    };
  });

  return {
    levels: syncLevels,
    campaignPromo: JSON.parse(JSON.stringify(campaignPromo)),
    updatedAt: new Date().toISOString(),
  };
}

// Instant offline cache restore on boot
try {
  if (typeof localStorage !== "undefined") {
    const cached = localStorage.getItem("chargeon_remote_config");
    if (cached) {
      applyRemoteContent(JSON.parse(cached));
      console.log(
        "[GameContent] Applied cached remote config from localStorage.",
      );
    }
  }
} catch (e) {
  // Ignore if unavailable
}
