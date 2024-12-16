// src/webview/index.tsx
import React from "react";
import * as ReactDOM from "react-dom/client";
import CanvasEditor from "./CanvasEditor";

const container = document.getElementById("root");
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <CanvasEditor />
    </React.StrictMode>
  );
}
