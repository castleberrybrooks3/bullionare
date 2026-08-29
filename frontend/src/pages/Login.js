import "./Login.css";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const CURRENT_TERMS_VERSION = "2026-08-08";
const CURRENT_PRIVACY_VERSION = "2026-08-08";
const GUEST_ACCESS_KEY = "bullionaire_guest_access";

function createGuestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `guest_${crypto.randomUUID()}`;
  }

  return `guest_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function readGuestAccess() {
  try {
    const stored = localStorage.getItem(GUEST_ACCESS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function hasCurrentGuestConsent() {
  const guestAccess = readGuestAccess();

  return Boolean(
    guestAccess?.accepted === true &&
      typeof guestAccess?.guestId === "string" &&
      guestAccess.guestId.length > 0 &&
      guestAccess.termsVersion === CURRENT_TERMS_VERSION &&
      guestAccess.privacyVersion === CURRENT_PRIVACY_VERSION &&
      typeof guestAccess.acceptedAt === "string"
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState(
    location.state?.confirmationMessage || ""
  );

  const [showGuestConsent, setShowGuestConsent] = useState(false);
  const [guestAgreedToLegal, setGuestAgreedToLegal] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestErrorMsg, setGuestErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session || null;

      if (!mounted || !session) {
        return;
      }

      const isAnonymous = session.user?.is_anonymous === true;

      // Permanent accounts can go straight to the workspace. Anonymous users
      // must also have accepted the current guest legal versions in this browser.
      if (!isAnonymous || hasCurrentGuestConsent()) {
        navigate("/dashboard", { replace: true });
      }
    };

    checkUser();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setErrorMsg(
          "Please check your email and confirm your account before signing in."
        );
      } else {
        setErrorMsg(error.message);
      }
      return;
    }

    // A permanent account no longer needs the browser's guest-consent record.
    localStorage.removeItem(GUEST_ACCESS_KEY);
    navigate("/dashboard", { replace: true });
  };

  const handleOpenGuestConsent = () => {
    setGuestAgreedToLegal(false);
    setGuestErrorMsg("");
    setShowGuestConsent(true);
  };

  const handleCloseGuestConsent = () => {
    if (guestLoading) {
      return;
    }

    setShowGuestConsent(false);
    setGuestAgreedToLegal(false);
    setGuestErrorMsg("");
  };

  const handleContinueAsGuest = async () => {
    if (!guestAgreedToLegal) {
      setGuestErrorMsg(
        "You must agree to the Terms of Service and acknowledge the Privacy Policy to continue."
      );
      return;
    }

    setGuestLoading(true);
    setGuestErrorMsg("");

    try {
      const existingGuestAccess = readGuestAccess();
      const guestId = existingGuestAccess?.guestId || createGuestId();
      const acceptedAt = new Date().toISOString();

      const { data: existingSessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      let session = existingSessionData?.session || null;

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously({
          options: {
            data: {
              bullionaire_guest: true,
              guest_id: guestId,
              accepted_terms_version: CURRENT_TERMS_VERSION,
              accepted_privacy_version: CURRENT_PRIVACY_VERSION,
              accepted_at: acceptedAt,
            },
          },
        });

        if (error || !data?.session) {
          throw error || new Error("Guest session could not be created.");
        }

        session = data.session;
      }

      // If a permanent account somehow reaches this action, treat it as signed in
      // rather than replacing the permanent session with an anonymous identity.
      if (session.user?.is_anonymous !== true) {
        localStorage.removeItem(GUEST_ACCESS_KEY);
        setShowGuestConsent(false);
        navigate("/dashboard", { replace: true });
        return;
      }

      const guestAccess = {
        guestId,
        accepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt,
        supabaseUserId: session.user?.id || null,
      };

      localStorage.setItem(GUEST_ACCESS_KEY, JSON.stringify(guestAccess));

      setShowGuestConsent(false);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const detail = String(error?.message || error || "");
      const anonymousDisabled =
        detail.toLowerCase().includes("anonymous") &&
        detail.toLowerCase().includes("disabled");

      setGuestErrorMsg(
        anonymousDisabled
          ? "Guest access is temporarily unavailable. Please create an account or sign in."
          : detail || "Guest access could not be started. Please try again."
      );
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Welcome</h1>
        <p>Sign in to access Bullionaire</p>

        <form className="login-form" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <span
              className="eye-icon"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "📈" : "👁"}
            </span>
          </div>

          <button type="submit" disabled={loading || guestLoading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {infoMsg && <p className="auth-success">{infoMsg}</p>}
        {errorMsg && <p className="auth-error">{errorMsg}</p>}

        <div className="guest-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="guest-button"
          onClick={handleOpenGuestConsent}
          disabled={loading || guestLoading}
        >
          Continue as Guest
        </button>

        <div className="login-footer">
          <p>
            Don&apos;t have an account?{" "}
            <span onClick={() => navigate("/account-type")}>Create one</span>
          </p>
        </div>
      </div>

      {showGuestConsent && (
        <div
          className="guest-consent-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseGuestConsent();
            }
          }}
        >
          <div className="guest-consent-card">
            <button
              type="button"
              className="guest-consent-close"
              onClick={handleCloseGuestConsent}
              aria-label="Close"
              disabled={guestLoading}
            >
              ×
            </button>

            <h2>Continue as Guest</h2>

            <p className="guest-consent-description">
              Explore Bullionaire without creating an account. Guest access may
              not include account-specific features such as saved preferences,
              watchlists, or alerts.
            </p>

            <label className="guest-legal-checkbox">
              <input
                type="checkbox"
                checked={guestAgreedToLegal}
                disabled={guestLoading}
                onChange={(e) => {
                  setGuestAgreedToLegal(e.target.checked);
                  if (e.target.checked) {
                    setGuestErrorMsg("");
                  }
                }}
              />

              <span>
                I agree to the{" "}
                <Link to="/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </Link>{" "}
                and acknowledge the{" "}
                <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {guestErrorMsg && (
              <p className="guest-consent-error">{guestErrorMsg}</p>
            )}

            <button
              type="button"
              className="guest-continue-button"
              onClick={handleContinueAsGuest}
              disabled={!guestAgreedToLegal || guestLoading}
            >
              {guestLoading ? "Starting Guest Session..." : "Continue to Bullionaire"}
            </button>

            <button
              type="button"
              className="guest-create-account-link"
              onClick={() => navigate("/account-type")}
              disabled={guestLoading}
            >
              Create an account instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}