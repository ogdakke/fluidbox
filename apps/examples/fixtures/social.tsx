import { mountSite } from "../src/site";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { LightboxItem } from "@ogdakke/fluidbox";
import { Lightbox, useLightboxState } from "@ogdakke/fluidbox/react";
import { tallScenes } from "@ogdakke/fluidbox-design/art-scenes";
import { artItem, scenes } from "../src/art";
import "./safari-chrome.css";
import "./social.css";

mountSite("fixtures", { fixture: "Social viewers · elements around the photo" });

type Post = {
  readonly id: string;
  readonly author: string;
  readonly handle: string;
  readonly text: string;
  readonly items: readonly LightboxItem[];
};

const allScenes = [...scenes, ...tallScenes];
const sceneById = (id: string) => allScenes.find((scene) => scene.id === id)!;

const post = (id: string, author: string, text: string, scenes: string[]): Post => ({
  id,
  author,
  handle: `@${author.toLowerCase().replace(/\s+/g, "")}`,
  text,
  items: scenes.map((scene) => artItem(sceneById(scene), `${id}-${scene}`)),
});

const tweets = [
  post("t1", "Field Notes", "Four stops on the coast road. The canyon one took an hour.", [
    "dune",
    "canyon",
    "coast",
    "meadow",
  ]),
  post("t2", "Night Shift", "Clear sky for once.", ["aurora"]),
  post("t3", "Vertical Club", "Some places only fit portrait.", ["spire", "tarn"]),
];

const grams = [
  post("g1", "Fjord Life", "Morning on the water.", ["fjord"]),
  post("g2", "Alpine Days", "Above the treeline.", ["alpine"]),
  post("g3", "Lagoon", "Low tide, high noon.", ["lagoon"]),
  post("g4", "Ridge Walk", "Two hours to here.", ["ridge"]),
  post("g5", "Tarn", "Still.", ["tarn"]),
  post("g6", "Spire", "Looking up.", ["spire"]),
];

const replies = [
  ["Ana", "Which lens was this?"],
  ["Ben", "The light in the second one."],
  ["Cy", "Saving this for my trip."],
  ["Dee", "How long was the walk in?"],
  ["Eli", "Wallpaper material."],
  ["Fox", "Need the third one as a print."],
];

const postOf = (posts: readonly Post[], id: string | null) =>
  posts.find((candidate) => candidate.items.some((item) => item.id === id)) ?? null;

/** The overlay re-renders when the slide changes; the sidebar shows the active post. */
function useActivePost(posts: readonly Post[]) {
  return postOf(
    posts,
    useLightboxState((state) => state.activeId),
  );
}

function Grid({ post }: { post: Post }) {
  return (
    <div className="tw-grid" data-count={post.items.length}>
      {post.items.map((item) => (
        <Lightbox.Trigger key={item.id} item={item} asChild>
          <button
            type="button"
            aria-label={`Open ${item.media.type === "image" && item.media.alt}`}
          >
            <img
              data-lightbox-origin
              src={item.thumbnail?.src}
              alt=""
              width={item.thumbnail?.width}
              height={item.thumbnail?.height}
            />
          </button>
        </Lightbox.Trigger>
      ))}
    </div>
  );
}

function Byline({ post }: { post: Post }) {
  return (
    <div className="byline">
      <span className="avatar" aria-hidden="true">
        {post.author[0]}
      </span>
      <span>
        <strong>{post.author}</strong>
        <small>{post.handle}</small>
      </span>
    </div>
  );
}

function TwitterViewer() {
  const active = useActivePost(tweets);
  const [aside, setAside] = useState(true);
  return (
    <Lightbox.Portal>
      <div className="tw-layer" data-aside={aside ? "open" : "closed"}>
        {active && (
          <div className="tw-mobile" data-lightbox-chrome>
            <Byline post={active} />
            <p>{active.text}</p>
            <div className="tw-pills" role="toolbar" aria-label="Post actions">
              <button type="button">Reply 5</button>
              <button type="button">Repost</button>
              <button type="button">Like 37</button>
              <button type="button">Save</button>
            </div>
          </div>
        )}
        <input
          className="tw-reply"
          data-lightbox-chrome
          aria-label="Reply"
          placeholder="Post your reply"
        />
        <div className="tw-actions" data-lightbox-chrome role="toolbar" aria-label="Post actions">
          <button type="button">Reply 12</button>
          <button type="button">Repost 4</button>
          <button type="button">Like 210</button>
          <button type="button">Share</button>
        </div>
        <button
          type="button"
          className="tw-toggle"
          data-lightbox-chrome
          onClick={() => setAside((open) => !open)}
        >
          {aside ? "Hide replies" : "Show replies"}
        </button>
        {aside && active && (
          <aside className="tw-aside" data-lightbox-chrome aria-label="Post and replies">
            <Byline post={active} />
            <p>{active.text}</p>
            <ul>
              {replies.map(([name, text]) => (
                <li key={name}>
                  <strong>{name}</strong> {text}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      <Lightbox.Previous />
      <Lightbox.Next />
      <Lightbox.Close />
    </Lightbox.Portal>
  );
}

function InstagramViewer() {
  const active = useActivePost(grams);
  return (
    <Lightbox.Portal>
      {/* Always rendered: the stage insets hang off it, and the opening flight
          measures its landing before the active post is known. */}
      <div className="ig-layer" data-lightbox-chrome />
      {active && (
        <aside className="ig-panel" data-lightbox-chrome aria-label="Post">
          <Byline post={active} />
          <p>{active.text}</p>
          <ul>
            {replies.slice(0, 4).map(([name, text]) => (
              <li key={name}>
                <strong>{name}</strong> {text}
              </li>
            ))}
          </ul>
          <div className="ig-actions">
            <button type="button">Like</button>
            <button type="button">Comment</button>
            <button type="button">Save</button>
          </div>
        </aside>
      )}
      <Lightbox.Previous />
      <Lightbox.Next />
      <Lightbox.Close />
    </Lightbox.Portal>
  );
}

function Section({
  index,
  title,
  note,
  children,
}: {
  index: number;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="lab-section">
      <div className="lab-section__head">
        <p className="fb-label">
          {index} · {title}
        </p>
        <p className="fb-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

function App() {
  return (
    <>
      <Section
        index={1}
        title="Twitter"
        note="A reply sidebar beside the stage and an action row under it; Hide replies gives the photo the full width. Below 900px it is X's phone viewer: the post, action pills and a reply field stacked along the bottom, which in the app rise into a sheet as the photo shrinks above it."
      >
        <div className="tw-feed">
          {tweets.map((tweet) => (
            <Lightbox.Root key={tweet.id} items={tweet.items}>
              <article className="tw-post">
                <Byline post={tweet} />
                <p>{tweet.text}</p>
                <Grid post={tweet} />
              </article>
              <TwitterViewer />
            </Lightbox.Root>
          ))}
        </div>
      </Section>
      <Section
        index={2}
        title="Instagram"
        note="A fixed card: a 4:5 photo box and a full-height 400px panel, centred, with the arrows and close button out on the screen. Each photo letterboxes inside the box, and swiping slides the next one in within it."
      >
        <Lightbox.Root items={grams.flatMap((gram) => gram.items)}>
          <div className="ig-grid">
            {grams.map((gram) => (
              <Lightbox.Trigger key={gram.id} item={gram.items[0]} asChild>
                <button type="button" aria-label={`Open ${gram.author}`}>
                  <img data-lightbox-origin src={gram.items[0].thumbnail?.src} alt="" />
                </button>
              </Lightbox.Trigger>
            ))}
          </div>
          <InstagramViewer />
        </Lightbox.Root>
      </Section>
      <Section
        index={3}
        title="Findings"
        note="What breaks, and which frame from the design notes fixes it."
      >
        <ol className="findings">
          <li>
            <strong>Room around the photo: fixed.</strong> --lightbox-stage-top, -right, -bottom and
            -left inset the stage. The photo fits and centres inside it, the opening and closing
            flights land in it, and the arrows and close button sit against it. The fixture no
            longer touches the slide strip or --lightbox-content-height.
          </li>
          <li>
            <strong>Layers and the flights: fixed.</strong> Anything marked data-lightbox-chrome
            stays hidden through the opening flight, fades in with the built-in controls, and fades
            out as soon as a dismiss starts, by drag or by close. A cancelled drag brings it back.
          </li>
          <li>
            <strong>Zoom and the stage: fixed.</strong> Zoom pans, bounds and centres inside the
            stage, so it no longer fills under the action row or the sidebar.
          </li>
          <li>
            <strong>Instagram's card: fixed.</strong> Instagram keeps one card size and letterboxes
            every photo in it, so the stage insets alone make the box, and the slide strip, clipped
            to the stage, swipes the next photo in within it. --lightbox-media-width and -height
            remain for panels that hug the photo instead.
          </li>
          <li>
            <strong>Insets must exist before the opening: open.</strong> The opening flight measures
            its landing before the viewer renders anything for the active item, so insets keyed to
            content that only appears with it land the flight in the wrong place. Here an
            always-rendered layer carries them; the package could re-measure, or say so.
          </li>
          <li>
            <strong>X's phone viewer is half there: open.</strong> The post, pills and reply field
            along the bottom work as overlay markup. Swiping up does what it always does, and
            nothing rises: the sheet, with the photo shrinking to fit above it, is the sheet plan.
            The reply field has to stay above the sheet, so overlay content needs to layer over it.
          </li>
        </ol>
      </Section>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
