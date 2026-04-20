import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./Welcome.css";

export default function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const goToDashboard = async () => {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session) {
        navigate("/dashboard");
      } else {
        setTimeout(() => {
          if (mounted) {
            navigate("/dashboard");
          }
        }, 2000);
      }
    };

    goToDashboard();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="welcome-page">
      <div className="welcome-card">
        <h1>Email Confirmed</h1>
        <p>Getting your dashboard ready...</p>
        <div className="welcome-spinner"></div>
      </div>
    </div>
  );
}