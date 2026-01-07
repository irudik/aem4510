# Makes pdf slides for all lectures
lapply(list.files(path = "slides", pattern = "\\.html$", full.names = TRUE),
       function(file) {
         xaringan::decktape(
           file,
           output = paste0(tools::file_path_sans_ext(file), ".pdf"),
           docker = FALSE
         )
       }
)
