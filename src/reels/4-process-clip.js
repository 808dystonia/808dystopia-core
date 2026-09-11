// Step 4: download the selected time range, crop/resize to 9:16, and
// overlay the 808dystopia watermark (top-left corner) via ffmpeg.
// TODO: implement once the watermark asset is provided (goes in
// src/templates/assets/, alongside the news pipeline's closer.mp4/logo.png)
// and the ffmpeg runtime approach is decided — GitHub Actions' ubuntu-latest
// runners don't ship ffmpeg by default, so this likely needs a bundled
// static binary (e.g. the ffmpeg-static npm package) rather than assuming
// a system install, matching how this project already avoids depending on
// anything not explicitly provisioned.
export async function processClip(_video, _highlight) {
  throw new Error("not implemented: processClip");
}
