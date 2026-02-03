# AEM 4510 Course Website

This repository contains the course website for AEM 4510, built with [Hugo](https://gohugo.io/) and the [Wowchemy Academic](https://wowchemy.com/) theme.

## Local Development

### Prerequisites

- [Hugo](https://gohugo.io/installation/) (extended version, 0.139.0 or later)
- [R](https://www.r-project.org/) with the following packages:
  - `rmarkdown`
  - `blogdown`

### Running the Site Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/irudik/aem4510.git
   cd aem4510
   ```

2. Start the development server:
   ```bash
   Rscript -e "blogdown::serve_site()"
   ```

3. Open http://localhost:1313 in your browser

The site will automatically reload when you make changes to content files.

### Rendering R Markdown Lecture Notes

The lecture notes in `content/lecture-notes/` are written as `.Rmd` files. To render them to HTML:

```bash
Rscript -e "
library(rmarkdown)
library(blogdown)

rmd_files = list.files('content/lecture-notes', pattern = '\\\\.Rmd$', full.names = TRUE)

for (rmd_file in rmd_files) {
  html_file = sub('\\\\.Rmd$', '.html', rmd_file)

  # Read the Rmd file and extract YAML frontmatter
  lines = readLines(rmd_file)
  yaml_start = which(lines == '---')[1]
  yaml_end = which(lines == '---')[2]
  yaml_content = lines[yaml_start:yaml_end]

  # Render the Rmd to HTML
  rmarkdown::render(rmd_file, output_format = 'html_document', output_file = basename(html_file), quiet = TRUE)

  # Read rendered HTML and extract body content
  html_lines = readLines(html_file)
  body_start = grep('<body>', html_lines)[1]
  body_end = grep('</body>', html_lines)[1]

  if (!is.na(body_start) && !is.na(body_end)) {
    body_content = html_lines[(body_start + 1):(body_end - 1)]
    body_content = body_content[!grepl('class=\"container-fluid main-container\"', body_content)]
    body_content = body_content[body_content != '</div>'][1:(length(body_content) - 1)]
  } else {
    body_content = html_lines
  }

  # Write final HTML with YAML frontmatter preserved
  final_content = c(yaml_content, '', body_content)
  writeLines(final_content, html_file)

  message('Rendered: ', basename(rmd_file))
}
"
```

Alternatively, render a single file:

```bash
Rscript -e "rmarkdown::render('content/lecture-notes/01-introduction.Rmd')"
```

Note: After rendering, you may need to manually ensure the YAML frontmatter is preserved in the output HTML file for Hugo to process it correctly.

### Rendering Slides

Slides are in `slides/` and use [xaringan](https://github.com/yihui/xaringan). To render slides to HTML:

```bash
Rscript -e "rmarkdown::render('slides/01-slides-intro.Rmd')"
```

To view rendered slides locally (recommended for embedded media like YouTube), serve the `slides/` directory over HTTP:

```bash
Rscript -e "servr::httw('slides')"
```

Then open `http://127.0.0.1:4321/01-slides-intro.html` (or the slide file you rendered).

To generate PDF versions of slides, use the `slides/make-pdf.R` script with [pagedown](https://github.com/rstudio/pagedown).

## Deployment

The site is automatically deployed via [Netlify](https://www.netlify.com/).

### How it works

1. Push changes to the `main` branch on GitHub
2. Netlify automatically detects the push and rebuilds the site
3. The site is published at the configured domain

### Important Notes

- The `public/` directory is ignored and not tracked in git. Netlify builds the site from source.
- Make sure to render `.Rmd` files to `.html` before pushing if you've made changes to lecture notes.
- The Hugo version used by Netlify is specified in `netlify.toml`.

### Manual Deployment

If you need to manually trigger a deployment:

1. Go to the Netlify dashboard
2. Navigate to the site's Deploys section
3. Click "Trigger deploy" > "Deploy site"

## Project Structure

```
.
├── config.yaml          # Main Hugo configuration
├── content/             # Site content
│   ├── home/            # Homepage widgets
│   ├── lecture-notes/   # Lecture notes (Rmd and HTML)
│   ├── assignments/     # Assignment pages
│   └── games/           # In-class games
├── slides/              # Xaringan slide decks
├── static/              # Static assets (images, PDFs, etc.)
├── themes/              # Hugo themes (Wowchemy)
└── netlify.toml         # Netlify deployment configuration
```

## Troubleshooting

### Hugo version errors
Make sure you're using Hugo extended version 0.139.0 or later. Check your version with:
```bash
hugo version
```

### R Markdown rendering issues
Ensure you have the required R packages installed:
```r
install.packages(c("rmarkdown", "blogdown", "xaringan"))
```

### Missing fonts in slides
Some slides use the [Lato](https://fonts.google.com/specimen/Lato) font. Install it locally or view slides in a browser with internet access.

## Offline Video Playback

Slides use locally-hosted MP4 files instead of YouTube embeds for reliable offline playback in classrooms.

### Prerequisites

Install video download tools (one-time):
```bash
brew install yt-dlp ffmpeg
```

### Downloading Videos

Download all videos listed in the manifest:
```bash
cd slides/scripts && ./download_videos.sh
```

The script skips already-downloaded files, so it's safe to re-run.

### Adding a New Video

1. **Add entry to `slides/video_manifest.csv`:**
   ```csv
   VIDEO_ID,NN-descriptive-name.mp4,NN-slides-name.Rmd,LINE,Description
   ```
   - `VIDEO_ID`: The YouTube video ID (from `youtube.com/watch?v=VIDEO_ID`)
   - Filename: Use format `NN-topic-description.mp4` matching slide file number
   - LINE: Approximate line number in the Rmd (for reference)

2. **Update the Rmd slide file:**

   In the setup chunk, ensure you have:
   ```r
   source("R/video_helpers.R")
   ```

   Where you want the video, add:
   ```r
   ```{r, echo = FALSE}
   local_video("videos/NN-descriptive-name.mp4")
   ```
   ```

3. **Download the new video:**
   ```bash
   cd slides/scripts && ./download_videos.sh
   ```

4. **Test:** Knit the slide deck and verify playback works offline.

### Validating Videos

Check that all videos in the manifest exist:
```r
setwd("slides")
source("R/video_helpers.R")
validate_videos()
```

### File Locations

- `slides/video_manifest.csv` - Master list of all videos
- `slides/videos/` - Downloaded MP4 files (git-ignored)
- `slides/scripts/download_videos.sh` - Download script
- `slides/R/video_helpers.R` - `local_video()` and `validate_videos()` functions
