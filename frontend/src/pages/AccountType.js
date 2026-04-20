import "./AccountType.css";
import { useNavigate } from "react-router-dom";

export default function AccountType() {
  const navigate = useNavigate();

  const handleSelect = (type) => {
    navigate("/signup", {
      state: {
        accountType: type,
      },
    });
  };

  return (
    <div className="account-type-page">
      <h1>Choose Your Account Type</h1>

      <div className="account-options">
        <button onClick={() => handleSelect("college_student")}>
          College Student
        </button>

        <button onClick={() => handleSelect("personal_investor")}>
          Personal Investor
        </button>

        <button onClick={() => handleSelect("professional_investor_advisor")}>
          Professional / Advisor
        </button>
      </div>
    </div>
  );
}