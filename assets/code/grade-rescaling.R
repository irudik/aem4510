# Load packages
if (!require("pacman")) install.packages("pacman")
pacman::p_load(
  data.table, janitor, magrittr, fixest, 
  broom, tidyverse, tidylog
)
options("tidylog.display" = NULL)
`%notin%` = Negate(`%in%`)

## fair: returns expected normal grade versus 2-prelim grade
set.seed(1)
grade_out = lapply(1:10000, function(x) {
  grades = rnorm(3, 50, 5)
  grades[grades > 100] = 100
  grades[grades < 0] = 0
  exams = sort(grades, decreasing = TRUE)
  grade = .15/.4*exams[1] + .15/.4*exams[2] + .1/.4*exams[3]
  
  grade_alt = 
    c(.24/.4*exams[2] + .16/.4*exams[3],
      .24/.4*exams[1] + .16/.4*exams[3],
      .24/.4*exams[1] + .16/.4*exams[2]
    )
  return(grade - mean(grade_alt))
}
) |>
  cbind() |>
  unlist() |>
  mean()


##unfair
exams = sort(c(99, 99, 100), decreasing = TRUE)
grade = .15/.4*exams[1] + .15/.4*exams[2] + .1/.4*exams[3]

grade_alt = 
  c(.3/.4*exams[2] + .1/.4*exams[3],
    .3/.4*exams[1] + .1/.4*exams[3],
    .3/.4*exams[1] + .1/.4*exams[2]
  ) |> mean()
grade*.4
grade_alt*.4
