export const levels = [
  {
    id: 1,
    speedMultiplier: 1.0,
    requiredCount: 22,
    goodie: "Energy Bar",
    discount: "5% OFF",
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
      { name: "Advance Payments", category: "Business" }
    ],
    blockers: [
      { id: "b1", text: "Fragmented Processes" },
      { id: "b2", text: "Limited Flexibility" },
      { id: "b3", text: "Manual Reconciliation" },
      { id: "b4", text: "Inefficient Tracking" }
    ]
  },
  {
    id: 2,
    speedMultiplier: 1.2,
    requiredCount: 22,
    goodie: "Fridge Magnet",
    discount: "10% OFF",
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
      { name: "Experience Cloud Payment Portal", category: "Business" }
    ],
    blockers: [
      { id: "b5", text: "Global Payment Complexity" },
      { id: "b6", text: "Poor Customer Experience" },
      { id: "b7", text: "Disconnected Systems" },
      { id: "b8", text: "Chasing Manual Payments" }
    ]
  },
  {
    id: 3,
    speedMultiplier: 1.4,
    requiredCount: 10,
    goodie: "Premium Tote Bag",
    discount: "15% OFF",
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
      { name: "Headless 360", category: "Business" }
    ],
    blockers: [
      { id: "b9", text: "Gateway Timeout" },
      { id: "b10", text: "Functional Limits" },
      { id: "b11", text: "Geographic Limits" }
    ]
  }
];
