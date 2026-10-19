# Welfare areas for a competitive market with constant marginal damage.
# Demand is p(q) = 2.5 - q, MC = 1, and marginal damage = 0.5.

#' Return the vertices of welfare areas A, B, and C.
#' @return A data frame identifying each area and its ordered vertices.
sb_competition_areas = function() {
  data.frame(
    area = c(rep("A", 4), rep("B", 3), rep("C", 3)),
    quantity = c(0, 1, 1, 0, 1, 1.5, 1, 1, 1.5, 1.5),
    value = c(1, 1, 1.5, 1.5, 1, 1, 1.5, 1.5, 1, 1.5)
  )
}

#' Select the welfare areas discussed at each teaching step.
#' @param stage Integer from 1 (no shading) to 5 (net welfare gain).
#' @return The area names to highlight at this stage.
sb_competition_highlight = function(stage) {
  stopifnot(length(stage) == 1L, stage %in% 1:5)
  list(character(), c("A", "B"), c("B", "C"), "A", "C")[[stage]]
}

#' Draw the competitive market with one welfare component highlighted.
#' @param stage Integer from 1 (no shading) to 5 (net welfare gain).
#' @return A ggplot with identical axes and labels across teaching steps.
sb_competition_plot = function(stage = 1L) {
  highlighted_areas = sb_competition_highlight(stage)
  colors = c("grey50", "#ca5670", "#2B8C7F", "#D99000", "#638ccc")
  areas = sb_competition_areas()
  selected_areas = areas[areas$area %in% highlighted_areas, ]
  labels = data.frame(
    area = c("A", "B", "C"),
    quantity = c(0.5, 7 / 6, 4 / 3),
    value = c(1.25, 7 / 6, 4 / 3)
  )
  labels$color = ifelse(stage == 1 | labels$area %in% highlighted_areas,
    "black", "grey65")

  ggplot2::ggplot() +
    ggplot2::geom_polygon(data = selected_areas,
      ggplot2::aes(x = quantity, y = value, group = area),
      fill = colors[[stage]], alpha = 0.4) +
    ggplot2::annotate("segment", x = 0, xend = 2.6,
      y = 1.5, yend = 1.5, color = "black", linewidth = 1.2) +
    ggplot2::annotate("segment", x = 0, xend = 2.6,
      y = 1, yend = 1, color = "#ca5670", linewidth = 1.2) +
    ggplot2::annotate("segment", x = 0, xend = 2.5,
      y = 2.5, yend = 0, color = "#638ccc", linewidth = 1.2) +
    ggplot2::annotate("segment", x = c(1, 1.5), xend = c(1, 1.5),
      y = 0, yend = 1.5, linetype = "dashed", color = "grey50", linewidth = 0.7) +
    ggplot2::annotate("text", x = 0.55, y = 2.4, label = "Demand", size = 6) +
    ggplot2::annotate("text", x = 2.3, y = 1.63, label = "SMC", size = 6) +
    ggplot2::annotate("text", x = 2.3, y = 1.13, label = "MC", size = 6) +
    ggplot2::geom_text(data = labels,
      ggplot2::aes(x = quantity, y = value, label = area, color = color),
      size = 6, fontface = "bold") +
    ggplot2::scale_color_identity() +
    ggplot2::scale_x_continuous(limits = c(0, 2.6), expand = c(0, 0),
      breaks = c(1, 1.5), labels = c(expression(q^"*"), expression(q[0]))) +
    ggplot2::scale_y_continuous(limits = c(0, 2.7), expand = c(0, 0), breaks = NULL) +
    ggplot2::labs(x = "Emissions / Output", y = "Capital/$") +
    ggplot2::theme_classic(base_size = 20, base_family = "sans") +
    ggplot2::theme(axis.ticks = ggplot2::element_blank(),
      axis.line = ggplot2::element_line(linewidth = 0.6),
      plot.margin = ggplot2::margin(8, 10, 8, 8))
}

#' Verify that the shaded polygons equal the economic welfare changes.
#' @return TRUE invisibly if areas and all five teaching steps pass.
test_sb_competition_figures = function() {
  areas = split(sb_competition_areas(), sb_competition_areas()$area)
  area_values = vapply(areas, function(vertices) {
    next_vertex = c(2:nrow(vertices), 1)
    abs(sum(vertices$quantity * vertices$value[next_vertex] -
      vertices$quantity[next_vertex] * vertices$value)) / 2
  }, numeric(1))
  q_unregulated = 1.5
  q_efficient = 1
  damage = 0.5
  cs_before = 0.5 * q_unregulated * (2.5 - 1)
  cs_after = 0.5 * q_efficient * (2.5 - 1.5)
  avoided_damages = damage * (q_unregulated - q_efficient)
  revenue = damage * q_efficient
  net_gain = cs_after - cs_before + avoided_damages + revenue
  stopifnot(all(area_values > 0))
  stopifnot(abs(sum(area_values[c("A", "B")]) - (cs_before - cs_after)) < 1e-10)
  stopifnot(abs(sum(area_values[c("B", "C")]) - avoided_damages) < 1e-10)
  stopifnot(abs(area_values[["A"]] - revenue) < 1e-10)
  stopifnot(abs(area_values[["C"]] - net_gain) < 1e-10)

  for (stage in 1:5) {
    plot = sb_competition_plot(stage)
    shaded = plot$layers[[1]]$data
    stopifnot(setequal(unique(shaded$area), sb_competition_highlight(stage)))
    built = ggplot2::ggplot_build(plot)
    stopifnot(all(vapply(built$data, function(layer) {
      all(is.finite(layer$x)) && all(is.finite(layer$y))
    }, logical(1))))
  }
  invisible(TRUE)
}
