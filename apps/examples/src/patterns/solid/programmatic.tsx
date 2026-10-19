/** @jsxImportSource solid-js */
// #region example
import { createSignal, For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/solid";
import { photos } from "../shared";

function Toolbar(props: { locked: boolean; onLockedChange: (locked: boolean) => void }) {
  const fluidbox = useFluidbox();
  return (
    <div class="pattern-toolbar">
      <button type="button" data-test="open-third" onClick={() => fluidbox.open(2)}>
        Open the third photo
      </button>
      <label>
        <input
          type="checkbox"
          name="lock"
          data-test="lock"
          checked={props.locked}
          onChange={(event) => props.onLockedChange(event.currentTarget.checked)}
        />{" "}
        Lock navigation
      </label>
      <output data-test="status">
        {fluidbox.status} {fluidbox.index ?? "-"}
      </output>
    </div>
  );
}

export function Programmatic() {
  const [locked, setLocked] = createSignal(false);
  const [log, setLog] = createSignal<string[]>([]);
  const record = (event: Event) => setLog((types) => [...types, event.type].slice(-20));
  return (
    <Fluidbox.Root
      items={photos}
      // beforeitemchange comes before every move between items; canceling it keeps the viewer still.
      onBeforeItemChange={(event) => {
        record(event);
        if (locked()) event.preventDefault();
      }}
      onBeforeToggle={record}
      onToggle={record}
      onItemChange={record}
      onSettle={record}
    >
      <Toolbar locked={locked()} onLockedChange={setLocked} />
      <div class="pattern-grid">
        <For each={photos}>
          {(photo) => (
            <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
              <img src={photo.src} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          )}
        </For>
      </div>
      <ol class="pattern-log" data-test="log">
        <For each={log()}>{(type) => <li>{type}</li>}</For>
      </ol>
    </Fluidbox.Root>
  );
}
// #endregion example
