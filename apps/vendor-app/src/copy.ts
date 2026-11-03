export type Language = "en" | "ta";
const tamil: Readonly<Record<string, string>> = {
  Home: "முகப்பு",
  Visits: "சந்திப்புகள்",
  Profile: "வணிக விவரம்",
  Account: "கணக்கு",
  "Run your local business": "உங்கள் உள்ளூர் வணிகத்தை நிர்வகிக்கவும்",
  "Create your partner account": "உங்கள் விற்பனையாளர் கணக்கை உருவாக்கவும்",
  "Create partner account": "விற்பனையாளர் கணக்கை உருவாக்கவும்",
  "Sign in": "உள்நுழையவும்",
  "Forgot password?": "கடவுச்சொல்லை மறந்துவிட்டீர்களா?",
  Name: "பெயர்",
  Email: "மின்னஞ்சல்",
  Password: "கடவுச்சொல்",
  "Please wait…": "காத்திருக்கவும்…",
  "Reset your password": "கடவுச்சொல்லை மீட்டமைக்கவும்",
  "Send reset link": "மீட்டமைப்பு இணைப்பை அனுப்பவும்",
  "Retry saved session": "உள்நுழைவை மீண்டும் முயற்சிக்கவும்",
  "Loading…": "ஏற்றப்படுகிறது…",
  "Restoring session…": "உள்நுழைவு மீட்டெடுக்கப்படுகிறது…",
  "Manage your business, choose when to share your location and arrange customer visits.":
    "உங்கள் வணிகத்தை நிர்வகித்து, இருப்பிடப் பகிர்வைத் தேர்வு செய்து, வாடிக்கையாளர் சந்திப்புகளை ஏற்பாடு செய்யவும்.",
  "Enter a valid email address.": "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.",
  "Enter your name and a password with 15 to 128 characters.":
    "உங்கள் பெயரையும் 15 முதல் 128 எழுத்துகள் கொண்ட கடவுச்சொல்லையும் உள்ளிடவும்.",
  "Enter your password.": "கடவுச்சொல்லை உள்ளிடவும்.",
  "If your account is eligible, a reset link will be sent.":
    "தகுதியான கணக்காக இருந்தால் மீட்டமைப்பு இணைப்பு அனுப்பப்படும்.",
  "Your business today": "இன்றைய உங்கள் வணிகம்",
  "Your business profile": "உங்கள் வணிக விவரம்",
  "Your account": "உங்கள் கணக்கு",
  "Create your business profile to request staff review.":
    "பணியாளர் சரிபார்ப்பைக் கோர உங்கள் வணிக விவரத்தை உருவாக்கவும்.",
  "Open business profile": "வணிக விவரத்தைத் திறக்கவும்",
  "Business name": "வணிகப் பெயர்",
  "Business description": "வணிக விளக்கம்",
  "Choose the categories you sell.":
    "நீங்கள் விற்கும் பொருள் வகைகளைத் தேர்வு செய்யவும்.",
  "Save business profile": "வணிக விவரத்தைச் சேமிக்கவும்",
  "Saving…": "சேமிக்கப்படுகிறது…",
  "Business profile saved.": "வணிக விவரம் சேமிக்கப்பட்டது.",
  "Review details": "சரிபார்ப்பு விவரங்கள்",
  "Request staff review": "பணியாளர் சரிபார்ப்பைக் கோரவும்",
  "Review requested.": "சரிபார்ப்பு கோரப்பட்டது.",
  "Share public business details only. Do not send identity documents, passwords or private customer information.":
    "பொது வணிக விவரங்களை மட்டும் பகிரவும். அடையாள ஆவணங்கள், கடவுச்சொற்கள் அல்லது வாடிக்கையாளரின் தனிப்பட்ட விவரங்களை அனுப்ப வேண்டாம்.",
  "Enter a business name and choose at least one category.":
    "வணிகப் பெயரை உள்ளிட்டு குறைந்தது ஒரு பொருள் வகையைத் தேர்வு செய்யவும்.",
  "Save your profile and provide at least 10 characters for the review.":
    "வணிக விவரத்தைச் சேமித்து, சரிபார்ப்பு விவரங்களைக் குறைந்தது 10 எழுத்துகளில் உள்ளிடவும்.",
  "Your business needs staff approval before going online.":
    "ஆன்லைனில் செல்ல உங்கள் வணிகத்திற்குப் பணியாளர் ஒப்புதல் தேவை.",
  "Your business was not approved. Update your profile and request another review.":
    "வணிகத்திற்கு ஒப்புதல் கிடைக்கவில்லை. விவரங்களைப் புதுப்பித்து மீண்டும் சரிபார்ப்பைக் கோரவும்.",
  "Your business is suspended. Contact the operator before sharing again.":
    "வணிகம் இடைநிறுத்தப்பட்டுள்ளது. மீண்டும் பகிர்வதற்கு முன் நிர்வாகியைத் தொடர்புகொள்ளவும்.",
  "You are offline. Your location is not being shared.":
    "நீங்கள் ஆஃப்லைனில் உள்ளீர்கள். உங்கள் இருப்பிடம் பகிரப்படவில்லை.",
  "Go online": "ஆன்லைனில் செல்லவும்",
  "Go offline": "ஆஃப்லைனில் செல்லவும்",
  "Refresh business": "வணிக நிலையைப் புதுப்பிக்கவும்",
  "Set up location sharing on this device before going online.":
    "ஆன்லைனில் செல்லும் முன் இந்தச் சாதனத்தில் இருப்பிடப் பகிர்வை அமைக்கவும்.",
  "Visit counts are not sales or earnings. The day uses India time.":
    "இவை சந்திப்பு எண்ணிக்கைகள் மட்டுமே; விற்பனையோ வருமானமோ அல்ல. நாள் இந்திய நேரத்தின் அடிப்படையில் கணக்கிடப்படுகிறது.",
  "Active visits": "நடப்பு சந்திப்புகள்",
  "Pending visits": "காத்திருக்கும் சந்திப்புகள்",
  "Completed visits today": "இன்று முடிந்த சந்திப்புகள்",
  "Review status": "சரிபார்ப்பு நிலை",
  PENDING: "காத்திருக்கிறது",
  VERIFIED: "சரிபார்க்கப்பட்டது",
  REJECTED: "மறுக்கப்பட்டது",
  SUSPENDED: "இடைநிறுத்தப்பட்டது",
  "Sign out": "வெளியேறவும்",
  Retry: "மீண்டும் முயற்சிக்கவும்",
  "No product categories are configured. Contact the operator.":
    "பொருள் வகைகள் அமைக்கப்படவில்லை. நிர்வாகியைத் தொடர்புகொள்ளவும்.",
};
export function translate(language: Language, value: string) {
  return language === "ta"
    ? (tamil[value.replace(/\s+/g, " ").trim()] ?? value)
    : value;
}
