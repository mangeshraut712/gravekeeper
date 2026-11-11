/** Public site constants used for metadata, canonical URLs, robots and sitemap. */
export const siteUrl = "https://gravekeeper-drab.vercel.app";
export const siteName = "Gravekeeper";
export const siteTitle = "Gravekeeper — Good code deserves a second life";
export const siteDescription =
  "Unearth forgotten websites and repositories. Find archive snapshots, create a revival plan, and export verifiable receipt chains.";
/** Page background (body) colour, reused for theme-color and the share image. */
export const themeColor = "#111510";

/**
 * The root share images (src/app/opengraph-image.tsx, twitter-image.tsx). Child pages that set
 * their own `openGraph` / `twitter` replace the inherited objects, images included, so they
 * list these explicitly.
 */
export const shareImageAlt =
  "Gravekeeper: a tombstone mark on a dark graveyard background with the line 'Good code deserves a second life.'";
const shareImage = { width: 1200, height: 630, type: "image/png", alt: shareImageAlt };
export const openGraphImages = [{ url: "/opengraph-image", ...shareImage }];
export const twitterImages = [{ url: "/twitter-image", ...shareImage }];
