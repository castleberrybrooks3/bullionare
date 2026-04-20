import "./Signup.css";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();

  const accountType = location.state?.accountType || "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!accountType) {
      setErrorMsg("Please select an account type first.");
      return;
    }

    if (!agreedToLegal) {
      setErrorMsg("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://bullionaireiq.com/login",
        data: {
          full_name: fullName,
          account_type: accountType,
        },
      },
    });

    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("user already")) {
        setErrorMsg("An account with this email already exists. Try logging in instead.");
      } else {
        setErrorMsg(error.message);
      }
      return;
    }

    navigate("/login", {
      state: {
        email,
        confirmationMessage:
          "Account created. Please check your email and confirm your account before signing in.",
      },
    });
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1>Create Account</h1>
        <p>Start using Bullionaire</p>

        <form className="signup-form" onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="Full Name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

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

          <div className="password-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <span
              className="eye-icon"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? "📈" : "👁"}
            </span>
          </div>

          <label className="legal-checkbox">
            <input
              type="checkbox"
              checked={agreedToLegal}
              onChange={(e) => setAgreedToLegal(e.target.checked)}
            />
            <span>
              I agree to the <Link to="/terms">Terms of Service</Link> and{" "}
              <Link to="/privacy">Privacy Policy</Link>.
            </span>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {errorMsg && <p className="auth-error">{errorMsg}</p>}

        <div className="signup-footer">
          <p>
            Already have an account?{" "}
            <span onClick={() => navigate("/login")}>Sign in</span>
          </p>
        </div>
      </div>
    </div>
  );
}