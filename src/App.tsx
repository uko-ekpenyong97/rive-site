import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import DotField from "./components/DotField";
import Home from "./pages/Home";

/* The showcase is design-system documentation, not a visitor surface, and it
 * carries the DialKit tuning panel (plus its motion dependency). Splitting it
 * into its own chunk keeps that weight off the homepage entirely. */
const Showcase = lazy(() => import("./pages/Showcase"));

function App() {
  return (
    <>
      {/* Ambient cursor-reactive substrate behind every route. */}
      <DotField />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/showcase"
          element={
            <Suspense fallback={null}>
              <Showcase />
            </Suspense>
          }
        />
      </Routes>
    </>
  );
}

export default App;
