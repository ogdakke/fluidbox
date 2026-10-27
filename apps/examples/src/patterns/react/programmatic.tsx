// #region example
import { useRef, useState, type RefObject } from "react";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/react";
import { photos } from "../shared";

function Toolbar({ lock }: { lock: RefObject<HTMLInputElement | null> }) {
  const open = useFluidbox(({ open }) => open);
  const status = useFluidbox(({ status, index }) => `${status} ${index ?? "-"}`);
  return (
    <div className="pattern-toolbar">
      <button type="button" data-test="open-third" onClick={() => open(2)}>
        Open the third photo
      </button>
      <label>
        <input ref={lock} type="checkbox" name="lock" data-test="lock" /> Lock navigation
      </label>
      <output data-test="status">{status}</output>
    </div>
  );
}

export function Programmatic() {
  const lock = useRef<HTMLInputElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const record = (type: string) => setLog((types) => [...types, type].slice(-20));
  return (
    <Fluidbox.Root
      items={photos}
      // Called before every open, move and close; canceling a move keeps the viewer still.
      onValueChange={(_, details) => {
        if (lock.current?.checked && details.action === "move") details.cancel();
        record("valuechange");
      }}
      onValueChangeComplete={() => record("valuechangecomplete")}
    >
      <Toolbar lock={lock} />
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.id}
            value={photo.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
      <ol className="pattern-log" data-test="log">
        {log.map((type, index) => (
          <li key={index}>{type}</li>
        ))}
      </ol>
    </Fluidbox.Root>
  );
}
// #endregion example
