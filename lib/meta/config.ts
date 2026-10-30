// The Pixel ID is public (it is in the page source of every site that uses
// it), so it is safe here. Set NEXT_PUBLIC_META_PIXEL_ID in Vercel to
// override. The Conversions API token is NOT public: it is read from
// META_CAPI_TOKEN on the server only (lib/meta/capi.ts).
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1120448007443391";
