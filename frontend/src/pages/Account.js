import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./Account.css";

const readableDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;
        setUser(data?.user || null);
        setName(data?.user?.user_metadata?.full_name || "");
      } catch (error) {
        if (mounted) {
          setAccountError(error?.message || "Unable to load your account.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadUser();
    return () => { mounted = false; };
  }, []);

  const isGuest = user?.is_anonymous === true;
  const accountType = String(user?.user_metadata?.account_type || "").trim();
  const displayName = user?.user_metadata?.full_name?.trim() || "Bullionaire member";
  const email = user?.email || (isGuest ? "Guest session" : "Not available");

  const handleSaveName = async (event) => {
    event.preventDefault();
    if (!user || isGuest) return;
    setProfileMessage("");
    setProfileError("");
    const cleaned = name.trim();
    if (!cleaned) {
      setProfileError("Enter your name before saving.");
      return;
    }
    if (cleaned.length > 80) {
      setProfileError("Your name must be 80 characters or fewer.");
      return;
    }

    setProfileBusy(true);
    try {
      // updateUser merges this field into the existing Supabase user_metadata.
      // Leave account_type and legal-consent metadata untouched.
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: cleaned },
      });
      if (error) throw error;
      setUser(data?.user || { ...user, user_metadata: { ...user.user_metadata, full_name: cleaned } });
      setName(cleaned);
      setProfileMessage("Your name has been updated.");
    } catch (error) {
      setProfileError(error?.message || "Could not update your name.");
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    if (!user || isGuest) return;
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Your password has been updated.");
    } catch (error) {
      setPasswordError(error?.message || "Could not change your password.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAccountError("");
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      // Only clear the guest-consent record for a guest being signed out.
      if (isGuest) localStorage.removeItem("bullionaire_guest_access");
      navigate("/login", { replace: true });
    } catch (error) {
      setAccountError(error?.message || "Could not sign out.");
      setSigningOut(false);
    }
  };

  if (loading) {
    return <div className="bullionaire-account"><p className="ba-muted">Loading account…</p></div>;
  }

  if (!user) {
    return (
      <section className="bullionaire-account">
        <h1>Account</h1>
        <p className="ba-error">{accountError || "No account session was found."}</p>
        <button type="button" className="ba-primary" onClick={() => navigate("/login")}>Go to Sign In</button>
      </section>
    );
  }

  return (
    <section className="bullionaire-account">
      <header className="ba-heading">
        <p className="ba-eyebrow">BULLIONAIRE ACCOUNT</p>
        <h1>Account & Settings</h1>
        <p className="ba-muted">Manage your profile, login security, and account details.</p>
      </header>

      <div className="ba-overview">
        <span className="ba-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
        <div>
          <h2>{isGuest ? "Guest account" : displayName}</h2>
          <p className="ba-muted">{email}</p>
        </div>
        <span className="ba-chip">{isGuest ? "Guest" : "Signed in"}</span>
      </div>

      <div className="ba-grid">
        <div className="ba-panel">
          <h2>Profile</h2>
          <p className="ba-muted">Your basic Bullionaire account information.</p>
          {isGuest ? (
            <p className="ba-note">You're browsing as a guest. Sign out, then create an account to save a personal profile.</p>
          ) : (
            <form onSubmit={handleSaveName} className="ba-form">
              <label htmlFor="ba-full-name">Full name</label>
              <input id="ba-full-name" type="text" autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} required />
              {profileError && <p role="alert" className="ba-error">{profileError}</p>}
              {profileMessage && <p role="status" className="ba-success">{profileMessage}</p>}
              <button className="ba-primary" type="submit" disabled={profileBusy}>{profileBusy ? "Saving…" : "Save name"}</button>
            </form>
          )}
          <div className="ba-facts">
            <div><span>Email</span><strong>{email}</strong></div>
            <div><span>Email verified</span><strong>{user.email_confirmed_at ? "Yes" : isGuest ? "Not applicable" : "Not yet"}</strong></div>
            <div><span>Account type</span><strong>{isGuest ? "Guest" : accountType || "Not specified"}</strong></div>
            <div><span>Member since</span><strong>{readableDate(user.created_at)}</strong></div>
          </div>
        </div>

        <div className="ba-panel">
          <h2>Subscription & Billing</h2>
          <p className="ba-muted">See your plan and billing details when subscription integration is connected.</p>
          <div className="ba-billing-pending">
            <span className="ba-billing-label">Current subscription</span>
            <strong>Not connected</strong>
            <p>Billing information is not available from the existing Supabase authentication data. No plan or charge is assumed.</p>
          </div>
          <p className="ba-note">When Bullionaire's billing provider is connected, this section can show your actual plan, renewal date, and a secure billing-management link.</p>
        </div>

        <div className="ba-panel">
          <h2>Security</h2>
          <p className="ba-muted">Update your password using your authenticated Supabase session.</p>
          {isGuest ? (
            <p className="ba-note">Password changes are available for permanent accounts.</p>
          ) : (
            <form onSubmit={handlePasswordChange} className="ba-form">
              <label htmlFor="ba-new-password">New password</label>
              <input id="ba-new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              <label htmlFor="ba-confirm-password">Confirm new password</label>
              <input id="ba-confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              {passwordError && <p role="alert" className="ba-error">{passwordError}</p>}
              {passwordMessage && <p role="status" className="ba-success">{passwordMessage}</p>}
              <button className="ba-primary" type="submit" disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Update password"}</button>
            </form>
          )}
        </div>

        <div className="ba-panel ba-session-panel">
          <h2>Session</h2>
          <p className="ba-muted">Sign out of Bullionaire on this browser.</p>
          {accountError && <p role="alert" className="ba-error">{accountError}</p>}
          <button type="button" className="ba-secondary" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </section>
  );
}