// #region example
import { useRef, useState, type RefObject } from "react";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/react";
import { label, photos } from "../shared";

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
  const record = (event: Event) => setLog((types) => [...types, event.type].slice(-20));
  return (
    <Fluidbox.Root
      items={photos}
      // beforeitemchange comes before every move between items; canceling it keeps the viewer still.
      onBeforeItemChange={(event) => {
        if (lock.current?.checked) event.preventDefault();
        record(event);
      }}
      onBeforeToggle={record}
      onToggle={record}
      onItemChange={record}
      onSettle={record}
    >
      <Toolbar lock={lock} />
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.src}
            item={photo}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={label(photo)} />
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
