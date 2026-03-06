import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Footer from "./components/Footer"; // 👈 add this

function App() {
  return (
    <Router>
      <div className="app-wrapper"> {/* 👈 wrapper */}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>

        <Footer /> {/* 👈 this goes OUTSIDE Routes */}
      </div>
    </Router>
  );
}

export default App;