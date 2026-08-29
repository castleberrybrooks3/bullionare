import "./Navbar.css";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const CURRENT_TERMS_VERSION = "2026-08-08";
const CURRENT_PRIVACY_VERSION = "2026-08-08";
const GUEST_ACCESS_KEY = "bullionaire_guest_access";

function hasValidGuestAccess() {
  try {
    const stored = localStorage.getItem(GUEST_ACCESS_KEY);

    if (!stored) {
      return false;
    }

    const guestAccess = JSON.parse(stored);

    return (
      guestAccess?.accepted === true &&
      typeof guestAccess?.guestId === "string" &&
      guestAccess.guestId.length > 0 &&
      guestAccess?.termsVersion === CURRENT_TERMS_VERSION &&
      guestAccess?.privacyVersion === CURRENT_PRIVACY_VERSION &&
      typeof guestAccess?.acceptedAt === "string"
    );
  } catch (error) {
    console.warn("Invalid Bullionaire guest access record:", error);
    return false;
  }
}

export default function Navbar() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadAuthState = async () => {
      const { data } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      const currentSession = data?.session || null;

      setSession(currentSession);
      setIsGuest(!currentSession && hasValidGuestAccess());
      setAuthLoading(false);
    };

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) {
        return;
      }

      setSession(newSession);
      setIsGuest(!newSession && hasValidGuestAccess());
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleSignIn = () => {
    navigate("/login");
  };

  const handleAuthButton = () => {
    if (session) {
      handleSignOut();
      return;
    }

    handleSignIn();
  };

  return (
    <nav className="navbar">
      <img
        src={logo}
        alt="Bullionaire Logo"
        className="navbar-logo"
      />

      <div className="nav-links">
        <a href="/">Home</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/about">About</a>

        {!authLoading && (
          <button
            className="signout-btn"
            onClick={handleAuthButton}
          >
            {session ? "Sign Out" : "Sign In"}
          </button>
        )}
      </div>
    </nav>
  );
}