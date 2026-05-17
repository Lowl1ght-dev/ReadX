import { createRoot } from "react-dom/client";
import { pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import App from "./App.tsx";
import "./index.css";
import "./mobile.css";

/** В Electron (file://) worker должен быть абсолютным URL относительно index.html */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(workerSrc, window.location.href).href;

document.getElementById("boot")?.remove();

createRoot(document.getElementById("root")!).render(<App />);
