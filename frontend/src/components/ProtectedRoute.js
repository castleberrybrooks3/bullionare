import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const CURRENT_TERMS_VERSION = "2026-08-08";
const CURRENT_PRIVACY_VERSION = "2026-08-08";
const GUEST_ACCESS_KEY = "bullionaire_guest_access";

function readValidGuestAccess() {
  try {
    const stored = localStorage.getItem(GUEST_ACCESS_KEY);

    if (!stored) {
      return null;
    }

    const guestAccess = JSON.parse(stored);

    if (
      guestAccess?.accepted === true &&
      typeof guestAccess?.guestId === "string" &&
      guestAccess.guestId.length > 0 &&
      guestAccess.termsVersion === CURRENT_TERMS_VERSION &&
      guestAccess.privacyVersion === CURRENT_PRIVACY_VERSION &&
      typeof guestAccess.acceptedAt === "string"
    ) {
      return guestAccess;
    }
  } catch (error) {
    console.warn("Invalid Bullionaire guest access record:", error);
  }

  return null;
}

export default function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null);
  const [guestConsentValid, setGuestConsentValid] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const guestAccess = readValidGuestAccess();
        let { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        let currentSession = data?.session || null;

        // Migrate the old localStorage-only guest model to a real Supabase
        // anonymous session. This keeps existing guest browsers working while
        // ensuring backend APIs can validate a genuine JWT.
        if (!currentSession && guestAccess) {
          const anonymousResult = await supabase.auth.signInAnonymously({
            options: {
              data: {
                bullionaire_guest: true,
                guest_id: guestAccess.guestId,
                accepted_terms_version: guestAccess.termsVersion,
                accepted_privacy_version: guestAccess.privacyVersion,
                accepted_at: guestAccess.acceptedAt,
              },
            },
          });

          if (!anonymousResult.error) {
            currentSession = anonymousResult.data?.session || null;
          }
        }

        if (!mounted) {
          return;
        }

        setSession(currentSession);
        setGuestConsentValid(Boolean(guestAccess));
      } catch (error) {
        console.warn("Bullionaire access check failed:", error);

        if (mounted) {
          setSession(null);
          setGuestConsentValid(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) {
        return;
      }

      setSession(newSession);
      setGuestConsentValid(Boolean(readValidGuestAccess()));
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          color: "white",
          padding: "40px",
          background: "#0b0f14",
          minHeight: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // A permanent Supabase account is allowed. An anonymous Supabase account is
  // allowed only while this browser has accepted the current legal versions.
  if (session.user?.is_anonymous === true && !guestConsentValid) {
    return <Navigate to="/login" replace />;
  }

  return children;
}