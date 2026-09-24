#' Embed a local video with available captions from a matching WebVTT file.
#'
#' @param src Path to an MP4 file, relative to the slides directory.
#' @param width Player width in pixels.
local_video = function(src, width = 900) {
  if (!file.exists(src)) {
    warning(paste("Video file not found:", src))
  }
  caption_base = sub("\\.mp4$", "", src)
  caption_languages = c(en = "English", fr = "French")
  caption_files = paste0(caption_base, ".", names(caption_languages), ".vtt")
  available = which(file.exists(caption_files))
  caption_track = if (length(available) > 0) {
    caption_index = available[1]
    sprintf(
      '<track kind="captions" src="%s" srclang="%s" label="%s" default>',
      htmltools::htmlEscape(caption_files[caption_index]),
      names(caption_languages)[caption_index],
      caption_languages[caption_index]
    )
  } else {
    ""
  }
  htmltools::HTML(sprintf(
    paste0(
      '<video width="%d" controls preload="metadata" style="display:block;margin:auto;" ',
      'onplay="document.querySelectorAll(\'video\').forEach(v => { if (v !== this) v.pause(); });">',
      '<source src="%s" type="video/mp4">%s</video>'
    ),
    width, htmltools::htmlEscape(src), caption_track
  ))
}

# Validate all videos exist before knitting
validate_videos = function(manifest_path = "video_manifest.csv", video_dir = "videos") {
  manifest = read.csv(manifest_path)
  missing = character()
  for (i in seq_len(nrow(manifest))) {
    path = file.path(video_dir, manifest$filename[i])
    if (!file.exists(path)) {
      missing = c(missing, manifest$filename[i])
    }
  }
  if (length(missing) > 0) {
    stop(paste("Missing videos:", paste(missing, collapse = ", "),
               "\nRun scripts/download_videos.sh to download them."))
  }
  message(paste("All", nrow(manifest), "videos present."))
  invisible(TRUE)
}
