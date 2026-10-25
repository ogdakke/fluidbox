import type { HTMLAttributes } from "react";

// <model-viewer>'s attributes, for JSX.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": HTMLAttributes<HTMLElement> & {
        src?: string;
        poster?: string;
        "camera-controls"?: string;
        "touch-action"?: string;
        "interaction-prompt"?: string;
      };
    }
  }
}
