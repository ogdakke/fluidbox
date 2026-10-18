import React from "react";

/** Someone on the timeline. Avatars are drawn from the seed, so nothing is fetched. */
export type Person = {
  readonly name: string;
  readonly handle: string;
  readonly seed: number;
  /** Blue for people, gold (with a square avatar) for organisations. */
  readonly badge?: "blue" | "gold";
};

const skins = ["#f1c7a5", "#e0ac84", "#c68c64", "#a86b46", "#7d4a2d", "#f6d5bd"];
const hairs = ["#2b1d16", "#4a3121", "#8a5a2b", "#c99a58", "#1b1b1f", "#6b6b70", "#a3442a"];
const shirts = ["#3b5bdb", "#2f9e44", "#e8590c", "#5f3dc4", "#212529", "#c2255c", "#0b7285"];

const pick = <T,>(list: readonly T[], seed: number, salt: number) =>
  list[(seed * 31 + salt * 17) % list.length]!;

/** A head-and-shoulders portrait, or a monogram for an organisation. */
export function avatarSrc(person: Person) {
  const { seed } = person;
  const hue = (seed * 47) % 360;
  let body: string;
  if (person.badge === "gold") {
    body = `<rect width="64" height="64" fill="hsl(${hue} 55% 22%)"/>
      <circle cx="32" cy="32" r="19" fill="none" stroke="hsl(${hue} 70% 72%)" stroke-width="3"/>
      <text x="32" y="39.5" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-weight="700" fill="hsl(${hue} 70% 86%)">${person.name[0]}</text>`;
  } else {
    const skin = pick(skins, seed, 1);
    const hair = pick(hairs, seed, 2);
    const shirt = pick(shirts, seed, 3);
    const style = seed % 3;
    const back =
      style === 1 ? `<path d="M17 29c0-12 6-18 15-18s15 6 15 18v17H17z" fill="${hair}"/>` : "";
    const top =
      style === 2
        ? `<path d="M20 27c-1-10 5-15 12-15s13 5 12 15c-2-6-6-8-12-8s-10 2-12 8z" fill="${hair}"/><circle cx="32" cy="11" r="5" fill="${hair}"/>`
        : `<path d="M19.5 27c-.5-10 5.5-15.5 12.5-15.5S45 17 44.5 27c-3-6-7.5-7.5-12.5-7.5s-9.5 1.5-12.5 7.5z" fill="${hair}"/>`;
    body = `<rect width="64" height="64" fill="hsl(${hue} 42% 74%)"/>${back}
      <path d="M7 64c2-13 12-19 25-19s23 6 25 19z" fill="${shirt}"/>
      <path d="M27 38h10v9c-3 2-7 2-10 0z" fill="${skin}" opacity=".85"/>
      <ellipse cx="32" cy="28" rx="11.5" ry="13" fill="${skin}"/>${top}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`,
  )}`;
}

export function Avatar({ person, size = 40 }: { person: Person; size?: number }) {
  return (
    <img
      className="avatar"
      data-shape={person.badge === "gold" ? "square" : "round"}
      src={avatarSrc(person)}
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  );
}

// A rosette with twelve lobes, like the badges on X.
const rosette = (() => {
  const points: string[] = [];
  for (let step = 0; step <= 96; step++) {
    const angle = (step / 96) * Math.PI * 2;
    const radius = 10.4 + 1.1 * Math.cos(angle * 12);
    points.push(
      `${(12 + radius * Math.sin(angle)).toFixed(2)} ${(12 - radius * Math.cos(angle)).toFixed(2)}`,
    );
  }
  return `M${points.join("L")}Z`;
})();

export function Badge({ kind }: { kind: "blue" | "gold" }) {
  return (
    <svg
      className="badge"
      data-kind={kind}
      viewBox="0 0 24 24"
      aria-label="Verified account"
      role="img"
    >
      <path d={rosette} />
      <path
        d="M7.6 12.3l3 3 5.9-6.3"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const paths = {
  reply:
    "M1.75 10.5a8.25 8.25 0 0 1 8.25-8.25h4a8.25 8.25 0 1 1 0 16.5h-.25L8.5 22.25v-3.6a8.25 8.25 0 0 1-6.75-8.15z",
  repost: "M4.5 10V7.5a3 3 0 0 1 3-3h11m-3-3 3 3-3 3m4.5 6.5v2.5a3 3 0 0 1-3 3h-11m3 3-3-3 3-3",
  like: "M12 20.5S3.5 15.4 2.4 10.1C1.6 6.4 4 3.6 7.2 3.6c2.1 0 3.6 1.1 4.8 2.8 1.2-1.7 2.7-2.8 4.8-2.8 3.2 0 5.6 2.8 4.8 6.5C20.5 15.4 12 20.5 12 20.5z",
  views: "M4.5 20.5v-7m5-6.5v13.5m5-9.5v9.5m5-16v16",
  bookmark: "M5.5 3.5h13v17.5L12 16.6l-6.5 4.4z",
  share:
    "M12 15.5V3m-4.5 4.5L12 3l4.5 4.5M4 14v4.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V14",
  comment: "M20.6 16.3A9.5 9.5 0 1 0 17 20.1L21.5 21.5z",
  send: "M21.5 2.5 10.6 13.4M21.5 2.5l-6.9 19-4-8.1-8.1-4z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  collapse: "M5 6l6 6-6 6M13 6l6 6-6 6",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** 1234 → "1.2K", as both apps print counts. */
export function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}
