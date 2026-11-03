export type Language = "en" | "ta";
const tamil: Readonly<Record<string, string>> = {
  "Customer visits": "வாடிக்கையாளர் சந்திப்புகள்",
  "Active visits": "நடப்பு சந்திப்புகள்",
  History: "வரலாறு",
  "No past visits in the loaded results.":
    "ஏற்றப்பட்ட முடிவுகளில் பழைய சந்திப்புகள் இல்லை.",
  "No active visits in the loaded results.":
    "ஏற்றப்பட்ட முடிவுகளில் நடப்பு சந்திப்புகள் இல்லை.",
  "View visit": "சந்திப்பைப் பார்க்கவும்",
  "Load more visits": "மேலும் சந்திப்புகளை ஏற்றவும்",
  "Refresh visits": "சந்திப்புகளைப் புதுப்பிக்கவும்",
  Visit: "சந்திப்பு",
  "Visit pending": "காத்திருக்கும் சந்திப்பு",
  "Visit accepted": "ஏற்கப்பட்ட சந்திப்பு",
  "Visit approaching": "நெருங்கும் சந்திப்பு",
  "Visit arrived": "வந்தடைந்த சந்திப்பு",
  "Visit completed": "நிறைவடைந்த சந்திப்பு",
  "Visit declined": "மறுக்கப்பட்ட சந்திப்பு",
  "Visit cancelled": "ரத்து செய்யப்பட்ட சந்திப்பு",
  "Visit expired": "காலாவதியான சந்திப்பு",
  PENDING: "காத்திருக்கிறது",
  ACCEPTED: "ஏற்கப்பட்டது",
  APPROACHING: "நெருங்குகிறது",
  ARRIVED: "வந்தடைந்தது",
  COMPLETED: "நிறைவடைந்தது",
  DECLINED: "மறுக்கப்பட்டது",
  CANCELLED: "ரத்து செய்யப்பட்டது",
  EXPIRED: "காலாவதியானது",
  VERIFIED: "சரிபார்க்கப்பட்டது",
  REJECTED: "நிராகரிக்கப்பட்டது",
  SUSPENDED: "இடைநிறுத்தப்பட்டது",
  Status: "நிலை",
  "Meeting point": "சந்திப்பு இடம்",
  "Selected public point": "தேர்ந்தெடுத்த பொது இடம்",
  Deadline: "காலக்கெடு",
  Latitude: "அட்சரேகை",
  Longitude: "தீர்க்கரேகை",
  "Opening maps shares this meeting point with the map provider.":
    "வரைபடத்தைத் திறந்தால் இந்தச் சந்திப்பு இடம் வரைபட வழங்குநருடன் பகிரப்படும்.",
  "Open meeting point in maps": "சந்திப்பு இடத்தை வரைபடத்தில் திறக்கவும்",
  "Arrival needs two accurate server-received location fixes at least five seconds apart near the meeting point. Keep sharing on while travelling.":
    "வந்தடைந்ததை உறுதிசெய்ய சந்திப்பு இடத்திற்கு அருகில் குறைந்தது ஐந்து நொடிகள் இடைவெளியில் இரண்டு துல்லியமான இருப்பிடங்கள் சேவையகத்தை அடைய வேண்டும். பயணிக்கும்போது இருப்பிடப் பகிர்வை இயக்கி வைக்கவும்.",
  Reason: "காரணம்",
  "Accept visit": "சந்திப்பை ஏற்கவும்",
  "Decline visit": "சந்திப்பை மறுக்கவும்",
  "Mark approaching": "நெருங்குவதாகக் குறிக்கவும்",
  "Complete visit": "சந்திப்பை நிறைவு செய்யவும்",
  "Cancel visit": "சந்திப்பை ரத்து செய்யவும்",
  "Refresh visit": "சந்திப்பைப் புதுப்பிக்கவும்",
  "Retry visit": "சந்திப்பை மீண்டும் ஏற்றவும்",
  "Invalid visit link.": "தவறான சந்திப்பு இணைப்பு.",
  "Refresh this visit before changing it.":
    "மாற்றுவதற்கு முன் இந்தச் சந்திப்பைப் புதுப்பிக்கவும்.",
  "Enter a reason before declining or cancelling.":
    "மறுப்பதற்கு அல்லது ரத்து செய்வதற்கு முன் காரணத்தை உள்ளிடவும்.",
  "The request has changed. Refresh its current state.":
    "கோரிக்கை மாற்றப்பட்டுள்ளது. தற்போதைய நிலையைப் புதுப்பிக்கவும்.",
  "This visit is complete. No purchase or payment was recorded.":
    "இந்தச் சந்திப்பு நிறைவடைந்தது. வாங்குதல் அல்லது பணம் செலுத்துதல் பதிவு செய்யப்படவில்லை.",
  "Report a problem with this visit":
    "இந்தச் சந்திப்பில் உள்ள சிக்கலைப் புகாரளிக்கவும்",
  Safety: "பாதுகாப்பு",
  "No show": "வரவில்லை",
  Other: "மற்றவை",
  "Report details": "புகார் விவரங்கள்",
  "Send report": "புகாரை அனுப்பவும்",
  "Report sent.": "புகார் அனுப்பப்பட்டது.",
  "Use at least 10 characters to describe the problem.":
    "சிக்கலைக் குறைந்தது 10 எழுத்துகளில் விவரிக்கவும்.",
  "Go online and share location": "ஆன்லைனில் சென்று இருப்பிடத்தைப் பகிரவும்",
  "Go offline": "ஆஃப்லைனில் செல்லவும்",
  "Getting your location…": "உங்கள் இருப்பிடம் பெறப்படுகிறது…",
  "Allow background location": "பின்னணி இருப்பிடத்தை அனுமதிக்கவும்",
  "Location sharing is active on this device.":
    "இந்தச் சாதனத்தில் இருப்பிடப் பகிர்வு இயங்குகிறது.",
  "Your business is online. This device has not started location updates.":
    "உங்கள் வணிகம் ஆன்லைனில் உள்ளது. இந்தச் சாதனத்தில் இருப்பிடப் புதுப்பிப்புகள் தொடங்கப்படவில்லை.",
  "Your exact location is shared only with an accepted customer visit. Nearby searches show an approximate area.":
    "ஏற்கப்பட்ட வாடிக்கையாளர் சந்திப்பில் மட்டும் உங்கள் துல்லியமான இருப்பிடம் பகிரப்படும். அருகிலுள்ள தேடல்களில் தோராயமான பகுதி காட்டப்படும்.",
  "Keep this screen open for foreground location updates. Background sharing requires a native development build and separate permission.":
    "இருப்பிடப் புதுப்பிப்புகளுக்கு இந்தத் திரையைத் திறந்து வைக்கவும். பின்னணிப் பகிர்வுக்கு நிறுவப்பட்ட செயலியும் தனி அனுமதியும் தேவை.",
  "Background sharing is enabled for your next online session. It pauses when access expires; open Partner and go online again. Phone settings can stop updates.":
    "அடுத்த ஆன்லைன் அமர்வுக்குப் பின்னணிப் பகிர்வு இயக்கப்பட்டுள்ளது. அணுகல் காலாவதியானால் பகிர்வு இடைநிறுத்தப்படும்; செயலியைத் திறந்து மீண்டும் ஆன்லைனில் செல்லவும். தொலைபேசி அமைப்புகள் புதுப்பிப்புகளை நிறுத்தக்கூடும்.",
  "Background location needs a native development build. Browser sharing works while this screen stays open.":
    "பின்னணி இருப்பிடத்துக்கு நிறுவப்பட்ட செயலி தேவை. இந்தத் திரை திறந்திருக்கும் வரை உலாவியில் பகிரலாம்.",
  "Background permission was not granted. You can use foreground sharing instead.":
    "பின்னணி அனுமதி வழங்கப்படவில்லை. திரை திறந்திருக்கும் போது பகிரலாம்.",
  "Location permission is required to go online. You can stay offline.":
    "ஆன்லைனில் செல்ல இருப்பிட அனுமதி தேவை. நீங்கள் ஆஃப்லைனில் இருக்கலாம்.",
  "Wait for an accurate, recent location and try again.":
    "துல்லியமான சமீபத்திய இருப்பிடம் கிடைக்கும் வரை காத்திருந்து மீண்டும் முயற்சிக்கவும்.",
  "Location sharing paused on this device.":
    "இந்தச் சாதனத்தில் இருப்பிடப் பகிர்வு இடைநிறுத்தப்பட்டது.",
  "No recent location update. Stale points are hidden; check location and connection.":
    "சமீபத்திய இருப்பிடம் கிடைக்கவில்லை. பழைய இருப்பிடங்கள் மறைக்கப்படும்; இருப்பிடத்தையும் இணைப்பையும் சரிபார்க்கவும்.",
  "Location update failed. Check your connection; stale points are hidden.":
    "இருப்பிடப் புதுப்பிப்பு தோல்வியடைந்தது. இணைப்பைச் சரிபார்க்கவும்; பழைய இருப்பிடங்கள் மறைக்கப்படும்.",
  "Sharing paused. Check your account and go online again.":
    "பகிர்வு இடைநிறுத்தப்பட்டது. கணக்கைச் சரிபார்த்து மீண்டும் ஆன்லைனில் செல்லவும்.",
  "Device sharing stopped. Server offline confirmation failed; retry going offline.":
    "சாதனத்தில் பகிர்வு நிறுத்தப்பட்டது. சேவையகத்தின் ஆஃப்லைன் உறுதிப்படுத்தல் தோல்வியடைந்தது; மீண்டும் ஆஃப்லைனில் செல்ல முயற்சிக்கவும்.",
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
  "Refresh business": "வணிக நிலையைப் புதுப்பிக்கவும்",
  "Set up location sharing on this device before going online.":
    "ஆன்லைனில் செல்லும் முன் இந்தச் சாதனத்தில் இருப்பிடப் பகிர்வை அமைக்கவும்.",
  "Visit counts are not sales or earnings. The day uses India time.":
    "இவை சந்திப்பு எண்ணிக்கைகள் மட்டுமே; விற்பனையோ வருமானமோ அல்ல. நாள் இந்திய நேரத்தின் அடிப்படையில் கணக்கிடப்படுகிறது.",
  "Pending visits": "காத்திருக்கும் சந்திப்புகள்",
  "Completed visits today": "இன்று முடிந்த சந்திப்புகள்",
  "Review status": "சரிபார்ப்பு நிலை",
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
