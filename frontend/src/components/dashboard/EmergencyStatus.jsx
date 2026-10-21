import {
  CheckCircle2,
  MapPin,
  Radio,
  ShieldCheck,
} from "lucide-react";

export default function EmergencyStatus() {
  return (
    <div className="status-panel">
      <div className="status-panel-header">
        <div>
          <span className="eyebrow">
            PROTECTION STATUS
          </span>

          <h2>You are protected</h2>
        </div>

        <div className="protected-badge">
          <ShieldCheck size={18} />
          ACTIVE
        </div>
      </div>

      <div className="status-grid">
        <div className="status-item">
          <div className="status-icon">
            <Radio size={20} />
          </div>

          <div>
            <strong>Emergency Network</strong>
            <span>Connected</span>
          </div>

          <CheckCircle2 size={18} />
        </div>

        <div className="status-item">
          <div className="status-icon">
            <MapPin size={20} />
          </div>

          <div>
            <strong>Location Sharing</strong>
            <span>Ready for emergency</span>
          </div>

          <CheckCircle2 size={18} />
        </div>
      </div>
    </div>
  );
}