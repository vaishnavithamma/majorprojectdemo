import { useState } from "react";
import {
  Bell,
  Check,
  Clock3,
  MapPin,
  Mic,
  Radio,
  Save,
  Shield,
  Smartphone,
  Volume2,
} from "lucide-react";

import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Card from "../../components/common/Card";

export default function SOSSettings() {
  const [settings, setSettings] =
    useState({
      location: true,
      audio: true,
      vibration: true,
      notifications: true,
      countdown: true,
      autoRecord: true,
    });

  const [saved, setSaved] = useState(false);

  const toggle = (key) => {
    setSettings((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));

    setSaved(false);
  };

  const saveSettings = () => {
    setSaved(true);

    console.log(
      "SOS settings:",
      settings
    );

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  return (
    <div className="dashboard-layout">
      <Header />

      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content">

          <div className="page-title-row">
            <div>
              <span className="eyebrow">
                EMERGENCY CONFIGURATION
              </span>

              <h1>SOS Settings</h1>

              <p>
                Configure how SafeOps responds when
                an emergency is activated.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={saveSettings}
            >
              {saved ? (
                <Check size={18} />
              ) : (
                <Save size={18} />
              )}

              {saved
                ? "Settings Saved"
                : "Save Settings"}
            </button>
          </div>

          {/* Emergency behavior */}

          <Card className="settings-card">
            <div className="settings-heading">
              <div className="settings-heading-icon blue">
                <Shield size={20} />
              </div>

              <div>
                <h2>
                  Emergency behavior
                </h2>

                <p>
                  Choose what happens when you
                  activate SOS.
                </p>
              </div>
            </div>

            <div className="settings-list">

              <Setting
                icon={<MapPin size={18} />}
                title="Share live location"
                description="Send your current location to emergency contacts."
                enabled={settings.location}
                onToggle={() =>
                  toggle("location")
                }
              />

              <Setting
                icon={<Mic size={18} />}
                title="Capture audio evidence"
                description="Begin secure audio recording during an emergency."
                enabled={settings.audio}
                onToggle={() =>
                  toggle("audio")
                }
              />

              <Setting
                icon={<Radio size={18} />}
                title="Automatic evidence capture"
                description="Securely preserve emergency evidence."
                enabled={settings.autoRecord}
                onToggle={() =>
                  toggle("autoRecord")
                }
              />

              <Setting
                icon={<Bell size={18} />}
                title="Emergency notifications"
                description="Notify your verified emergency contacts."
                enabled={settings.notifications}
                onToggle={() =>
                  toggle("notifications")
                }
              />

            </div>
          </Card>

          {/* Device behavior */}

          <Card className="settings-card">
            <div className="settings-heading">
              <div className="settings-heading-icon purple">
                <Smartphone size={20} />
              </div>

              <div>
                <h2>
                  Device behavior
                </h2>

                <p>
                  Configure feedback from your device.
                </p>
              </div>
            </div>

            <div className="settings-list">

              <Setting
                icon={<Volume2 size={18} />}
                title="SOS sound"
                description="Play an audible confirmation when SOS starts."
                enabled={settings.vibration}
                onToggle={() =>
                  toggle("vibration")
                }
              />

              <Setting
                icon={<Smartphone size={18} />}
                title="Vibration feedback"
                description="Use vibration to confirm SOS activation."
                enabled={settings.vibration}
                onToggle={() =>
                  toggle("vibration")
                }
              />

              <Setting
                icon={<Bell size={18} />}
                title="Push notifications"
                description="Receive alerts about your safety network."
                enabled={settings.notifications}
                onToggle={() =>
                  toggle("notifications")
                }
              />

            </div>
          </Card>

          {/* Countdown */}

          <Card className="settings-card">

            <div className="settings-heading">
              <div className="settings-heading-icon orange">
                <Clock3 size={20} />
              </div>

              <div>
                <h2>
                  SOS activation
                </h2>

                <p>
                  Prevent accidental emergency alerts.
                </p>
              </div>
            </div>

            <div className="countdown-setting">

              <div>
                <strong>
                  Activation countdown
                </strong>

                <span>
                  Require a 3-second hold before
                  activating SOS.
                </span>
              </div>

              <button
                className={`toggle ${
                  settings.countdown
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  toggle("countdown")
                }
              >
                <span />
              </button>

            </div>

            <div className="countdown-preview">
              <span>
                Current activation time
              </span>

              <strong>
                3 seconds
              </strong>
            </div>

          </Card>

          {/* Privacy */}

          <div className="privacy-note">
            <Shield size={17} />

            <div>
              <strong>
                Privacy & security
              </strong>

              <span>
                Your SOS settings are stored securely.
                Location and evidence are only shared
                when required by your configured
                emergency workflow.
              </span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function Setting({
  icon,
  title,
  description,
  enabled,
  onToggle,
}) {
  return (
    <div className="setting-row">

      <div className="setting-icon">
        {icon}
      </div>

      <div className="setting-content">
        <strong>{title}</strong>

        <span>
          {description}
        </span>
      </div>

      <button
        className={`toggle ${
          enabled ? "active" : ""
        }`}
        onClick={onToggle}
        aria-label={`Toggle ${title}`}
      >
        <span />
      </button>

    </div>
  );
}