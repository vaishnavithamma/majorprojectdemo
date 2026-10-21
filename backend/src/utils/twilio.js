import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const makeTestCall = async (
  phoneNumber
) => {
  const call =
    await client.calls.create({
      from:
        process.env.TWILIO_PHONE_NUMBER,

      to: phoneNumber,

      twiml: `
        <Response>
          <Say>
            This is a test call from SafeOps.
            Your emergency calling system is working.
          </Say>
        </Response>
      `,
    });

  console.log(
    "📞 Twilio call created:",
    call.sid
  );

  return call;
};