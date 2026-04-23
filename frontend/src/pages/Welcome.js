import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.setItem("showEmailConfirmedOverlay", "true");
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  return null;
}