/** Unsplash photos served from Picsum, saved under public/photos at a viewer size and a 480px-tall thumbnail. */
export interface Photo {
  id: string;
  title: string;
  author: string;
  /** The photo's Unsplash page. */
  url: string;
  width: number;
  height: number;
}

export const photos: Photo[] = [
  {
    id: "1015",
    title: "Fjord from the cliff edge",
    author: "Alexey Topolyanskiy",
    url: "https://unsplash.com/photos/-oWyJoSqBRM",
    width: 1800,
    height: 1200,
  },
  {
    id: "29",
    title: "Snow on the ridges",
    author: "Go Wild",
    url: "https://unsplash.com/photos/V0yAek6BgGk",
    width: 1280,
    height: 1600,
  },
  {
    id: "184",
    title: "Dunes at dusk",
    author: "Tim de Groot",
    url: "https://unsplash.com/photos/yNGQ830uFB4",
    width: 2100,
    height: 900,
  },
  {
    id: "1039",
    title: "Waterfall in the gorge",
    author: "Andrew Coelho",
    url: "https://unsplash.com/photos/VB-w_3dnyvI",
    width: 1200,
    height: 1600,
  },
  {
    id: "883",
    title: "Still lake",
    author: "Joshua Earle",
    url: "https://unsplash.com/photos/ZMcLVBi9xx4",
    width: 1800,
    height: 1200,
  },
  {
    id: "485",
    title: "Chalk cliffs in fog",
    author: "David Marcu",
    url: "https://unsplash.com/photos/DNXWtB33WWE",
    width: 1400,
    height: 1400,
  },
  {
    id: "1016",
    title: "Red rock canyon",
    author: "Philippe Wuyts",
    url: "https://unsplash.com/photos/_h7aBovKia4",
    width: 1920,
    height: 1080,
  },
  {
    id: "15",
    title: "Falls over the rocks",
    author: "Paul Jarvis",
    url: "https://unsplash.com/photos/NYDo21ssGao",
    width: 1200,
    height: 1800,
  },
  {
    id: "1043",
    title: "Granite valley",
    author: "Christian Joudrey",
    url: "https://unsplash.com/photos/mWRR1xj95hg",
    width: 1600,
    height: 1200,
  },
  {
    id: "1036",
    title: "Winter field",
    author: "Wolfgang Lutz",
    url: "https://unsplash.com/photos/yOujaSETXlo",
    width: 2160,
    height: 900,
  },
  {
    id: "469",
    title: "Canoe in the mist",
    author: "Matthew Clark",
    url: "https://unsplash.com/photos/_IMinUHfUs0",
    width: 1800,
    height: 1200,
  },
  {
    id: "650",
    title: "Road through the pines",
    author: "Lou Levit",
    url: "https://unsplash.com/photos/_6xC5v5fLpU",
    width: 1280,
    height: 1600,
  },
];

export const photoSrc = (photo: Photo) => `/photos/${photo.id}.webp`;
export const photoThumb = (photo: Photo) => `/photos/${photo.id}-thumb.webp`;
