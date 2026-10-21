import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const MAX_RECORDING_SECONDS = 30 * 60;

export async function startEmergencyRecording({
  onStarted,
  onTimeUpdate,
  onSaving,
  onSaved,
  onError,
}) {
  let stream = null;
  let recorder = null;
  let timer = null;

  let elapsed = 0;
  let chunks = [];
  let stopped = false;

  // =====================================================
  // GPS LOCATION
  // =====================================================

  let locationData = {
    latitude: null,
    longitude: null,
  };

  try {
    console.log("=================================");
    console.log("🚨 STARTING EMERGENCY RECORDING");
    console.log("=================================");

    // =====================================================
    // BROWSER SUPPORT
    // =====================================================

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "Camera and microphone are not supported by this browser."
      );
    }

    if (!window.MediaRecorder) {
      throw new Error(
        "MediaRecorder is not supported by this browser."
      );
    }

    console.log(
      "🎥 navigator.mediaDevices:",
      navigator.mediaDevices
    );

    console.log(
      "🎤 getUserMedia:",
      navigator.mediaDevices.getUserMedia
    );

    // =====================================================
    // CAMERA + MICROPHONE
    // =====================================================

    console.log(
      "📷 Requesting camera + microphone permission..."
    );

    stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",

          width: {
            ideal: 1280,
          },

          height: {
            ideal: 720,
          },
        },

        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

    console.log(
      "✅ Camera permission granted"
    );

    console.log(
      "✅ Microphone permission granted"
    );

    console.log(
      "🎥 Video tracks:",
      stream.getVideoTracks()
    );

    console.log(
      "🎤 Audio tracks:",
      stream.getAudioTracks()
    );

    // =====================================================
    // GET GPS LOCATION
    // =====================================================

    console.log(
      "📍 Requesting location permission..."
    );

    if (navigator.geolocation) {
      try {
        const position =
          await new Promise(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 30000,
                }
              );
            }
          );

        locationData = {
          latitude:
            position.coords.latitude,

          longitude:
            position.coords.longitude,
        };

        console.log(
          "📍📍 LOCATION CAPTURED:",
          locationData
        );

        console.log(
          "📍 Accuracy:",
          position.coords.accuracy,
          "meters"
        );
      } catch (locationError) {
        console.warn(
          "⚠️ Location unavailable:",
          locationError.message
        );

        locationData = {
          latitude: null,
          longitude: null,
        };
      }
    } else {
      console.warn(
        "⚠️ Geolocation is not supported by this browser."
      );
    }

    // =====================================================
    // SELECT RECORDING FORMAT
    // =====================================================

    const supportedTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    let mimeType = "";

    for (const type of supportedTypes) {
      if (
        MediaRecorder.isTypeSupported(
          type
        )
      ) {
        mimeType = type;
        break;
      }
    }

    if (!mimeType) {
      throw new Error(
        "This browser does not support WebM video recording."
      );
    }

    console.log(
      "🎬 Selected recording format:",
      mimeType
    );

    // =====================================================
    // CREATE MEDIA RECORDER
    // =====================================================

    recorder = new MediaRecorder(
      stream,
      {
        mimeType,

        videoBitsPerSecond: 2500000,

        audioBitsPerSecond: 128000,
      }
    );

    console.log(
      "✅ MediaRecorder created"
    );

    // =====================================================
    // COLLECT RECORDING CHUNKS
    // =====================================================

    recorder.ondataavailable = (
      event
    ) => {
      console.log(
        "📦 Recording chunk:",
        event.data.size,
        "bytes",
        event.data.type
      );

      if (
        event.data &&
        event.data.size > 0
      ) {
        chunks.push(event.data);
      }
    };

    // =====================================================
    // HANDLE RECORDER ERROR
    // =====================================================

    recorder.onerror = (event) => {
      console.error(
        "❌ MediaRecorder error:",
        event
      );

      cleanup();

      onError?.(
        "Recording failed."
      );
    };

    // =====================================================
    // START RECORDING
    // =====================================================

    recorder.start(1000);

    console.log(
      "🔴🔴🔴 RECORDING STARTED 🔴🔴🔴"
    );

    console.log(
      "🎥 MIME:",
      recorder.mimeType
    );

    onStarted?.();

    // =====================================================
    // TIMER
    // =====================================================

    timer = setInterval(() => {
      elapsed += 1;

      onTimeUpdate?.(elapsed);

      console.log(
        `⏱️ Recording: ${elapsed}s`
      );

      // Automatically stop after 30 minutes
      if (
        elapsed >=
        MAX_RECORDING_SECONDS
      ) {
        console.log(
          "⏰ 30-MINUTE LIMIT REACHED"
        );

        stop();
      }
    }, 1000);

    // =====================================================
    // STOP RECORDING
    // =====================================================

    function stop() {
      if (stopped) {
        return;
      }

      stopped = true;

      console.log(
        "================================="
      );

      console.log(
        "⏹ STOPPING EMERGENCY RECORDING"
      );

      console.log(
        "================================="
      );

      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      if (
        recorder &&
        recorder.state !== "inactive"
      ) {
        console.log(
          "⏹ Calling recorder.stop()..."
        );

        recorder.stop();
      }
    }

    // =====================================================
    // CLEANUP CAMERA + MICROPHONE
    // =====================================================

    function cleanup() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      if (stream) {
        stream
          .getTracks()
          .forEach((track) => {
            track.stop();

            console.log(
              `🛑 ${track.kind} track stopped`
            );
          });

        stream = null;
      }

      console.log(
        "📷 Camera and microphone stopped"
      );
    }

    // =====================================================
    // WHEN RECORDING STOPS
    // =====================================================

    recorder.onstop = async () => {
      console.log(
        "================================="
      );

      console.log(
        "⏹ MEDIARECORDER STOPPED"
      );

      console.log(
        "================================="
      );

      cleanup();

      try {
        // =================================================
        // CHECK CHUNKS
        // =================================================

        console.log(
          "📦 Total chunks:",
          chunks.length
        );

        if (chunks.length === 0) {
          throw new Error(
            "No recording data was produced."
          );
        }

        // =================================================
        // CREATE WEBM BLOB
        // =================================================

        const blob = new Blob(
          chunks,
          {
            type: "video/webm",
          }
        );

        console.log(
          "🎥 Final recording size:",
          blob.size,
          "bytes"
        );

        console.log(
          "🎥 Final recording type:",
          blob.type
        );

        if (blob.size === 0) {
          throw new Error(
            "Recording is empty."
          );
        }

        // =================================================
        // CREATE FILE
        // =================================================

        const fileName =
          `emergency-${Date.now()}.webm`;

        const file = new File(
          [blob],
          fileName,
          {
            type: "video/webm",

            lastModified:
              Date.now(),
          }
        );

        console.log(
          "📁 File created:",
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

        // =================================================
        // START SAVING
        // =================================================

        onSaving?.();

        console.log(
          "💾 SAVING RECORDING..."
        );

        // =================================================
        // AUTH TOKEN
        // =================================================

        const token =
          localStorage.getItem(
            "safeops_token"
          );

        if (!token) {
          throw new Error(
            "Authentication token not found. Please login again."
          );
        }

        console.log(
          "🔐 Authentication token found"
        );

        // =================================================
        // FORM DATA
        // =================================================

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
          `Emergency recording captured for ${elapsed} seconds.`
        );

        // =================================================
        // ADD GPS LOCATION
        // =================================================

        if (
          locationData.latitude !== null &&
          locationData.longitude !== null
        ) {
          formData.append(
            "latitude",
            String(
              locationData.latitude
            )
          );

          formData.append(
            "longitude",
            String(
              locationData.longitude
            )
          );

          console.log(
            "📍 Adding location to upload:",
            locationData
          );
        } else {
          console.log(
            "📍 No location available for this recording."
          );
        }

        // =================================================
        // DEBUG FORMDATA
        // =================================================

        console.log(
          "📤 FormData contents:"
        );

        for (
          const [key, value]
          of formData.entries()
        ) {
          console.log(
            key,
            value
          );
        }

        // =================================================
        // UPLOAD
        // =================================================

        console.log(
          "📤 UPLOADING RECORDING..."
        );

        console.log(
          "📤 URL:",
          `${API_URL}/evidence`
        );

        const response =
          await axios.post(
            `${API_URL}/evidence`,
            formData,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              withCredentials: true,

              // IMPORTANT:
              // Do NOT set Content-Type manually.
              // Browser/Axios creates multipart boundary.
            }
          );

        console.log(
          "================================="
        );

        console.log(
          "📥 BACKEND RESPONSE:"
        );

        console.log(
          response.data
        );

        console.log(
          "================================="
        );

        // =================================================
        // CHECK RESPONSE
        // =================================================

        if (
          !response.data ||
          !response.data.success
        ) {
          throw new Error(
            response.data?.message ||
              "Backend failed to save recording."
          );
        }

        console.log(
          "✅✅✅ RECORDING SAVED SUCCESSFULLY ✅✅✅"
        );

        console.log(
          "🗄️ Evidence:",
          response.data.evidence
        );

        onSaved?.(
          response.data
        );

      } catch (error) {
        console.error(
          "================================="
        );

        console.error(
          "❌ RECORDING UPLOAD FAILED"
        );

        console.error(
          "================================="
        );

        console.error(
          "Error:",
          error
        );

        console.error(
          "Response:",
          error?.response?.data
        );

        const message =
          error?.response?.data
            ?.message ||
          error?.message ||
          "Failed to save recording.";

        onError?.(
          message
        );
      }
    };

    // =====================================================
    // RETURN CONTROLLER
    // =====================================================

    return {
      stop,
    };

  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "❌ EMERGENCY RECORDING START FAILED"
    );

    console.error(
      "================================="
    );

    console.error(
      error
    );

    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    if (stream) {
      stream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      stream = null;
    }

    onError?.(
      error?.message ||
        "Unable to start recording."
    );

    return null;
  }
}