import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import "./wireframe.css";
const LiveApp = React.lazy(() => import("./LiveApp.jsx"));
const DemoApp = React.lazy(() => import("./WireframeDemo.jsx"));
const demo = new URLSearchParams(location.search).get("demo") === "1";
createRoot(document.getElementById("root")).render(
  <React.Suspense
    fallback={
      <div className="empty" role="status">
        현장 화면을 불러오는 중…
      </div>
    }
  >
    {demo ? <DemoApp /> : <LiveApp />}
  </React.Suspense>,
);
