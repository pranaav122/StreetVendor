export type Language = "en" | "ta";
const tamil: Readonly<Record<string, string>> = {
  "Set up your shop": "உங்கள் கடையை அமைக்கவும்",
  "Location updates are interrupted. Retry sharing or go offline.":
    "இருப்பிடப் புதுப்பிப்புகள் தடைப்பட்டுள்ளன. மீண்டும் பகிரவும் அல்லது ஆஃப்லைனில் செல்லவும்.",
  "Checking your location permission and account.":
    "உங்கள் இருப்பிட அனுமதியும் கணக்கும் சரிபார்க்கப்படுகின்றன.",
  "Shop name": "கடையின் பெயர்",
  "About your shop": "உங்கள் கடையைப் பற்றி",
  "Save shop details": "கடை விவரங்களைச் சேமிக்கவும்",
  "Shop details saved.": "கடை விவரங்கள் சேமிக்கப்பட்டன.",
  "Public stall details": "பொதுக் கடை விவரங்கள்",
  "Send for approval": "ஒப்புதலுக்கு அனுப்பவும்",
  "Sent for approval.": "ஒப்புதலுக்கு அனுப்பப்பட்டது.",
  "Save your shop details, then send them for approval.":
    "உங்கள் கடை விவரங்களைச் சேமித்து ஒப்புதலுக்கு அனுப்பவும்.",
  "Location settings": "இருப்பிட அமைப்புகள்",
  "Set up my shop": "என் கடையை அமைக்கவும்",
  "Recent customer requests": "சமீபத்திய வாடிக்கையாளர் கோரிக்கைகள்",
  "Loading visits…": "சந்திப்புகள் ஏற்றப்படுகின்றன…",
  "No recent active visits. Check Customers for older visits.":
    "சமீபத்திய செயலில் உள்ள சந்திப்புகள் இல்லை. பழைய சந்திப்புகளுக்கு வாடிக்கையாளர்கள் பகுதியைப் பார்க்கவும்.",
  "View all customer visits":
    "அனைத்து வாடிக்கையாளர் சந்திப்புகளையும் பார்க்கவும்",
  "Today’s visit summary": "இன்றைய சந்திப்பு விவரம்",
  "I’m on my way": "நான் வந்து கொண்டிருக்கிறேன்",
  "I can’t make it": "என்னால் வர முடியாது",
  "Meeting details": "சந்திப்பு விவரங்கள்",
  "Open directions": "வழியைத் திறக்கவும்",
  "Keep location sharing on while travelling. Arrival is checked automatically.":
    "பயணத்தின் போது இருப்பிடப் பகிர்வை இயக்கி வைக்கவும். வந்தடைந்தது தானாகச் சரிபார்க்கப்படும்.",
  "Accepting lets this customer see your exact location during the visit.":
    "ஏற்றுக்கொண்டால் சந்திப்பின் போது இந்த வாடிக்கையாளர் உங்கள் துல்லியமான இருப்பிடத்தைப் பார்க்கலாம்.",
  "Need help with this visit?": "இந்தச் சந்திப்புக்கு உதவி வேண்டுமா?",
  "Confirm cancellation": "ரத்து செய்வதை உறுதிசெய்",
  "Account deletion": "கணக்கை நீக்குதல்",
  Notifications: "அறிவிப்புகள்",
  "Sign in to your shop": "உங்கள் கடைக்குள் உள்நுழையவும்",
  "Create your shop account": "உங்கள் கடைக் கணக்கை உருவாக்கவும்",
  "Create account": "கணக்கை உருவாக்கவும்",
  "Go online, meet customers and manage your shop.":
    "ஆன்லைனில் சென்று வாடிக்கையாளர்களைச் சந்தித்து உங்கள் கடையை நிர்வகிக்கவும்.",
  "Main navigation": "முதன்மை வழிசெலுத்தல்",
  Customers: "வாடிக்கையாளர்கள்",
  "My shop": "என் கடை",
  More: "மேலும்",
  "Going offline…": "ஆஃப்லைனில் செல்லப்படுகிறது…",
  "Stopping location sharing…": "இருப்பிடப் பகிர்வு நிறுத்தப்படுகிறது…",
  "Wait for offline confirmation before going online again.":
    "மீண்டும் ஆன்லைனில் செல்வதற்கு முன் ஆஃப்லைன் உறுதிப்படுத்தலுக்குக் காத்திருக்கவும்.",
  "Cannot check location permission. Check device settings and go online again.":
    "இருப்பிட அனுமதியைச் சரிபார்க்க முடியவில்லை. சாதன அமைப்புகளைச் சரிபார்த்து மீண்டும் ஆன்லைனில் செல்லவும்.",
  "Location permission was removed. Go online only after enabling it again.":
    "இருப்பிட அனுமதி நீக்கப்பட்டது. அதை மீண்டும் இயக்கிய பிறகு ஆன்லைனில் செல்லவும்.",
  "The server stopped sharing. Go online again after checking your account.":
    "சேவையகம் பகிர்வை நிறுத்தியது. கணக்கைச் சரிபார்த்து மீண்டும் ஆன்லைனில் செல்லவும்.",
  "Background sharing paused. Check your account and go online again.":
    "பின்னணிப் பகிர்வு இடைநிறுத்தப்பட்டது. கணக்கைச் சரிபார்த்து மீண்டும் ஆன்லைனில் செல்லவும்.",
  "Background location permission is required.":
    "பின்னணி இருப்பிட அனுமதி தேவை.",
  "Sign in again before starting background sharing.":
    "பின்னணிப் பகிர்வைத் தொடங்கும் முன் மீண்டும் உள்நுழையவும்.",
  "Location sharing could not start.":
    "இருப்பிடப் பகிர்வைத் தொடங்க முடியவில்லை.",
  "Business status could not refresh. Check your connection; you can still go offline.":
    "வணிக நிலையைப் புதுப்பிக்க முடியவில்லை. இணைப்பைச் சரிபார்க்கவும்; நீங்கள் இன்னும் ஆஃப்லைனில் செல்லலாம்.",
  "Choose a new password": "புதிய கடவுச்சொல்லைத் தேர்வு செய்யவும்",
  "Confirm your email": "மின்னஞ்சலை உறுதிப்படுத்தவும்",
  "New password": "புதிய கடவுச்சொல்",
  "Repeat new password": "புதிய கடவுச்சொல்லை மீண்டும் உள்ளிடவும்",
  "Save new password": "புதிய கடவுச்சொல்லைச் சேமிக்கவும்",
  "Confirm email": "மின்னஞ்சலை உறுதிப்படுத்தவும்",
  "Use email link": "மின்னஞ்சல் இணைப்பைப் பயன்படுத்து",
  "Email link": "மின்னஞ்சல் இணைப்பு",
  "Use a different link": "வேறு இணைப்பைப் பயன்படுத்து",
  "Return to sign in": "உள்நுழைவுக்குத் திரும்பவும்",
  "Password changed. Sign in with your new password.":
    "கடவுச்சொல் மாற்றப்பட்டது. புதிய கடவுச்சொல்லுடன் உள்நுழையவும்.",
  "Email link confirmed. You can return to your account.":
    "மின்னஞ்சல் இணைப்பு உறுதிப்படுத்தப்பட்டது. உங்கள் கணக்கிற்குத் திரும்பலாம்.",
  "This link is missing or invalid. Paste the full link from your email.":
    "இணைப்பு இல்லை அல்லது தவறானது. மின்னஞ்சலில் உள்ள முழு இணைப்பை ஒட்டவும்.",
  "Confirming this link marks its email address as verified.":
    "இந்த இணைப்பை உறுதி செய்தால் அதற்கான மின்னஞ்சல் முகவரி சரிபார்க்கப்படும்.",
  "Use matching passwords with 15 to 128 characters.":
    "15 முதல் 128 எழுத்துகளுடன் ஒரே கடவுச்சொல்லை இருமுறை உள்ளிடவும்.",
  "Use the link for this action from your latest email.":
    "இந்தச் செயலுக்கான சமீபத்திய மின்னஞ்சல் இணைப்பைப் பயன்படுத்தவும்.",
  "Display name": "காட்டப்படும் பெயர்",
  "Save name": "பெயரைச் சேமிக்கவும்",
  "Name saved.": "பெயர் சேமிக்கப்பட்டது.",
  Language: "மொழி",
  "Your email is not confirmed.": "உங்கள் மின்னஞ்சல் உறுதிப்படுத்தப்படவில்லை.",
  "Email confirmed.": "மின்னஞ்சல் உறுதிப்படுத்தப்பட்டது.",
  "Send confirmation email": "உறுதிப்படுத்தும் மின்னஞ்சலை அனுப்பவும்",
  "Confirmation email requested. Check your inbox.":
    "உறுதிப்படுத்தும் மின்னஞ்சல் கோரப்பட்டது. உங்கள் இன்பாக்ஸைப் பார்க்கவும்.",
  "Enable notifications": "அறிவிப்புகளை இயக்கு",
  "Visit notifications are optional. Your inbox remains available without them.":
    "சந்திப்பு அறிவிப்புகள் விருப்பமானவை. அறிவிப்புகள் இல்லாமலும் சந்திப்புகளைச் செயலியில் பார்க்கலாம்.",
  "Remote notifications are unavailable in this preview. Check Customers for updates.":
    "இந்த முன்னோட்டத்தில் அறிவிப்புகள் கிடைக்காது. புதுப்பிப்புகளுக்குச் சந்திப்புகளைப் பார்க்கவும்.",
  "Notifications are unavailable in this version. Check Customers for updates.":
    "இந்தப் பதிப்பில் அறிவிப்புகள் கிடைக்காது. புதுப்பிப்புகளுக்குச் சந்திப்புகளைப் பார்க்கவும்.",
  "Notification permission is off. You can change it in device settings.":
    "அறிவிப்பு அனுமதி அணைக்கப்பட்டுள்ளது. சாதன அமைப்புகளில் அதை மாற்றலாம்.",
  "Device registered. Server notification delivery is disabled.":
    "சாதனம் பதிவு செய்யப்பட்டது. சேவையக அறிவிப்புகள் அணைக்கப்பட்டுள்ளன.",
  "Device registered. Notifications depend on your connection and device settings.":
    "சாதனம் பதிவு செய்யப்பட்டது. அறிவிப்புகள் உங்கள் இணைப்பு மற்றும் சாதன அமைப்புகளைப் பொறுத்தவை.",
  "Account deletion removes your profile, stops sharing and revokes your sessions. Minimal anonymous workflow history may remain until retention cleanup.":
    "கணக்கை நீக்கினால் உங்கள் சுயவிவரம் நீக்கப்பட்டு, பகிர்வும் உள்நுழைவுகளும் நிறுத்தப்படும். அடையாளமற்ற குறைந்தபட்ச சந்திப்பு வரலாறு தானியங்கி நீக்கம் வரை இருக்கலாம்.",
  "Sign in again if asked to confirm a recent login.":
    "சமீபத்திய உள்நுழைவை உறுதி செய்யக் கேட்டால் மீண்டும் உள்நுழையவும்.",
  "Confirm password": "கடவுச்சொல்லை உறுதி செய்யவும்",
  "Confirm recent sign-in": "மீண்டும் உள்நுழைந்து உறுதி செய்யவும்",
  "Recent sign-in confirmed.": "சமீபத்திய உள்நுழைவு உறுதி செய்யப்பட்டது.",
  "Type DELETE to delete your account": "கணக்கை நீக்க DELETE என உள்ளிடவும்",
  "Delete account": "கணக்கை நீக்கவும்",
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
  Reason: "காரணம்",
  "Accept visit": "சந்திப்பை ஏற்கவும்",
  "Decline visit": "சந்திப்பை மறுக்கவும்",
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
  "Enter a valid email address.": "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.",
  "Enter your name and a password with 15 to 128 characters.":
    "உங்கள் பெயரையும் 15 முதல் 128 எழுத்துகள் கொண்ட கடவுச்சொல்லையும் உள்ளிடவும்.",
  "Enter your password.": "கடவுச்சொல்லை உள்ளிடவும்.",
  "If your account is eligible, a reset link will be sent.":
    "தகுதியான கணக்காக இருந்தால் மீட்டமைப்பு இணைப்பு அனுப்பப்படும்.",
  "Your business today": "இன்றைய உங்கள் வணிகம்",
  "Your account": "உங்கள் கணக்கு",
  "Create your business profile to request staff review.":
    "பணியாளர் சரிபார்ப்பைக் கோர உங்கள் வணிக விவரத்தை உருவாக்கவும்.",
  "Open business profile": "வணிக விவரத்தைத் திறக்கவும்",
  "Choose the categories you sell.":
    "நீங்கள் விற்கும் பொருள் வகைகளைத் தேர்வு செய்யவும்.",
  "Saving…": "சேமிக்கப்படுகிறது…",
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
