import { mountSite } from "../src/site";
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { LightboxItem } from "@ogdakke/fluidbox";
import { Lightbox, useLightboxSheet, useLightboxState } from "@ogdakke/fluidbox/react";
import { sheet, type LightboxSheet } from "@ogdakke/fluidbox/sheet";
import { tallScenes } from "@ogdakke/fluidbox-design/art-scenes";
import { artItem, scenes } from "../src/art";
import { Avatar, Badge, Icon, compact, type IconName, type Person } from "./social-ui";
import "@ogdakke/fluidbox/sheet.css";
import "./safari-chrome.css";
import "./social.css";

mountSite("fixtures", { fixture: "Social viewers · elements around the photo" });

const people = {
  field: { name: "Field Notes", handle: "fieldnotes", seed: 4, badge: "gold" },
  night: { name: "Mira Okafor", handle: "miraokafor", seed: 11, badge: "blue" },
  vertical: { name: "Jonas Lind", handle: "jlind", seed: 7 },
  ana: { name: "Ana Ruiz", handle: "anaruiz", seed: 2, badge: "blue" },
  ben: { name: "Ben Hart", handle: "benhart", seed: 5 },
  cy: { name: "Cyrus Vale", handle: "cyvale", seed: 9 },
  dee: { name: "Dee Mensah", handle: "deemensah", seed: 13, badge: "blue" },
  eli: { name: "Eli Strand", handle: "elistrand", seed: 16 },
  fox: { name: "Foxglove Prints", handle: "foxgloveprints", seed: 20, badge: "gold" },
  gil: { name: "Gil Moreau", handle: "gilmoreau", seed: 22 },
  hana: { name: "Hana Ito", handle: "hanaito", seed: 25 },
  fjord: { name: "fjord.life", handle: "fjord.life", seed: 8, badge: "blue" },
} satisfies Record<string, Person>;

type Reply = {
  readonly by: Person;
  readonly text: string;
  readonly ago: string;
  readonly likes: number;
};

type Post = {
  readonly id: string;
  readonly by: Person;
  readonly text: string;
  readonly ago: string;
  readonly date: string;
  readonly stats: { replies: number; reposts: number; likes: number; views: number };
  readonly replies: readonly Reply[];
  readonly items: readonly LightboxItem[];
};

const allScenes = [...scenes, ...tallScenes];
const sceneById = (id: string) => allScenes.find((scene) => scene.id === id)!;
const media = (id: string, ids: string[]) =>
  ids.map((scene) => artItem(sceneById(scene), `${id}-${scene}`));

const chatter: readonly Reply[] = [
  {
    by: people.ana,
    text: "Which lens was this? The compression on the second one is unreal.",
    ago: "2h",
    likes: 184,
  },
  { by: people.ben, text: "The light in the canyon shot. Saving all four.", ago: "2h", likes: 96 },
  {
    by: people.fox,
    text: "We'd love to print the third one. Sending a DM 🙏",
    ago: "1h",
    likes: 61,
  },
  {
    by: people.cy,
    text: "How long was the walk in? Thinking of going in May.",
    ago: "1h",
    likes: 22,
  },
  { by: people.dee, text: "Wallpaper material, every single one.", ago: "54m", likes: 18 },
  {
    by: people.eli,
    text: "This is the kind of post I'm still on here for.",
    ago: "41m",
    likes: 12,
  },
  { by: people.gil, text: "Did you shoot these handheld?", ago: "30m", likes: 7 },
  { by: people.hana, text: "Okay, the coast road is now on the list.", ago: "12m", likes: 3 },
];

const tweets: readonly Post[] = [
  {
    id: "t1",
    by: people.field,
    text: "Four stops on the coast road. The canyon one took an hour to get to and was worth every minute.",
    ago: "3h",
    date: "9:41 AM · Oct 18, 2026",
    stats: { replies: 248, reposts: 1_204, likes: 18_700, views: 1_420_000 },
    replies: chatter,
    items: media("t1", ["dune", "canyon", "coast", "meadow"]),
  },
  {
    id: "t2",
    by: people.night,
    text: "Clear sky for once. Stood out there until I couldn't feel my hands.",
    ago: "5h",
    date: "7:12 AM · Oct 18, 2026",
    stats: { replies: 91, reposts: 402, likes: 6_310, views: 288_000 },
    replies: chatter.slice(2, 7),
    items: media("t2", ["aurora"]),
  },
  {
    id: "t3",
    by: people.vertical,
    text: "Some places only fit portrait.",
    ago: "8h",
    date: "4:03 AM · Oct 18, 2026",
    stats: { replies: 37, reposts: 88, likes: 1_942, views: 74_100 },
    replies: chatter.slice(4),
    items: media("t3", ["spire", "tarn"]),
  },
];

const grams: readonly Post[] = (
  [
    ["g1", "Morning on the water. No wind until ten.", "fjord", 4_812],
    ["g2", "Above the treeline, finally.", "alpine", 3_390],
    ["g3", "Low tide, high noon.", "lagoon", 2_917],
    ["g4", "Two hours to here, two hours back.", "ridge", 5_204],
    ["g5", "Still.", "tarn", 1_873],
    ["g6", "Looking up for a change.", "spire", 2_466],
  ] as const
).map(([id, text, scene, likes], index) => ({
  id,
  by: people.fjord,
  text,
  ago: `${index + 1}d`,
  date: `October ${17 - index}`,
  stats: { replies: 40 + index * 13, reposts: 0, likes, views: 0 },
  replies: chatter.slice(index % 3, (index % 3) + 5),
  items: media(id, [scene]),
}));

const postOf = (posts: readonly Post[], id: string | null) =>
  posts.find((candidate) => candidate.items.some((item) => item.id === id)) ?? null;

/** The overlay re-renders when the slide changes; the panels show the active post. */
function useActivePost(posts: readonly Post[]) {
  return postOf(
    posts,
    useLightboxState((state) => state.activeId),
  );
}

function Name({ person }: { person: Person }) {
  return (
    <span className="name">
      <strong>{person.name}</strong>
      {person.badge && <Badge kind={person.badge} />}
    </span>
  );
}

function Count({
  icon,
  value,
  label,
  ...rest
}: {
  icon: IconName;
  value?: number;
  label: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  Record<`data-${string}`, string>) {
  return (
    <button type="button" className="count" data-icon={icon} aria-label={label} {...rest}>
      <Icon name={icon} size={19} />
      {value !== undefined && <span>{compact(value)}</span>}
    </button>
  );
}

// X.

function Grid({ post }: { post: Post }) {
  return (
    <div className="x-grid" data-count={post.items.length}>
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

function Tweet({ post }: { post: Post }) {
  return (
    <article className="x-post">
      <Avatar person={post.by} />
      <div className="x-post__body">
        <header className="x-head">
          <Name person={post.by} />
          <span className="x-muted">
            @{post.by.handle} · {post.ago}
          </span>
          <Icon name="more" size={18} />
        </header>
        <p>{post.text}</p>
        <Grid post={post} />
        <footer className="x-counts">
          <Count icon="reply" value={post.stats.replies} label="Replies" />
          <Count icon="repost" value={post.stats.reposts} label="Reposts" />
          <Count icon="like" value={post.stats.likes} label="Likes" />
          <Count icon="views" value={post.stats.views} label="Views" />
          <span className="x-counts__end">
            <Count icon="bookmark" label="Bookmark" />
            <Count icon="share" label="Share" />
          </span>
        </footer>
      </div>
    </article>
  );
}

function ReplyRow({ reply }: { reply: Reply }) {
  return (
    <li className="x-reply">
      <Avatar person={reply.by} />
      <div>
        <header className="x-head">
          <Name person={reply.by} />
          <span className="x-muted">
            @{reply.by.handle} · {reply.ago}
          </span>
        </header>
        <p>{reply.text}</p>
        <footer className="x-counts x-counts--small">
          <Count icon="reply" label="Reply" />
          <Count icon="repost" label="Repost" />
          <Count icon="like" value={reply.likes} label="Likes" />
          <Count icon="views" value={reply.likes * 37} label="Views" />
        </footer>
      </div>
    </li>
  );
}

function Composer({ me }: { me: Person }) {
  return (
    <form className="x-composer" onSubmit={(event) => event.preventDefault()}>
      <Avatar person={me} size={32} />
      <input aria-label="Post your reply" placeholder="Post your reply" />
      <button type="submit">Reply</button>
    </form>
  );
}

const me: Person = { name: "You", handle: "you", seed: 30 };

function XViewer({ replies }: { replies: LightboxSheet }) {
  const active = useActivePost(tweets);
  const stop = useLightboxSheet(replies);
  const [aside, setAside] = useState(true);
  return (
    <Lightbox.Portal>
      <div className="x-layer" data-aside={aside ? "open" : "closed"} data-lightbox-chrome>
        <button
          type="button"
          className="x-toggle"
          aria-label={aside ? "Hide post" : "Show post"}
          aria-expanded={aside}
          onClick={() => setAside((open) => !open)}
        >
          <Icon name="collapse" size={18} />
        </button>
        {active && (
          <div className="x-bar" role="toolbar" aria-label="Post actions">
            <Count icon="reply" value={active.stats.replies} label="Replies" />
            <Count icon="repost" value={active.stats.reposts} label="Reposts" />
            <Count icon="like" value={active.stats.likes} label="Likes" />
            <Count icon="bookmark" label="Bookmark" />
            <Count icon="share" label="Share" />
          </div>
        )}
      </div>
      {aside && active && (
        <aside className="x-aside" data-lightbox-chrome aria-label="Post and replies">
          <header className="x-author">
            <Avatar person={active.by} />
            <span>
              <Name person={active.by} />
              <span className="x-muted">@{active.by.handle}</span>
            </span>
            <button type="button" className="x-follow">
              Follow
            </button>
          </header>
          <p className="x-text">{active.text}</p>
          <p className="x-muted x-date">
            {active.date} · <strong>{compact(active.stats.views)}</strong> Views
          </p>
          <div className="x-counts x-counts--rule">
            <Count icon="reply" value={active.stats.replies} label="Replies" />
            <Count icon="repost" value={active.stats.reposts} label="Reposts" />
            <Count icon="like" value={active.stats.likes} label="Likes" />
            <Count icon="bookmark" label="Bookmark" />
            <Count icon="share" label="Share" />
          </div>
          <Composer me={me} />
          <ul className="x-replies">
            {active.replies.map((reply) => (
              <ReplyRow key={reply.by.handle} reply={reply} />
            ))}
          </ul>
        </aside>
      )}
      {/* X on a phone: the post along the bottom, over the photo; replies rise in a sheet. */}
      {active && (
        <div className="x-phone" data-lightbox-chrome>
          <div className="x-phone__fade">
            <header className="x-author">
              <Avatar person={active.by} size={36} />
              <span>
                <Name person={active.by} />
                <span className="x-muted">@{active.by.handle}</span>
              </span>
              <button type="button" className="x-follow">
                Follow
              </button>
            </header>
            <p className="x-text">{active.text}</p>
            <div className="x-counts" role="toolbar" aria-label="Post actions">
              <Count
                icon="reply"
                value={active.stats.replies}
                label="Show replies"
                aria-expanded={stop !== "photo"}
                data-lightbox-sheet-stop="info"
              />
              <Count icon="repost" value={active.stats.reposts} label="Reposts" />
              <Count icon="like" value={active.stats.likes} label="Likes" />
              <Count icon="views" value={active.stats.views} label="Views" />
              <Count icon="share" label="Share" />
            </div>
          </div>
        </div>
      )}
      <section className="x-sheet" data-lightbox-sheet data-lightbox-chrome aria-label="Replies">
        <div data-lightbox-sheet-handle />
        <header className="x-sheet__head">
          <strong>Replies</strong>
          <span className="x-muted">{active && compact(active.stats.replies)}</span>
        </header>
        <ul className="x-replies">
          {active?.replies.map((reply) => (
            <ReplyRow key={reply.by.handle} reply={reply} />
          ))}
        </ul>
        <Composer me={me} />
      </section>
      <Lightbox.Previous />
      <Lightbox.Next />
      <Lightbox.Close />
    </Lightbox.Portal>
  );
}

function XThread({ post }: { post: Post }) {
  // One sheet per viewer, kept for its lifetime.
  const replies = useMemo(() => sheet(), []);
  return (
    <Lightbox.Root items={post.items} sheet={replies}>
      <Tweet post={post} />
      <XViewer replies={replies} />
    </Lightbox.Root>
  );
}

// Instagram.

function Comment({
  person,
  text,
  ago,
  likes,
}: {
  person: Person;
  text: string;
  ago: string;
  likes?: number;
}) {
  return (
    <li className="ig-comment">
      <Avatar person={person} size={32} />
      <div>
        <p>
          <strong>{person.handle}</strong> {text}
        </p>
        <p className="ig-muted">
          {ago}
          {likes !== undefined && <> · {compact(likes)} likes · Reply</>}
        </p>
      </div>
      {likes !== undefined && <Icon name="like" size={14} />}
    </li>
  );
}

function IgActions({ post }: { post: Post }) {
  return (
    <>
      <div className="ig-actions">
        <Count icon="like" label="Like" />
        <Count icon="comment" label="Comment" data-lightbox-sheet-stop="full" />
        <Count icon="send" label="Share" />
        <Count icon="bookmark" label="Save" />
      </div>
      <p className="ig-likes">
        <strong>{post.stats.likes.toLocaleString("en-US")} likes</strong>
      </p>
    </>
  );
}

function IgComments({ post }: { post: Post }) {
  return (
    <ul className="ig-comments">
      <Comment person={post.by} text={post.text} ago={post.ago} />
      {post.replies.map((reply) => (
        <Comment
          key={reply.by.handle}
          person={reply.by}
          text={reply.text}
          ago={reply.ago}
          likes={reply.likes}
        />
      ))}
    </ul>
  );
}

function IgAuthor({ post }: { post: Post }) {
  return (
    <header className="ig-author">
      <Avatar person={post.by} size={32} />
      <span>
        <Name person={post.by} />
        <small>Lofoten, Norway</small>
      </span>
      <button type="button" className="ig-follow">
        Follow
      </button>
      <Icon name="more" size={20} />
    </header>
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
          <IgAuthor post={active} />
          <IgComments post={active} />
          <footer>
            <IgActions post={active} />
            <p className="ig-muted ig-date">{active.date}</p>
            <form className="ig-add" onSubmit={(event) => event.preventDefault()}>
              <input aria-label="Add a comment" placeholder="Add a comment…" />
              <button type="submit">Post</button>
            </form>
          </footer>
        </aside>
      )}
      {/* On a phone the caption peeks under the photo and drags up into the comments. */}
      <section className="ig-sheet" data-lightbox-sheet data-lightbox-chrome aria-label="Post">
        <div data-lightbox-sheet-handle />
        {active && (
          <>
            <IgActions post={active} />
            <p className="ig-caption">
              <strong>{active.by.handle}</strong> {active.text}
            </p>
            <button type="button" className="ig-more" data-lightbox-sheet-stop="full">
              View all {active.stats.replies} comments
            </button>
            <IgComments post={active} />
          </>
        )}
      </section>
      <Lightbox.Previous />
      <Lightbox.Next />
      <Lightbox.Close />
    </Lightbox.Portal>
  );
}

function InstagramProfile() {
  const details = useMemo(() => sheet(), []);
  const profile = people.fjord;
  return (
    <Lightbox.Root items={grams.flatMap((gram) => gram.items)} sheet={details}>
      <div className="ig-profile">
        <header className="ig-profile__head">
          <Avatar person={profile} size={86} />
          <div>
            <p className="ig-profile__name">
              <Name person={profile} />
              <button type="button" className="ig-follow ig-follow--solid">
                Follow
              </button>
            </p>
            <p className="ig-profile__stats">
              <span>
                <strong>{grams.length}</strong> posts
              </span>
              <span>
                <strong>128K</strong> followers
              </span>
              <span>
                <strong>312</strong> following
              </span>
            </p>
            <p>Fjords, ridges and the light between them. Lofoten → wherever the weather's good.</p>
          </div>
        </header>
        <div className="ig-grid">
          {grams.map((gram) => (
            <Lightbox.Trigger key={gram.id} item={gram.items[0]} asChild>
              <button type="button" aria-label={`Open ${gram.text}`}>
                <img data-lightbox-origin src={gram.items[0].thumbnail?.src} alt="" />
              </button>
            </Lightbox.Trigger>
          ))}
        </div>
      </div>
      <InstagramViewer />
    </Lightbox.Root>
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
        title="X"
        note="On a wide screen, the post and its replies sit in a sidebar beside the photo, with the counts under it; the double chevron gives the photo the full width. Below 900px it is X's phone viewer: the post over the bottom of the photo, and tapping the reply count raises the replies in a sheet as the photo shrinks to fit above it. Drag the sheet up for more, down or Escape to put it away."
      >
        <div className="x-feed">
          {tweets.map((tweet) => (
            <XThread key={tweet.id} post={tweet} />
          ))}
        </div>
      </Section>
      <Section
        index={2}
        title="Instagram"
        note="A fixed card on a wide screen: a 4:5 photo box and a full-height panel of the comments. Below 900px the caption peeks under the photo; drag it, scroll, or tap View all comments to raise the comments over it."
      >
        <InstagramProfile />
      </Section>
      <Section index={3} title="Findings" note="What broke on the way here, and what fixed it.">
        <ol className="findings">
          <li>
            <strong>Room around the photo: fixed.</strong> --lightbox-stage-top, -right, -bottom and
            -left inset the stage. The photo fits and centres inside it, the opening and closing
            flights land in it, and the arrows and close button sit against it.
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
            <strong>Instagram's card: fixed.</strong> The stage insets alone make the box, and the
            slide strip, clipped to the stage, swipes the next photo in within it.
          </li>
          <li>
            <strong>X's phone viewer: fixed.</strong> The sheet entry (@ogdakke/fluidbox/sheet)
            raises any data-lightbox-sheet element over the photo and fits the photo into the room
            above it. Swiping up on the photo raises it instead of dismissing; a reply count marked
            data-lightbox-sheet-stop opens it; Escape, a tap above it or the close button lower it.
          </li>
          <li>
            <strong>Insets must exist before the opening: open.</strong> The opening flight measures
            its landing before the viewer renders anything for the active item, so insets keyed to
            content that only appears with it land the flight in the wrong place. Here an
            always-rendered layer carries them.
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
