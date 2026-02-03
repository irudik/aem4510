# Embed a local video (replaces vembedr)
local_video = function(src, width = 900) {
  if (!file.exists(src)) {
    warning(paste("Video file not found:", src))
  }
  htmltools::HTML(sprintf(
    '<video width="%d" controls preload="auto" style="display:block;margin:auto;"><source src="%s" type="video/mp4"></video>',
    width, src
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
