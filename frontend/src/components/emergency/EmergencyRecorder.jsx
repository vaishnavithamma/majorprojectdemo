import {
  useEffect,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  Video,
  Square,
  Mic,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const MAX_RECORDING_TIME =
  30 * 60 * 1000;

export default function EmergencyRecorder({
  onSaved,
}) {
  const mediaRecorderRef =
    useRef(null);

  const streamRef =
    useRef(null);

  const chunksRef =
    useRef([]);

  const timerRef =
    useRef(null);

  const startTimeRef =
    useRef(null);

  // Keep the latest elapsed value
  // available inside callbacks.
  const elapsedRef =
    useRef(0);

  // GPS coordinates
  const locationRef =
    useRef({
      latitude: null,
      longitude: null,
    });

  const [recording, setRecording] =
    useState(false);

  const [stopping, setStopping] =
    useState(false);

  const [elapsed, setElapsed] =
    useState(0);

  const [error, setError] =
    useState("");

  // =========================================================
  // GET CURRENT LOCATION
  // =========================================================

  const getCurrentLocation = () => {
    return new Promise((resolve) => {
      if (
        !navigator.geolocation
      ) {
        console.warn(
          "Geolocation is not supported."
        );

        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude =
            position.coords.latitude;

          const longitude =
            position.coords.longitude;

          console.log(
            "📍 Location captured:",
            {
              latitude,
              longitude,
            }
          );

          locationRef.current = {
            latitude,
            longitude,
          };

          resolve({
            latitude,
            longitude,
          });
        },

        (locationError) => {
          console.warn(
            "⚠️ Location unavailable:",
            locationError.message
          );

          locationRef.current = {
            latitude: null,
            longitude: null,
          };

          // Do NOT stop emergency recording
          // if location permission fails.
          resolve(null);
        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    });
  };

  // =========================================================
  // START RECORDING
  // =========================================================

  const startRecording = async () => {
    try {
      setError("");

      console.log(
        "🚨 Starting emergency recording..."
      );

      // -----------------------------------------------------
      // CAMERA + MICROPHONE
      // -----------------------------------------------------

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      streamRef.current = stream;

      console.log(
        "📷 Camera permission granted"
      );

      console.log(
        "🎤 Microphone permission granted"
      );

      // -----------------------------------------------------
      // LOCATION
      // -----------------------------------------------------

      console.log(
        "📍 Requesting location..."
      );

      await getCurrentLocation();

      // -----------------------------------------------------
      // RESET RECORDING DATA
      // -----------------------------------------------------

      chunksRef.current = [];

      elapsedRef.current = 0;

      setElapsed(0);

      // -----------------------------------------------------
      // RECORDING FORMAT
      // -----------------------------------------------------

      let mimeType =
        "video/webm;codecs=vp9,opus";

      if (
        !MediaRecorder.isTypeSupported(
          mimeType
        )
      ) {
        mimeType =
          "video/webm;codecs=vp8,opus";
      }

      if (
        !MediaRecorder.isTypeSupported(
          mimeType
        )
      ) {
        mimeType =
          "video/webm";
      }

      console.log(
        "🎬 Recording format:",
        mimeType
      );

      // -----------------------------------------------------
      // MEDIA RECORDER
      // -----------------------------------------------------

      const recorder =
        new MediaRecorder(
          stream,
          {
            mimeType,
          }
        );

      mediaRecorderRef.current =
        recorder;

      // -----------------------------------------------------
      // DATA AVAILABLE
      // -----------------------------------------------------

      recorder.ondataavailable =
        (event) => {
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
      // STOP HANDLER
      // -----------------------------------------------------

      recorder.onstop = async () => {
        console.log(
          "⏹ MediaRecorder stopped"
        );

        // Stop camera + microphone
        if (streamRef.current) {
          console.log(
            "📷 Stopping camera and microphone..."
          );

          streamRef.current
            .getTracks()
            .forEach((track) => {
              track.stop();
            });

          streamRef.current = null;
        }

        await saveRecording(
          mimeType
        );
      };

      // -----------------------------------------------------
      // RECORDER ERROR
      // -----------------------------------------------------

      recorder.onerror = (event) => {
        console.error(
          "❌ MediaRecorder error:",
          event
        );

        clearInterval(
          timerRef.current
        );

        if (streamRef.current) {
          streamRef.current
            .getTracks()
            .forEach((track) => {
              track.stop();
            });

          streamRef.current = null;
        }

        setRecording(false);
        setStopping(false);

        setError(
          "Recording failed."
        );
      };

      // -----------------------------------------------------
      // START
      // -----------------------------------------------------

      recorder.start(1000);

      console.log(
        "🔴 RECORDING STARTED"
      );

      startTimeRef.current =
        Date.now();

      setElapsed(0);
      setRecording(true);

      // -----------------------------------------------------
      // TIMER
      // -----------------------------------------------------

      timerRef.current =
        setInterval(() => {
          if (
            !startTimeRef.current
          ) {
            return;
          }

          const elapsedTime =
            Date.now() -
            startTimeRef.current;

          const seconds =
            Math.floor(
              elapsedTime / 1000
            );

          elapsedRef.current =
            seconds;

          setElapsed(seconds);

          // Automatically stop after 30 minutes
          if (
            elapsedTime >=
            MAX_RECORDING_TIME
          ) {
            console.log(
              "⏰ 30-minute limit reached."
            );

            stopRecording();
          }
        }, 1000);

    } catch (err) {
      console.error(
        "❌ Recording error:",
        err
      );

      // Clean up stream if starting fails
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        streamRef.current = null;
      }

      setRecording(false);

      setError(
        "Camera and microphone permission is required to start emergency recording."
      );
    }
  };

  // =========================================================
  // STOP RECORDING
  // =========================================================

  const stopRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (
      !recorder ||
      recorder.state ===
        "inactive"
    ) {
      return;
    }

    console.log(
      "⏹ Stopping emergency recording..."
    );

    setStopping(true);

    clearInterval(
      timerRef.current
    );

    timerRef.current = null;

    setRecording(false);

    // IMPORTANT:
    // Do NOT stop the stream here.
    // recorder.onstop will stop the
    // camera and microphone after
    // the final recording data is ready.

    recorder.stop();
  };

  // =========================================================
  // SAVE RECORDING
  // =========================================================

  const saveRecording = async (
    mimeType
  ) => {
    try {
      console.log(
        "💾 Preparing recording..."
      );

      const blob =
        new Blob(
          chunksRef.current,
          {
            type: mimeType,
          }
        );

      console.log(
        "🎥 Recording size:",
        blob.size,
        "bytes"
      );

      if (
        blob.size === 0
      ) {
        throw new Error(
          "Recording is empty."
        );
      }

      // -----------------------------------------------------
      // LOCATION
      // -----------------------------------------------------

      const {
        latitude,
        longitude,
      } = locationRef.current;

      console.log(
        "📍 Location being uploaded:",
        {
          latitude,
          longitude,
        }
      );

      // -----------------------------------------------------
      // FORM DATA
      // -----------------------------------------------------

      const formData =
        new FormData();

      formData.append(
        "video",
        blob,
        `emergency-${Date.now()}.webm`
      );

      formData.append(
        "title",
        "Emergency SOS Recording"
      );

      formData.append(
        "description",
        `Emergency recording captured for ${formatTime(
          elapsedRef.current
        )}.`
      );

      // Only send location when
      // it was successfully captured.
      if (
        latitude !== null &&
        longitude !== null
      ) {
        formData.append(
          "latitude",
          String(latitude)
        );

        formData.append(
          "longitude",
          String(longitude)
        );
      }

      // -----------------------------------------------------
      // AUTH TOKEN
      // -----------------------------------------------------

      const token =
        localStorage.getItem(
          "safeops_token"
        );

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      // -----------------------------------------------------
      // UPLOAD
      // -----------------------------------------------------

      console.log(
        "📤 Uploading emergency recording..."
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

            withCredentials:
              true,
          }
        );

      console.log(
        "📥 Backend response:",
        response.data
      );

      if (
        !response.data.success
      ) {
        throw new Error(
          response.data.message ||
            "Unable to save recording."
        );
      }

      console.log(
        "✅ Emergency recording saved successfully."
      );

      chunksRef.current = [];

      if (onSaved) {
        onSaved(
          response.data.evidence
        );
      }

    } catch (err) {
      console.error(
        "❌ Save recording error:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Unable to save emergency recording."
      );

    } finally {
      setStopping(false);
    }
  };

  // =========================================================
  // CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      clearInterval(
        timerRef.current
      );

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        streamRef.current = null;
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current
          .state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (
    seconds
  ) => {
    const minutes =
      Math.floor(
        seconds / 60
      );

    const remainingSeconds =
      seconds % 60;

    return `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      remainingSeconds
    ).padStart(
      2,
      "0"
    )}`;
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div>

      {!recording &&
        !stopping && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={
              startRecording
            }
          >
            <AlertTriangle
              size={20}
            />

            Emergency
          </button>
        )}

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
            Maximum recording time:
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


          <button
            type="button"
            className="btn btn-danger"
            onClick={
              stopRecording
            }
          >
            <Square
              size={18}
            />

            Stop & Save
          </button>

        </div>
      )}


      {stopping && (
        <div className="recording-saving">

          <Loader2
            size={22}
            className="spin"
          />

          Saving emergency
          recording...

        </div>
      )}


      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}

    </div>
  );
}