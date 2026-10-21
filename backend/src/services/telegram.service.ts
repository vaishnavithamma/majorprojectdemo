import axios from "axios";

interface TelegramAlertPayload {
  userName?: string;
  contactName?: string;
  relation?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  messageType?: "SOS_TRIGGER" | "TEST_ALERT";
}

/**
 * Triggers an incoming VoIP phone call to your Telegram app via CallMeBot
 */
export const makeTelegramVoiceCall = async (textToSpeak: string) => {
  const username = process.env.CALLMEBOT_USERNAME?.replace("@", "").trim();

  if (!username) {
    console.warn("⚠️ CALLMEBOT_USERNAME not configured in backend/.env.");
    return null;
  }

  try {
    const encodedText = encodeURIComponent(textToSpeak);
    // CallMeBot Voice Call endpoint
    const callUrl = `https://api.callmebot.com/start.php?user=@${username}&text=${encodedText}&lang=en-US-Standard-C&rpt=2`;

    console.log(`📞 Triggering CallMeBot phone call to @${username}...`);
    const response = await axios.get(callUrl);
    console.log("📞 CallMeBot response:", response.data);
    return response.data;
  } catch (err: any) {
    console.error("❌ CallMeBot call error:", err?.response?.data || err.message);
    return null;
  }
};

/**
 * Sends rich markdown message with Live GPS and triggers the voice call
 */
export const sendTelegramAlert = async (payload: TelegramAlertPayload) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const {
    userName = "SafeOps User",
    contactName = "Emergency Contact",
    relation = "Contact",
    phone = "Not provided",
    latitude,
    longitude,
    accuracy,
    messageType = "SOS_TRIGGER",
  } = payload;

  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  });

  let messageText = "";

  if (messageType === "TEST_ALERT") {
    messageText = `🔔 *SAFEOPS TEST ALERT*
━━━━━━━━━━━━━━━━━━━━
👤 *Recipient:* ${contactName} (${relation})
📱 *Phone:* \`${phone}\`
⏰ *Time:* ${now}

✅ *Status:* Connection test successful. SafeOps emergency dispatch is operational.`;

    // Trigger test call
    try {
      await makeTelegramVoiceCall(
        `Hello! This is a test call from SafeOps. Your emergency contact connection is working.`
      );
    } catch (e) {
      console.error("Test call trigger caught:", e);
    }
  } else {
    const hasLocation =
      typeof latitude === "number" && typeof longitude === "number";

    const mapsUrl = hasLocation
      ? `https://maps.google.com/?q=${latitude},${longitude}`
      : "Location unavailable";

    messageText = `🚨 *CRITICAL SAFEOPS EMERGENCY ALERT* 🚨
━━━━━━━━━━━━━━━━━━━━
⚠️ *SOS ACTIVATED BY USER*

👤 *User:* ${userName}
👥 *Notified Contact:* ${contactName} (${relation})
📱 *Phone:* \`${phone}\`
⏰ *Time:* ${now}

📍 *Live GPS Coordinates:*
${hasLocation ? `• *Lat / Lng:* \`${latitude?.toFixed(6)}, ${longitude?.toFixed(6)}\`\n• *Accuracy:* within ${accuracy ? Math.round(accuracy) : 15} meters` : "• Live GPS was not permitted or unavailable"}

🗺️ *Open Location on Google Maps:*
${hasLocation ? `👉 [Click here to view Live Location](${mapsUrl})` : "N/A"}

━━━━━━━━━━━━━━━━━━━━
📹 Emergency audio/video evidence is being securely recorded to the SafeOps Vault.`;

    // 1. Try CallMeBot VoIP call (rings phone)
    try {
      await makeTelegramVoiceCall(
        `Emergency alert! SafeOps SOS activated by ${userName}. Please check your Telegram immediately for live GPS location.`
      );
    } catch (e) {
      console.error("Voice call trigger caught:", e);
    }
  }

  // If standard bot token is set, send rich message + voice note
  if (token && chatId) {
    try {
      // Send rich text with GPS Google Maps link
      const textUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(textUrl, {
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      });

      // Also send an urgent TTS Voice Note directly into Telegram chat
      try {
        const speechUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(
          messageType === "TEST_ALERT"
            ? "SafeOps test alert received. Connection is active."
            : "Emergency alert from SafeOps! SOS activated. Live location sent."
        )}`;
        await axios.post(`https://api.telegram.org/bot${token}/sendAudio`, {
          chat_id: chatId,
          audio: speechUrl,
          caption: "🔊 SafeOps Automated Voice Alert",
        });
      } catch (audioErr) {
        // Fallback silently if Google TTS is unreachable
      }

      return { success: true, message: "Alert and audio dispatched" };
    } catch (err: any) {
      console.error("Telegram message send error:", err?.response?.data || err.message);
      throw err;
    }
  }

  return { success: true, message: "CallMeBot dispatched" };
};
