import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";

const HOLD_TIME = 3000;

export default function SOSButton({ onTriggered }) {
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const startHold = (event) => {
    event.preventDefault();

    if (active || timerRef.current) {
      return;
    }

    console.log("🟡 SOS button pressed");

    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed =
        Date.now() - startTimeRef.current;

      const percentage = Math.min(
        (elapsed / HOLD_TIME) * 100,
        100
      );

      setProgress(percentage);

      if (elapsed >= HOLD_TIME) {
        clearInterval(timerRef.current);
        timerRef.current = null;

        console.log("🔴 3 SECONDS COMPLETED");
        console.log("🚨 TRIGGERING SOS");

        setActive(true);
        setProgress(100);

        onTriggered?.();

        setTimeout(() => {
          setActive(false);
          setProgress(0);
        }, 4000);
      }
    }, 30);
  };

  const stopHold = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;

      console.log("🟢 SOS button released");
    }

    if (!active) {
      setProgress(0);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <div className="sos-button-wrapper">
      <button
        type="button"
        className={`sos-button ${
          active ? "sos-active" : ""
        }`}
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Hold for 3 seconds to activate SOS"
      >
        <div
          className="sos-progress"
          style={{
            transform: `scale(${1 + progress / 500})`,
            opacity: progress / 150,
          }}
        />

        <ShieldAlert
          size={58}
          strokeWidth={2}
        />

        <strong>
          {active ? "ACTIVE" : "SOS"}
        </strong>

        <span>
          {active
            ? "ALERT SENT"
            : "PRESS & HOLD 3S"}
        </span>
      </button>

      <p className="sos-help">
        {active
          ? "Emergency sequence initiated"
          : "Hold for 3 seconds to initiate emergency sequence"}
      </p>
    </div>
  );
}