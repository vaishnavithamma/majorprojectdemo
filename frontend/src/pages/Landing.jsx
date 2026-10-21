import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Shield,
  Zap,
} from "lucide-react";

import { Link } from "react-router-dom";

import SOSButton from "../components/common/SOSButton";

export default function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link to="/" className="landing-logo">
          <div className="logo-icon">
            <Shield size={23} />
          </div>

          <strong>SafeOps</strong>

          <span>v1.0 Production</span>
        </Link>

        <nav>
          <a href="#features">Features</a>
          <a href="#enterprise">Enterprise B2B</a>
          <a href="#pricing">Pricing</a>
          <a href="#security">Security & DPDPA</a>
        </nav>

        <div className="landing-actions">
          <Link to="/auth/login" className="signin-link">
            Sign In
          </Link>

          <Link
            to="/auth/register"
            className="btn btn-primary"
          >
            Launch App
          </Link>
        </div>
      </header>

      <main className="hero">
        <section className="hero-copy">
          <div className="hero-pill">
            <Zap size={16} />
            Autonomous Emergency Response Platform
          </div>

          <h1>
            The system must act
            <br />

            <span>before the user can.</span>
          </h1>

          <p>
            SafeOps instantly detects high-impact
            falls, streams encrypted audio/video
            evidence in 30-second chunks, and
            dispatches real-time location pings to
            verified contacts within 5 seconds.
          </p>

          <div className="hero-buttons">
            <Link
              to="/auth/login"
              className="btn btn-primary btn-large"
            >
              Try Live Dashboard
              <ArrowRight size={18} />
            </Link>

            <button className="btn btn-secondary btn-large">
              <Building2 size={18} />
              B2B Admin Demo
            </button>
          </div>

          <div className="hero-proof">
            <span>
              <CheckCircle2 size={18} />
              5-Second Dispatch SLA
            </span>

            <span>
              <CheckCircle2 size={18} />
              DPDPA Act 2023 Compliant
            </span>
          </div>
        </section>

        <section className="hero-demo">
          <div className="demo-label">
            <span />
            Live Interactive Demo
          </div>

          <SOSButton
            onTriggered={() => {
              console.log("Demo SOS triggered");
            }}
          />
        </section>
      </main>
    </div>
  );
}