import twilio from "twilio";

const accountSid =
  process.env.TWILIO_ACCOUNT_SID;

const authToken =
  process.env.TWILIO_AUTH_TOKEN;

const twilioPhoneNumber =
  process.env.TWILIO_PHONE_NUMBER;

if (
  !accountSid ||
  !authToken ||
  !twilioPhoneNumber
) {
  console.warn(
    "⚠️ Twilio environment variables are not fully configured."
  );
}

const client =
  accountSid && authToken
    ? twilio(
        accountSid,
        authToken
      )
    : null;

export const makeEmergencyCall = async (
  phoneNumber: string,
  contactName: string,
  relation: string
) => {
  if (!client) {
    throw new Error(
      "Twilio is not configured. Check your .env file."
    );
  }

  if (!twilioPhoneNumber) {
    throw new Error(
      "TWILIO_PHONE_NUMBER is missing."
    );
  }

  if (!phoneNumber) {
    throw new Error(
      "Phone number is required."
    );
  }

  const name =
    contactName?.trim() || "the person";

  const contactRelation =
    relation?.trim() || "your emergency contact";

  console.log(
    "📞 Emergency call details:",
    {
      phoneNumber,
      contactName: name,
      relation: contactRelation,
    }
  );

  const call =
    await client.calls.create({
      from: twilioPhoneNumber,
      to: phoneNumber,
      twiml: `<Response><Say>Emergency alert from SafeOps. Your contact ${name} has activated an SOS and needs assistance. Please check on them immediately.</Say></Response>`,
    });

  console.log(
    "📞 SafeOps emergency call created:",
    call.sid
  );

  return call;
};