import { mountSite } from "../src/site";
import React, { useEffect, useState } from "react";
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
        <Lightbox.Trigger key={item.id} items={post.items} item={item} asChild>
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
          <div className="tw-mobile">
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
        <input className="tw-reply" aria-label="Reply" placeholder="Post your reply" />
        <div className="tw-actions" role="toolbar" aria-label="Post actions">
          <button type="button">Reply 12</button>
          <button type="button">Repost 4</button>
          <button type="button">Like 210</button>
          <button type="button">Share</button>
        </div>
        <button type="button" className="tw-toggle" onClick={() => setAside((open) => !open)}>
          {aside ? "Hide replies" : "Show replies"}
        </button>
        {aside && active && (
          <aside className="tw-aside" aria-label="Post and replies">
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

const panelWidth = 400;
const margin = 48;

/**
 * Instagram's panel is attached to the photo, so it needs the photo's drawn
 * size. The package doesn't expose it; this repeats the package's fit (fill
 * the stage, keep the aspect) and has to stay in step with it by hand.
 */
function useFittedPhoto(item: LightboxItem | undefined) {
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight });
  useEffect(() => {
    const resize = () => setViewport({ width: innerWidth, height: innerHeight });
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []);
  if (!item || item.media.type !== "image") return null;
  const stageWidth = viewport.width - panelWidth;
  const stageHeight = viewport.height - margin * 2;
  const scale = Math.min(stageWidth / item.media.width, stageHeight / item.media.height);
  return { width: item.media.width * scale, height: item.media.height * scale };
}

function InstagramViewer() {
  const active = useActivePost(grams);
  const activeId = useLightboxState((state) => state.activeId);
  const photo = useFittedPhoto(active?.items.find((item) => item.id === activeId));
  return (
    <Lightbox.Portal>
      {active && photo && (
        <aside
          className="ig-panel"
          aria-label="Post"
          style={
            {
              "--ig-photo-width": `${photo.width}px`,
              "--ig-photo-height": `${photo.height}px`,
            } as React.CSSProperties
          }
        >
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
        note="The photo and a 400px panel form one card, centred, with the arrows outside it. The panel takes the photo's height."
      >
        <Lightbox.Root items={grams.flatMap((gram) => gram.items)}>
          <div className="ig-grid">
            {grams.map((gram) => (
              <Lightbox.Trigger
                key={gram.id}
                items={grams.flatMap((other) => other.items)}
                item={gram.items[0]}
                asChild
              >
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
            <strong>Works, through internals.</strong> Resizing the slide strip and overriding
            --lightbox-content-height makes room for the sidebar and the action row, and the opening
            flight lands in the narrower stage because it measures the drawn photo. Neither is an
            API, and the arrows and close button had to be moved off the sidebar by hand. Stage
            frame.
          </li>
          <li>
            <strong>Consumer layers ignore the flights.</strong> The sidebar and action row appear
            at full opacity on the first frame of the opening flight, and stay opaque over the page
            while the photo flies home. The built-in controls get a reveal and a fade; portal
            content gets nothing to hook onto. Needs open and close phases, and dismiss progress, in
            CSS.
          </li>
          <li>
            <strong>Zoom ignores the stage.</strong> Zooming fills the slide's full height, under
            the action row. The strip's width clips it sideways only because the strip itself was
            narrowed. Stage frame: zoom clips to and centres on the stage.
          </li>
          <li>
            <strong>Instagram's panel needs the package's fit math.</strong> The panel takes the
            photo's height and sits against its edge only because the fixture repeats the fit (fill
            the stage, keep the aspect) from the item's size. Any change to the package's fit, or a
            renderer that draws differently, breaks it. Media frame: the drawn rect as variables.
          </li>
          <li>
            <strong>Instagram's panel doesn't swipe.</strong> The panel lives in the overlay and
            follows the active item, so mid-swipe it hangs over empty space and jumps when the slide
            settles. It belongs to the slide, moving with the photo. Slide layer plus the media
            frame.
          </li>
          <li>
            <strong>X's phone viewer is half there.</strong> The post, pills and reply field along
            the bottom are plain overlay markup and work today. Swiping up does what it always does,
            and nothing rises: the sheet, with the photo shrinking to fit above it and the stack
            becoming the sheet's first rows, is the sheet plan. The reply field has to stay above
            the sheet, so overlay content needs to layer over it.
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
