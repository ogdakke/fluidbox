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
  const record = (type: string) => setLog((types) => [...types, type].slice(-20));
  return (
    <Fluidbox.Root
      items={photos}
      // Called before every open, move and close; canceling a move keeps the viewer still.
      onValueChange={(_, details) => {
        if (locked() && details.action === "move") details.cancel();
        record("valuechange");
      }}
      onValueChangeComplete={() => record("valuechangecomplete")}
    >
      <Toolbar locked={locked()} onLockedChange={setLocked} />
      <div class="pattern-grid">
        <For each={photos}>
          {(photo) => (
            <Fluidbox.Trigger value={photo.id} class="pattern-thumb" data-test="trigger">
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
