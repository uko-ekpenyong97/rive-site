import { Route, Routes } from "react-router-dom";
import DotField from "./components/DotField";
import Home from "./pages/Home";
import Showcase from "./pages/Showcase";

function App() {
  return (
    <>
      {/* Ambient cursor-reactive substrate behind every route. */}
      <DotField />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/showcase" element={<Showcase />} />
      </Routes>
    </>
  );
}

export default App;
