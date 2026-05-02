import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SplashScreen } from "./components/SplashScreen";
import { UndoRedoProvider } from "./contexts/UndoRedoContext";
import "./index.css";

document.addEventListener("contextmenu", (e) => e.preventDefault());

function Root() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      {!splashDone ? <SplashScreen onDone={() => setSplashDone(true)} /> : null}
      <UndoRedoProvider>
        <App />
      </UndoRedoProvider>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
