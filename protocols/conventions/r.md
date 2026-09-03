# R Code Standards

**Standard:** Senior Principal Data Engineer + PhD researcher quality

## 1. Reproducibility

- `set.seed()` called ONCE at top (YYYYMMDD format)
- All packages loaded at top via `library()` (not `require()`)
- All paths relative to the script working directory (usually `code/[task_group]/`)
- Rely on the Makefile to make directories

## 2. Function Design

- `snake_case` naming, verb-noun pattern
- Roxygen-style documentation
- Default parameters, no magic numbers
- Named return values (lists or tibbles)

## 3. Domain Correctness

<!-- Customize for your field's known pitfalls -->
- Verify estimator implementations match paper formulas (`latex/manuscript.tex`)
- Check known package bugs (document below in Common Pitfalls)

## 4. Visual Identity

```r
# --- Your institutional palette ---
plot_blue = "#4575b4"
plot_mid = "#ffffdf"
plot_red = "#d73027"
plot_purple = "#c51b7d"
plot_green = "#3a7813"
```

### Fonts

```
sysfonts::font_add_google("Lato")
sysfonts::font_add_google("Fira Sans")
```

### Custom Themes

```r
# Regular plots
main_theme <-
  theme_classic() +
  theme(
    legend.position = "none",
    title = element_text(size = 24),
    text = element_text(family = font_choice),
    axis.text.x = element_text(size = 30), axis.text.y = element_text(size = 30),
    axis.title.x = element_text(size = 30), axis.title.y = element_text(size = 30),
    panel.grid.minor.x = element_blank(), panel.grid.major.y = element_blank(),
    panel.grid.minor.y = element_blank(), panel.grid.major.x = element_blank(),
    axis.line = element_line(colour = "black"), axis.ticks = element_line(colour = "black"),
    plot.background = element_rect(fill = "#ffffff")
  )

# Maps
map_theme <-
  theme_void() +
  theme(
    legend.position = "bottom",
    legend.key.height = unit(.35, "cm"),
    legend.key.width = unit(.6, "cm"),
    legend.text = element_text(size = 8),
    text = element_text(family = "Lato"),
  )
```

### Figure Dimensions (for slides template)

```r
# Maps
ggsave(filepath, width = 8, height = 4, bg = "transparent")
# Figures
ggsave(filepath, width = 8, height = 8, bg = "transparent")
```

## 5. Output Paths

Task-group scripts usually run from `code/[task_group]/`, so paths are
relative to that working directory. In the standard layout, define
`output_root` once and write into the main subdirectories under the repo-root
`output/` directory:

```r
output_root = file.path("..", "..", "output")

# Figures
ggsave(file.path(output_root, "figures", "my_plot.pdf"), width = 8, height = 8, bg = "transparent")

# Tables / RDS
saveRDS(result, file.path(output_root, "tables", "my_results.rds"))

# Inline numbers for manuscript (\newcommand .txt files)
writeLines("\\newcommand{\\myEstimate}{2.31}",
           file.path(output_root, "numbers", "my_estimate.txt"))
```

**Heavy computations saved as RDS; slide rendering loads pre-computed data.**

## 6. Common Pitfalls

<!-- Add your field-specific pitfalls here -->
| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Missing `bg = "transparent"` | White boxes on slides | Always include in ggsave() |
| Hardcoded paths | Breaks on other machines | Use relative paths |

## 7. Line Length & Mathematical Exceptions

**Standard:** Keep lines <= 120 characters.

**Exception:** Mathematical formulas may exceed 120 chars if breaking the line would harm readability, an inline comment explains the operation, and the line is in a numerically intensive section.

## 8. Code Quality Checklist

```
[ ] Packages at top via library()
[ ] set.seed() once at top
[ ] Clean header block with purpose, inputs, outputs, and assumptions
[ ] All paths relative to the script working directory
[ ] Functions documented (Roxygen)
[ ] One operation per line; long calls split by argument where readable
[ ] Descriptive snake_case names that read like prose
[ ] Figures: transparent bg, explicit dimensions
[ ] RDS: every computed object saved
[ ] Comments explain WHY not WHAT
```
