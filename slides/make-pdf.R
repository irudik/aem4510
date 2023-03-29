# Makes pdf slides for all lectures
lapply(list.files(pattern = "*.html", recursive = T)[11], 
       function(file) {
         xaringan::decktape(
           file, 
           output = paste0(tools::file_path_sans_ext(file), ".pdf")
           )
       }
)

