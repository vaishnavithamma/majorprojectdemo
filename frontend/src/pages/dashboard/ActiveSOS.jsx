import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  Radio,
  Shield,
  Users,
  XCircle,
  Video,
  Mic,
  Loader2,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Card from "../../components/common/Card";
import SOSButton from "../../components/common/SOSButton";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const MAX_RECORDING_SECONDS = 30 * 60;

export default function ActiveSOS() {
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remaining
    ).padStart(2, "0")}`;
  };

  // =========================================================
  // GET SUPPORTED MIME TYPE
  // =========================================================

  const getSupportedMimeType = () => {
    if (
      typeof MediaRecorder === "undefined"
    ) {
      return "";
    }

    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "";
  };

  // =========================================================
  // START RECORDING
  // =========================================================

  const startRecording = async () => {
    try {
      setError("");
      setSaved(false);
      setElapsed(0);

      console.log("================================");
      console.log("🚨 STARTING SOS RECORDING");
      console.log("================================");

      console.log(
        "navigator.mediaDevices:",
        navigator.mediaDevices
      );

      console.log(
        "getUserMedia:",
        navigator.mediaDevices?.getUserMedia
      );

      // -----------------------------------------------------
      // CHECK BROWSER SUPPORT
      // -----------------------------------------------------

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Camera and microphone are not supported by this browser."
        );
      }

      if (
        typeof MediaRecorder === "undefined"
      ) {
        throw new Error(
          "MediaRecorder is not supported by this browser."
        );
      }

      // -----------------------------------------------------
      // REQUEST CAMERA + MICROPHONE
      // -----------------------------------------------------

      console.log(
        "🎥 Requesting camera and microphone..."
      );

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: true,
        });

      console.log(
        "✅ Camera and microphone permission granted"
      );

      console.log(
        "Video tracks:",
        stream.getVideoTracks()
      );

      console.log(
        "Audio tracks:",
        stream.getAudioTracks()
      );

      mediaStreamRef.current = stream;

      // Clear previous chunks
      chunksRef.current = [];

      // -----------------------------------------------------
      // SELECT MIME TYPE
      // -----------------------------------------------------

      const mimeType =
        getSupportedMimeType();

      console.log(
        "🎥 Selected MIME type:",
        mimeType
      );

      // -----------------------------------------------------
      // CREATE MEDIA RECORDER
      // IMPORTANT:
      // Do NOT use `const recorder` inside the if block.
      // -----------------------------------------------------

      let recorder;

      if (mimeType) {
        recorder = new MediaRecorder(stream, {
          mimeType,
        });
      } else {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      console.log(
        "🎥 Actual recorder MIME:",
        recorder.mimeType
      );

      // -----------------------------------------------------
      // DATA AVAILABLE
      // -----------------------------------------------------

      recorder.ondataavailable = (event) => {
        console.log(
          "📦 Recording chunk:",
          event.data?.size || 0,
          "bytes"
        );

        if (
          event.data &&
          event.data.size > 0
        ) {
          chunksRef.current.push(
            event.data
          );
        }
      };

      // -----------------------------------------------------
      // RECORDER ERROR
      // -----------------------------------------------------

      recorder.onerror = (event) => {
        console.error(
          "❌ MediaRecorder error:",
          event
        );

        setError(
          "Recording failed. Please check camera and microphone permissions."
        );

        setRecording(false);
      };

      // -----------------------------------------------------
      // RECORDER STOP
      // -----------------------------------------------------

      recorder.onstop = async () => {
        console.log(
          "⏹ MediaRecorder stopped"
        );

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        try {
          await uploadRecording(
            recorder.mimeType
          );
        } catch (error) {
          console.error(
            "❌ Upload after stop failed:",
            error
          );
        }

        // Stop camera
        if (mediaStreamRef.current) {
          mediaStreamRef.current
            .getTracks()
            .forEach((track) => {
              track.stop();
            });

          mediaStreamRef.current = null;
        }

        mediaRecorderRef.current = null;
        setRecording(false);
      };

      // -----------------------------------------------------
      // START RECORDING
      // -----------------------------------------------------

      recorder.start(1000);

      console.log(
        "🔴 RECORDING STARTED"
      );

      setActive(true);
      setRecording(true);
      setSaving(false);
      setElapsed(0);

      // -----------------------------------------------------
      // TIMER
      // -----------------------------------------------------

      timerRef.current = setInterval(() => {
        setElapsed((previous) => {
          const next = previous + 1;

          if (
            next >=
            MAX_RECORDING_SECONDS
          ) {
            console.log(
              "⏰ Maximum 30 minutes reached"
            );

            setTimeout(() => {
              stopRecording();
            }, 0);
          }

          return next;
        });
      }, 1000);

    } catch (error) {
      console.error(
        "❌ Camera/microphone error:",
        error
      );

      setActive(false);
      setRecording(false);

      if (
        error?.name ===
        "NotAllowedError"
      ) {
        setError(
          "Camera and microphone permission was denied. Allow access in Edge and try again."
        );
      } else if (
        error?.name ===
        "NotFoundError"
      ) {
        setError(
          "Camera or microphone was not found."
        );
      } else if (
        error?.name ===
        "NotReadableError"
      ) {
        setError(
          "Camera or microphone is already being used by another application."
        );
      } else {
        setError(
          error?.message ||
            "Unable to start emergency recording."
        );
      }
    }
  };

  const dispatchTelegramSOS = async () => {
    try {
      const token = localStorage.getItem("safeops_token");
      if (!token) return;

      const sendSOS = async (position) => {
        const payload = {
          latitude: position?.coords?.latitude,
          longitude: position?.coords?.longitude,
          accuracy: position?.coords?.accuracy,
        };

        console.log("📍 Sending live GPS to Telegram:", payload);

        await fetch(`${API_URL}/telegram/sos-dispatch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => sendSOS(pos),
          (geoErr) => {
            console.warn("Geolocation denied/unavailable, sending SOS without GPS:", geoErr);
            sendSOS(null);
          },
          { enableHighAccuracy: true, timeout: 7000 }
        );
      } else {
        await sendSOS(null);
      }
    } catch (err) {
      console.error("❌ SOS Telegram dispatch error:", err);
    }
  };

  const activateSOS = async () => {
    console.log(
      "🚨 SOS ACTIVATED"
    );

    setError("");
    setSaved(false);

    // 1. Spoken audio siren through device speakers
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const siren = new SpeechSynthesisUtterance("Emergency alert activated! SafeOps SOS initiated. Help is being notified.");
        siren.rate = 1.05;
        siren.pitch = 1.2;
        window.speechSynthesis.speak(siren);
      }
    } catch (speechErr) {
      console.warn("Speech synthesis error:", speechErr);
    }

    // 2. Instantly dispatch Telegram emergency alert with live GPS coordinates & voice call
    dispatchTelegramSOS();

    // 3. Start audio/video recording
    await startRecording();
  };

  // =========================================================
  // STOP RECORDING
  // =========================================================

  const stopRecording = () => {
    console.log(
      "⏹ STOP & SAVE clicked"
    );

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      console.warn(
        "⚠️ No MediaRecorder found"
      );

      setRecording(false);
      return;
    }

    console.log(
      "Recorder state:",
      recorder.state
    );

    if (
      recorder.state === "recording"
    ) {
      setSaving(true);

      console.log(
        "⏹ Stopping MediaRecorder..."
      );

      /*
       * IMPORTANT:
       * Do not set recording=false here.
       *
       * onstop will upload the complete
       * recording and then set recording=false.
       */

      recorder.stop();
    }
  };

  // =========================================================
  // UPLOAD RECORDING
  // =========================================================

  const uploadRecording = async (
    recorderMimeType
  ) => {
    try {
      console.log("================================");
      console.log(
        "💾 PREPARING RECORDING FOR UPLOAD"
      );
      console.log("================================");

      const chunks =
        chunksRef.current;

      console.log(
        "📦 Number of chunks:",
        chunks.length
      );

      console.log(
        "🎥 Recorder MIME:",
        recorderMimeType
      );

      // -----------------------------------------------------
      // CHECK CHUNKS
      // -----------------------------------------------------

      if (
        !chunks ||
        chunks.length === 0
      ) {
        throw new Error(
          "No recording data was captured."
        );
      }

      // -----------------------------------------------------
      // DETERMINE ACTUAL MIME
      // -----------------------------------------------------

      let finalMimeType =
        recorderMimeType ||
        "video/webm";

      /*
       * Some browsers return:
       * video/webm;codecs=vp8,opus
       *
       * That is perfectly valid.
       *
       * We preserve the actual browser MIME type.
       */

      if (
        !finalMimeType.startsWith(
          "video/"
        )
      ) {
        finalMimeType =
          "video/webm";
      }

      console.log(
        "🎬 Final MIME:",
        finalMimeType
      );

      // -----------------------------------------------------
      // CREATE BLOB
      // -----------------------------------------------------

      const blob = new Blob(
        chunks,
        {
          type: finalMimeType,
        }
      );

      console.log(
        "🎬 Blob type:",
        blob.type
      );

      console.log(
        "🎬 Blob size:",
        blob.size,
        "bytes"
      );

      if (blob.size === 0) {
        throw new Error(
          "Recording is empty."
        );
      }

      // -----------------------------------------------------
      // GET AUTH TOKEN
      // -----------------------------------------------------

      const token =
        localStorage.getItem(
          "safeops_token"
        );

      console.log(
        "🔐 Token exists:",
        Boolean(token)
      );

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      // -----------------------------------------------------
      // CREATE FILE
      // -----------------------------------------------------

      const extension =
        finalMimeType.includes(
          "mp4"
        )
          ? "mp4"
          : "webm";

      const file = new File(
        [blob],
        `emergency-${Date.now()}.${extension}`,
        {
          type: finalMimeType,
          lastModified: Date.now(),
        }
      );

      console.log(
        "📁 File name:",
        file.name
      );

      console.log(
        "📁 File type:",
        file.type
      );

      console.log(
        "📁 File size:",
        file.size
      );

      // -----------------------------------------------------
      // CREATE FORM DATA
      // -----------------------------------------------------

      const formData =
        new FormData();

      formData.append(
        "video",
        file
      );

      formData.append(
        "title",
        "Emergency SOS Recording"
      );

      formData.append(
        "description",
        `Emergency video and audio recording. Duration: ${formatTime(
          elapsed
        )}.`
      );

      // -----------------------------------------------------
      // DEBUG FORMDATA
      // -----------------------------------------------------

      console.log(
        "📦 FormData contents:"
      );

      for (
        const [key, value]
        of formData.entries()
      ) {
        if (
          value instanceof File
        ) {
          console.log(
            "FILE:",
            key,
            value.name,
            value.type,
            value.size
          );
        } else {
          console.log(
            "FIELD:",
            key,
            value
          );
        }
      }

      // -----------------------------------------------------
      // UPLOAD
      // -----------------------------------------------------

      const uploadUrl =
        `${API_URL}/evidence`;

      console.log(
        "📤 Uploading to:",
        uploadUrl
      );

      /*
       * VERY IMPORTANT:
       *
       * Do NOT set:
       *
       * Content-Type:
       * multipart/form-data
       *
       * The browser automatically creates
       * the multipart boundary.
       */

      const response =
        await fetch(
          uploadUrl,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            body: formData,
          }
        );

      console.log(
        "📥 Backend status:",
        response.status
      );

      // -----------------------------------------------------
      // READ RESPONSE
      // -----------------------------------------------------

      const contentType =
        response.headers.get(
          "content-type"
        );

      let data;

      if (
        contentType?.includes(
          "application/json"
        )
      ) {
        data =
          await response.json();
      } else {
        const text =
          await response.text();

        console.error(
          "❌ Backend returned non-JSON:",
          text
        );

        throw new Error(
          text ||
            `Server returned ${response.status}`
        );
      }

      console.log(
        "📥 Backend response:",
        data
      );

      // -----------------------------------------------------
      // CHECK RESPONSE
      // -----------------------------------------------------

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Failed to save emergency recording."
        );
      }

      // -----------------------------------------------------
      // SUCCESS
      // -----------------------------------------------------

      console.log("================================");
      console.log(
        "✅ RECORDING SAVED SUCCESSFULLY"
      );
      console.log("================================");

      console.log(
        "Evidence:",
        data.evidence
      );

      chunksRef.current = [];

      setSaving(false);
      setSaved(true);

      alert(
        "Emergency recording saved successfully."
      );

    } catch (error) {
      console.error(
        "❌ RECORDING UPLOAD FAILED:",
        error
      );

      setSaving(false);

      setError(
        error?.message ||
          "Unable to save emergency recording."
      );
    }
  };

  // =========================================================
  // END EMERGENCY
  // =========================================================

  const endEmergency = () => {
    console.log(
      "🛑 Ending emergency"
    );

    if (recording) {
      stopRecording();
      return;
    }

    setActive(false);
    setSaved(false);
    setElapsed(0);
  };

  // =========================================================
  // CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }

      if (
        mediaRecorderRef.current
      ) {
        const recorder =
          mediaRecorderRef.current;

        if (
          recorder.state !==
          "inactive"
        ) {
          recorder.stop();
        }
      }

      if (
        mediaStreamRef.current
      ) {
        mediaStreamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });
      }
    };
  }, []);

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="dashboard-layout">
      <Header />
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content">

          {/* HEADER */}

          <div className="page-title-row">
            <div>
              <span className="eyebrow">
                EMERGENCY RESPONSE
              </span>

              <h1>
                Active SOS
              </h1>

              <p>
                Monitor and manage your
                emergency response.
              </p>
            </div>

            <div
              className={`response-status ${
                active
                  ? "danger"
                  : "safe"
              }`}
            >
              <span />

              {active
                ? "EMERGENCY ACTIVE"
                : "NO ACTIVE EMERGENCY"}
            </div>
          </div>

          {/* ERROR */}

          {error && (
            <div className="auth-error">
              <AlertTriangle
                size={18}
              />

              <span>
                {error}
              </span>
            </div>
          )}

          {/* MAIN CARD */}

          <Card className="active-sos-card">
            <div className="active-sos-content">

              {/* LEFT */}

              <div className="active-sos-left">

                <div
                  className={`emergency-symbol ${
                    active
                      ? "emergency-active"
                      : ""
                  }`}
                >
                  <AlertTriangle
                    size={48}
                  />
                </div>

                <h2>
                  {active
                    ? "Emergency response active"
                    : "You are currently safe"}
                </h2>

                <p>
                  {active
                    ? "Your emergency recording is active. Video and audio are being captured."
                    : "If you are in immediate danger, press and hold the SOS button for 3 seconds."}
                </p>

                {/* SOS */}

                {!active &&
                  !saving && (
                    <SOSButton
                      onTriggered={
                        activateSOS
                      }
                    />
                  )}

                {/* RECORDING */}

                {recording && (
                  <div className="recording-panel">

                    <div className="recording-status">
                      <span className="recording-dot" />

                      <strong>
                        RECORDING
                      </strong>
                    </div>

                    <div className="recording-time">
                      {formatTime(
                        elapsed
                      )}
                    </div>

                    <div className="recording-limit">
                      Maximum recording:
                      {" "}
                      30:00
                    </div>

                    <div className="recording-features">

                      <span>
                        <Video
                          size={16}
                        />
                        Video
                      </span>

                      <span>
                        <Mic
                          size={16}
                        />
                        Audio
                      </span>

                    </div>

                    <div style={{ display: "flex", gap: "10px", marginTop: "16px", width: "100%" }}>
                      <a
                        href="tel:112"
                        className="cancel-sos-button"
                        style={{
                          backgroundColor: "#dc2626",
                          color: "#ffffff",
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          fontWeight: 700,
                          flex: 1,
                        }}
                      >
                        📞 Dial 112 (Police)
                      </a>

                      <button
                        type="button"
                        className="cancel-sos-button"
                        onClick={stopRecording}
                        style={{ flex: 1 }}
                      >
                        <XCircle size={19} />
                        Stop & Save
                      </button>
                    </div>

                  </div>
                )}

                {/* SAVING */}

                {saving && (
                  <div className="recording-saving">

                    <Loader2
                      size={22}
                      className="spin"
                    />

                    Saving emergency
                    recording...

                  </div>
                )}

                {/* SAVED */}

                {saved &&
                  !saving && (
                    <div className="recording-saving">

                      <CheckCircle2
                        size={22}
                      />

                      Emergency recording
                      saved successfully.

                    </div>
                  )}

                {/* END */}

                {active &&
                  !recording &&
                  !saving && (
                    <button
                      type="button"
                      className="cancel-sos-button"
                      onClick={
                        endEmergency
                      }
                    >
                      <XCircle
                        size={19}
                      />

                      End Emergency
                    </button>
                  )}

              </div>

              {/* TIMELINE */}

              <div className="response-timeline">

                <h3>
                  Emergency sequence
                </h3>

                <div className="timeline">

                  <div className="timeline-item completed">
                    <div className="timeline-icon">
                      <CheckCircle2
                        size={17}
                      />
                    </div>

                    <div>
                      <strong>
                        SOS signal
                      </strong>

                      <span>
                        {active
                          ? "Emergency signal received"
                          : "Waiting for activation"}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`timeline-item ${
                      active
                        ? "completed"
                        : ""
                    }`}
                  >
                    <div className="timeline-icon">
                      <Users
                        size={17}
                      />
                    </div>

                    <div>
                      <strong>
                        Emergency contacts
                      </strong>

                      <span>
                        {active
                          ? "Contacts notified"
                          : "Ready to notify"}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`timeline-item ${
                      active
                        ? "completed"
                        : ""
                    }`}
                  >
                    <div className="timeline-icon">
                      <MapPin
                        size={17}
                      />
                    </div>

                    <div>
                      <strong>
                        Location sharing
                      </strong>

                      <span>
                        {active
                          ? "Live location transmitted"
                          : "Ready for transmission"}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`timeline-item ${
                      active
                        ? "completed"
                        : ""
                    }`}
                  >
                    <div className="timeline-icon">
                      <Radio
                        size={17}
                      />
                    </div>

                    <div>
                      <strong>
                        Response network
                      </strong>

                      <span>
                        {active
                          ? "Response network alerted"
                          : "Standing by"}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </Card>

          {/* INFORMATION */}

          <div className="emergency-info-grid">

            <Card className="info-card">
              <div className="info-card-icon blue">
                <MapPin
                  size={21}
                />
              </div>

              <div>
                <span>
                  LOCATION
                </span>

                <strong>
                  Location protection ready
                </strong>

                <small>
                  GPS coordinates will
                  be shared during an
                  emergency.
                </small>
              </div>
            </Card>

            <Card className="info-card">
              <div className="info-card-icon green">
                <Users
                  size={21}
                />
              </div>

              <div>
                <span>
                  CONTACTS
                </span>

                <strong>
                  Emergency contacts ready
                </strong>

                <small>
                  Your trusted contacts
                  are ready to receive
                  alerts.
                </small>
              </div>
            </Card>

            <Card className="info-card">
              <div className="info-card-icon purple">
                <Shield
                  size={21}
                />
              </div>

              <div>
                <span>
                  PROTECTION
                </span>

                <strong>
                  Encryption enabled
                </strong>

                <small>
                  Emergency communication
                  is securely protected.
                </small>
              </div>
            </Card>

          </div>

          {/* SLA */}

          <Card className="sla-card">

            <div className="sla-icon">
              <Clock3
                size={21}
              />
            </div>

            <div>
              <strong>
                5-second emergency
                dispatch target
              </strong>

              <span>
                SafeOps is designed to
                notify your emergency
                network quickly.
              </span>
            </div>

            <div className="sla-value">
              &lt; 5s
            </div>

          </Card>

        </div>
      </main>
    </div>
  );
}