import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function holdCall(twilioSid: string, host: string) {
  const wsHost = host.replace("https://", "wss://").replace("http://", "ws://");

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="10"/>
  <Say voice="Polly.Amy">Are you still there?</Say>
  <Connect>
    <Stream url="${wsHost}/media-stream">
      <Parameter name="callSid" value="${twilioSid}" />
      <Parameter name="fallback" value="true" />
    </Stream>
  </Connect>
</Response>`;

  try {
    await twilioClient.calls(twilioSid).update({ twiml });
    console.log("Call put on hold", { twilioSid });
  } catch (err) {
    console.error("Failed to put call on hold", twilioSid, err);
  }
}
