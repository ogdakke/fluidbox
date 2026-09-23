import { createElement, forwardRef, useEffect, useRef } from "react";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import { bindGallerySource } from "./binding";
import { registerLightboxElements } from "./register";
import type { AppGallery } from "./gallery";
import type { LightboxGallerySource } from "./source";

export interface FluidboxGalleryProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  source?: LightboxGallerySource | null;
  children?: ReactNode;
}

/** Register the standalone custom elements after React hydrates. */
export function useFluidboxElements(): void {
  useEffect(() => {
    void registerLightboxElements();
  }, []);
}

/** React wrapper for indexed galleries. The ref points to the underlying custom element. */
export const FluidboxGallery = forwardRef<AppGallery, FluidboxGalleryProps>(
  function FluidboxGallery({ source = null, children, ...attributes }, forwardedRef) {
    const element = useRef<AppGallery | null>(null);

    useEffect(() => {
      if (element.current) return bindGallerySource(element.current, source);
    }, [source]);

    const setRef = (node: AppGallery | null) => {
      element.current = node;
      setForwardedRef(forwardedRef, node);
    };

    return createElement("app-gallery", { ...attributes, ref: setRef }, children);
  },
);

function setForwardedRef(ref: Ref<AppGallery>, element: AppGallery | null): void {
  if (typeof ref === "function") ref(element);
  else if (ref) ref.current = element;
}
