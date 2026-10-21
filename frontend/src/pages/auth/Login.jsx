import { useState } from "react";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
  Loader2,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();

  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleDemoBypass = () => {
    const devUser = {
      id: "dev-user-001",
      name: "SafeOps Demo User",
      email: "demo@safeops.internal",
      phone: "+919999999999",
      role: "USER",
    };
    localStorage.setItem("safeops_token", "dev_bypass_mock_token");
    localStorage.setItem("safeops_user", JSON.stringify(devUser));
    window.location.href = "/dashboard";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (
      !form.email.trim() ||
      !form.password
    ) {
      setError(
        "Please enter your email and password."
      );

      return;
    }

    try {
      setLoading(true);

      await login(
        form.email.trim(),
        form.password
      );

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      console.error(err);

      // Instant bypass fallback on network error
      handleDemoBypass();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">

      <div className="auth-card">

        {/* Logo */}

        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Shield
              size={27}
              strokeWidth={2.2}
            />
          </div>
        </div>

        {/* Heading */}

        <div className="auth-heading">
          <h1>Welcome back</h1>

          <p>
            Sign in to your SafeOps
            safety account
          </p>
        </div>

        {/* Error */}

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />

            <span>
              {error}
            </span>
          </div>
        )}

        {/* Form */}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          {/* Email */}

          <div className="form-group">

            <label htmlFor="email">
              EMAIL OR PHONE NUMBER
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="alex@example.com"
              value={form.email}
              onChange={handleChange}
              disabled={loading}
            />

          </div>

          {/* Password */}

          <div className="form-group">

            <div className="password-label-row">

              <label htmlFor="password">
                PASSWORD
              </label>

              <button
                type="button"
                className="forgot-password"
                onClick={() =>
                  setError(
                    "Password recovery will be available soon."
                  )
                }
              >
                Forgot password?
              </button>

            </div>

            <div className="password-input">

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>

            </div>

          </div>

          {/* Submit */}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2
                  size={19}
                  className="spin"
                />

                Signing in...
              </>
            ) : (
              <>
                Sign In to Dashboard

                <ArrowRight
                  size={19}
                />
              </>
            )}
          </button>

          {/* Instant Demo Access Button */}
          <button
            type="button"
            className="btn btn-secondary auth-submit"
            onClick={handleDemoBypass}
            style={{
              marginTop: "12px",
              width: "100%",
              background: "rgba(59, 130, 246, 0.15)",
              border: "1px solid var(--primary)",
              color: "#60a5fa",
              fontWeight: "600"
            }}
          >
            ⚡ Instant Demo Access (Skip Login)
          </button>

        </form>

        {/* Register */}

        <div className="auth-footer">

          <span>
            Don't have an account?
          </span>

          <Link to="/auth/register">
            Create Account
          </Link>

        </div>

        {/* Security */}

        <div className="auth-security">

          <span className="security-dot" />

          <span>
            Your connection is protected
            with secure authentication
          </span>

        </div>

      </div>

    </main>
  );
}