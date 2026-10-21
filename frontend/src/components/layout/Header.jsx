import {
  Bell,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  BatteryCharging,
  Search,
  Shield,
  Wifi,
} from "lucide-react";

import { useEffect, useState } from "react";

export default function Header() {
  const [notifications, setNotifications] =
    useState(false);

  const [battery, setBattery] =
    useState(null);

  const [charging, setCharging] =
    useState(false);

  // =====================================================
  // BATTERY STATUS
  // =====================================================

  useEffect(() => {
    let batteryManager;

    const updateBattery = () => {
      if (!batteryManager) return;

      setBattery(
        Math.round(
          batteryManager.level * 100
        )
      );

      setCharging(
        batteryManager.charging
      );
    };

    const getBattery = async () => {
      try {
        if (
          !navigator.getBattery
        ) {
          console.log(
            "Battery Status API is not supported."
          );

          return;
        }

        batteryManager =
          await navigator.getBattery();

        updateBattery();

        batteryManager.addEventListener(
          "levelchange",
          updateBattery
        );

        batteryManager.addEventListener(
          "chargingchange",
          updateBattery
        );
      } catch (error) {
        console.error(
          "Battery status error:",
          error
        );
      }
    };

    getBattery();

    return () => {
      if (!batteryManager) return;

      batteryManager.removeEventListener(
        "levelchange",
        updateBattery
      );

      batteryManager.removeEventListener(
        "chargingchange",
        updateBattery
      );
    };
  }, []);

  // =====================================================
  // BATTERY ICON
  // =====================================================

  const getBatteryIcon = () => {
    if (charging) {
      return (
        <BatteryCharging
          size={17}
        />
      );
    }

    if (battery === null) {
      return (
        <BatteryMedium
          size={17}
        />
      );
    }

    if (battery <= 15) {
      return (
        <BatteryWarning
          size={17}
        />
      );
    }

    if (battery <= 35) {
      return (
        <BatteryLow
          size={17}
        />
      );
    }

    if (battery >= 80) {
      return (
        <BatteryFull
          size={17}
        />
      );
    }

    return (
      <BatteryMedium
        size={17}
      />
    );
  };

  return (
    <header className="dashboard-header">

      {/* =================================================
          LOGO
          ================================================= */}

      <div className="header-brand">
        <div className="header-logo">
          <Shield size={21} />
        </div>

        <div className="header-brand-name">
          <strong>
            SafeOps
          </strong>

          <span>/</span>

          <span>
            Dashboard
          </span>
        </div>
      </div>

      {/* =================================================
          RIGHT SIDE
          ================================================= */}

      <div className="header-actions">

        {/* Search */}

        <button className="header-search">
          <Search size={16} />

          <span>
            Search
          </span>

          <kbd>
            ⌘K
          </kbd>
        </button>

        {/* =================================================
            DEVICE STATUS
            ================================================= */}

        <div className="device-status">

          {/* Connection */}

          <div className="connection">
            <span className="status-dot" />

            <span>
              4G
            </span>
          </div>

          {/* Battery */}

          <div
            className={`battery ${
              battery !== null &&
              battery <= 15
                ? "battery-critical"
                : ""
            } ${
              charging
                ? "battery-charging"
                : ""
            }`}
          >
            {getBatteryIcon()}

            <span>
              {battery !== null
                ? `${battery}%`
                : "—"}
            </span>
          </div>

        </div>

        {/* =================================================
            NOTIFICATIONS
            ================================================= */}

        <div className="notification-wrapper">

          <button
            className="notification-button"
            onClick={() =>
              setNotifications(
                !notifications
              )
            }
          >
            <Bell size={20} />

            <span className="notification-dot" />
          </button>

          {notifications && (
            <div className="notification-panel">

              <div className="notification-header">
                <strong>
                  Notifications
                </strong>

                <span>
                  2 new
                </span>
              </div>

              <div className="notification-item">

                <div className="notification-icon blue">
                  <Shield size={15} />
                </div>

                <div>
                  <strong>
                    SafeOps is active
                  </strong>

                  <span>
                    Your safety network is ready.
                  </span>
                </div>

              </div>

              <div className="notification-item">

                <div className="notification-icon green">
                  <Wifi size={15} />
                </div>

                <div>
                  <strong>
                    Location connected
                  </strong>

                  <span>
                    Live location is available.
                  </span>
                </div>

              </div>

              <button className="view-notifications">
                View all notifications
              </button>

            </div>
          )}

        </div>

      </div>

    </header>
  );
}