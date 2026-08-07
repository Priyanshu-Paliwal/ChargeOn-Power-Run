export const levels = [
  {
    id: 1,
    title: "Level 1: Payment Fundamentals",
    subtext: "Collect 22 features. Dodge the basics.",
    speedTag: "Speed: 1.0x — High",
    speedMultiplier: 1.0,
    requiredCount: 22,
    goodiesPool: ["stickers", "pin badge", "bag tag"],
    features: [
      { name: "Integration with Multiple Payment Gateways", category: "Admin" },
      { name: "Payment Types and Methods", category: "Business" },
      { name: "Instant Payments", category: "Business" },
      { name: "Scheduled Payments", category: "Business" },
      { name: "Recurring Payments", category: "Business" },
      { name: "Payment Links", category: "Business" },
      { name: "Refunds (Full & Partial)", category: "Business" },
      { name: "Default Payment Gateway", category: "Admin" },
      { name: "Tokenization & Expired Card Notifier", category: "Admin" },
      { name: "Transaction History", category: "Business" },
      { name: "Multicurrency Support", category: "Business" },
      { name: "Custom Mapping & Object Flexibility", category: "Admin", isExclusive: true, exclusiveLine: "Map payments to any Salesforce object. Not just one." },
      { name: "Reports & Dashboards", category: "Admin" },
      { name: "Auto-populated Fields", category: "Business" },
      { name: "Multiple Payments Processed Consecutively", category: "Business" },
      { name: "Multiple Payer Relation with Payment Object", category: "Admin", isExclusive: true, exclusiveLine: "One payer, many payments. Many payers, one payment. Your call." },
      { name: "Abort Scheduled Payment", category: "Business", isExclusive: true, exclusiveLine: "Cancel one payment without cancelling the whole plan." },
      { name: "Automatic Data Retrieval", category: "Business", isExclusive: true, exclusiveLine: "Returning customer? We already know their details." },
      { name: "Authorization Hold", category: "Business" },
      { name: "Register Token", category: "Business" },
      { name: "Add Cash", category: "Business" },
      { name: "Add Check", category: "Business" }
    ],
    blockers: [
      { id: "b1", text: "Fragmented Processes", consequence: "payments handled outside Salesforce, breaking the flow." },
      { id: "b2", text: "Limited Flexibility", consequence: "payments that don't map to your Salesforce objects." },
      { id: "b3", text: "Inefficient Tracking", consequence: "manual reconciliation, slow and error-prone." },
      { id: "b4", text: "Poor Customer Experience", consequence: "no reminders, no recovery, no follow-through." }
    ]
  },
  {
    id: 2,
    title: "Level 2: Automation & Protection",
    // Corrected drone line (Milestone 9) -- the approved content script
    // contradicts itself here (this line originally said "only a lane
    // switch saves you," while HowToPlay.vue's control line said "slide
    // under drones"). Milestone 5 implemented the mixed system per the
    // user's decision (DRONE_LOW = slide, DRONE_HIGH = switch); this line
    // and HowToPlay.vue's are now both corrected to describe that
    // accurately instead of either half of the original contradiction.
    subtext: "22 more features. Drones incoming — slide under the low ones, switch lanes for the high ones.",
    speedTag: "Speed: 1.3x — Faster",
    speedMultiplier: 1.3,
    requiredCount: 22,
    goodiesPool: ["magnet", "cable protector", "diary & pen"],
    features: [
      { name: "Refund Reason & Notes Capture", category: "Business", isExclusive: true, exclusiveLine: "Every refund comes with a reason, built right in." },
      { name: "Recurring Payment Summary Preview", category: "Business", isExclusive: true, exclusiveLine: "See every future payment before you confirm a thing." },
      { name: "Payment Method Active/Inactive", category: "Admin", isExclusive: true, exclusiveLine: "Expired cards can't be used again. Ever." },
      { name: "Account Payment Method Update Email Notification", category: "Admin", isExclusive: true, exclusiveLine: "We remind customers before their card expires, automatically." },
      { name: "Unresolved Transaction", category: "Admin", isExclusive: true, exclusiveLine: "Nothing gets lost. Failed transactions get flagged, not forgotten." },
      { name: "Recurring Payment Transaction Summary", category: "Business", isExclusive: true, exclusiveLine: "Every recurring payment, past and future, in one view." },
      { name: "Upfront Installment", category: "Business", isExclusive: true, exclusiveLine: "Collect a deposit today, schedule the rest automatically." },
      { name: "Error Logs", category: "Admin", isExclusive: true, exclusiveLine: "Every payment hiccup, logged automatically. No developer required." },
      { name: "Automated Collection", category: "Admin" },
      { name: "Recaptcha on Payment Links", category: "Admin", isExclusive: true, exclusiveLine: "Bots don't get through. Only real customers do." },
      { name: "Payment Gateway Fallback Mechanism", category: "Admin", isExclusive: true, exclusiveLine: "One gateway down? We reroute automatically, up to 3 deep." },
      { name: "Invoice", category: "Admin", isExclusive: true, exclusiveLine: "From invoice to credit memo, fully connected." },
      { name: "Pre-Charge Customer Email Notifications", category: "Business", isExclusive: true, exclusiveLine: "Customers get a heads-up before we ever charge them." },
      { name: "Add Wire Transfer", category: "Business" },
      { name: "Global Settings", category: "Admin" },
      { name: "Payment Link Customization", category: "Admin" },
      { name: "Surcharging", category: "Admin & Business", isExclusive: true, exclusiveLine: "Recover processing costs automatically, with built-in exemptions." },
      { name: "Credit Memo", category: "Business" },
      { name: "Advance Payments", category: "Business" },
      { name: "Tax and Discount on Line Item", category: "Business" },
      { name: "Net Terms and Late Fee Configuration", category: "Admin" },
      { name: "Email Notification", category: "Business" }
    ],
    blockers: [
      { id: "b5", text: "Manual Reconciliation", consequence: "hours lost matching transactions by hand." },
      { id: "b6", text: "Disconnected Systems", consequence: "your gateway and your CRM aren't talking." },
      { id: "b7", text: "Chasing Manual Payments", consequence: "reminder emails nobody has time to send." },
      { id: "b8", text: "Gateway Timeout", consequence: "a slow gateway just cost you a sale." },
      { id: "b9", text: "Failed Payment", consequence: "a transaction with nowhere to go." }
    ]
  },
  {
    id: 3,
    title: "Level 3: Enterprise & AI Finale",
    subtext: "Final 10 features. Everything, all at once.",
    speedTag: "Speed: 1.6x — Fastest",
    speedMultiplier: 1.6,
    requiredCount: 10,
    goodiesPool: ["Premium Tote Bag"],
    features: [
      { name: "Invoice PDF Customization", category: "Admin" },
      { name: "3D Secure Card Enablement", category: "Admin" },
      { name: "ChargeOn Agent Assistant", category: "Business", isExclusive: true, exclusiveLine: "Type a payment like a text message. Done." },
      { name: "Payment Gateway Environment Switching", category: "Admin" },
      { name: "Experience Cloud Payment Portal", category: "Business", isExclusive: true, exclusiveLine: "Customers manage their own payments. No ticket required." },
      { name: "Gateway Hosted Fields", category: "Admin" },
      { name: "Transaction Reconciliation", category: "Business" },
      { name: "Mobile Experience", category: "Business" },
      { name: "Level 2 Commercial Card Processing", category: "Business" },
      { name: "Headless 360", category: "Admin & Business", isExclusive: true, exclusiveLine: "Any AI agent. Any app. One secure bridge to ChargeOn." }
    ],
    blockers: [
      { id: "b10", text: "Functional Limits", consequence: "your payment tool can't keep up with the business." },
      { id: "b11", text: "Geographic Limits", consequence: "one currency, one region, one problem." },
      { id: "b12", text: "Global Constraints", consequence: "multi-currency and tokenization, done the hard way." }
    ]
  }
];
