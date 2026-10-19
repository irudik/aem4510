# Stylized recreation of Figure 2 in Holland, Hughes, and Knittel (2009),
# American Economic Journal: Economic Policy, doi:10.1257/pol.1.1.106.
# The paper uses private-surplus contours; this lecture illustration uses
# quadratic profit at fixed output prices, with C tangent to the standard.
# Wider contours make cutting dirty output less costly relative to expanding
# cleaner output, so the same standard can either raise or lower emissions.

#' Compute the private optimum and the choice under a binding standard.
#' @param emissions_case Use "rise" for tall ovals or "fall" for wider ovals.
#' @return A list of quantities, emissions rates, and objective curvature.
sb_diagram_choices = function(emissions_case = c("rise", "fall")) {
  emissions_case = match.arg(emissions_case)
  unregulated = c(h = 7, l = 3)
  curvature = c(h = if (emissions_case == "rise") 4 else 1.5, l = 1)
  emissions_rate = c(h = 1, l = 0.4)
  standard = 0.7
  slope = (emissions_rate[["h"]] - standard) /
    (standard - emissions_rate[["l"]])
  regulated_h = (curvature[["h"]] * unregulated[["h"]] +
    curvature[["l"]] * slope * unregulated[["l"]]) /
    (curvature[["h"]] + curvature[["l"]] * slope^2)
  regulated = c(h = regulated_h, l = slope * regulated_h)
  list(
    unregulated = unregulated, regulated = regulated,
    curvature = curvature, emissions_rate = emissions_rate,
    standard = standard, slope = slope,
    baseline_emissions = sum(emissions_rate * unregulated),
    regulated_emissions = sum(emissions_rate * regulated),
    surplus_loss = sum(curvature * (regulated - unregulated)^2)
  )
}

#' Draw an iso-profit oval from the quadratic loss relative to A.
#' @param loss Twice the profit loss relative to the unregulated optimum.
#' @param emissions_case Use "rise" for tall ovals or "fall" for wider ovals.
#' @return A data frame of dirty and cleaner output on the oval.
sb_diagram_oval = function(loss, emissions_case = "rise") {
  choices = sb_diagram_choices(emissions_case)
  angle = seq(0, 2 * pi, length.out = 401)
  data.frame(
    h = choices$unregulated[["h"]] +
      sqrt(loss / choices$curvature[["h"]]) * cos(angle),
    l = choices$unregulated[["l"]] +
      sqrt(loss / choices$curvature[["l"]]) * sin(angle)
  )
}

#' Build one cumulative reveal of the intensity-standard diagram.
#' @param stage Integer from 1 (axes) to 10 (the change in total emissions).
#' @param show_feasible Show the feasible-region shading and label once the line appears.
#' @param emissions_case Use "rise" for tall ovals or "fall" for wider ovals.
#' @return A ggplot with fixed axes and text sizes across all reveals.
sb_intensity_diagram = function(stage = 10L, show_feasible = stage >= 6,
    emissions_case = "rise") {
  stopifnot(length(stage) == 1L, stage %in% 1:10)
  choices = sb_diagram_choices(emissions_case)
  a = choices$unregulated
  c = choices$regulated
  emissions_rise = choices$regulated_emissions > choices$baseline_emissions
  blue = "#638ccc"
  red = "#ca5670"
  purple = "#2f255f"
  label_point = function(plot, point, label, color) {
    plot +
      ggplot2::annotate("point", x = point[["h"]], y = point[["l"]],
        size = 3.5, color = color) +
      ggplot2::annotate("text", x = point[["h"]] + 0.42,
        y = point[["l"]] + 0.18, label = label, size = 6, color = color)
  }
  plot = ggplot2::ggplot() +
    ggplot2::geom_blank(data = data.frame(h = c(0, 10), l = c(0, 9.5)),
      ggplot2::aes(x = h, y = l)) +
    ggplot2::scale_x_continuous(
      breaks = c(c[["h"]], a[["h"]]),
      labels = c(expression(Q[H]^IS), expression(Q[H]^0)),
      expand = c(0, 0)) +
    ggplot2::scale_y_continuous(
      breaks = c(a[["l"]], c[["l"]]),
      labels = c(expression(Q[L]^0), expression(Q[L]^IS)),
      expand = c(0, 0)) +
    ggplot2::coord_cartesian(xlim = c(0, 10), ylim = c(0, 9.5), clip = "on") +
    ggplot2::labs(x = expression("Dirty output " * Q[H]),
      y = expression("Cleaner output " * Q[L])) +
    ggplot2::theme_classic(base_size = 20, base_family = "sans") +
    ggplot2::theme(axis.ticks = ggplot2::element_blank(),
      # Invisible labels reserve the same space before quantities are revealed.
      axis.text = ggplot2::element_text(color = if (stage >= 8) "grey30" else "white"),
      axis.line = ggplot2::element_line(linewidth = 0.6),
      plot.margin = ggplot2::margin(8, 10, 8, 8))

  # Choices above the standard use enough cleaner output to satisfy the limit.
  # Shade them from the origin to the top of the plotted quantity range.
  if (stage >= 6 && show_feasible) {
    feasible_region = data.frame(
      h = c(0, 9.5 / choices$slope, 0),
      l = c(0, 9.5, 9.5)
    )
    plot = plot + ggplot2::geom_polygon(data = feasible_region,
      ggplot2::aes(x = h, y = l), fill = blue, alpha = 0.09) +
      ggplot2::annotate("text", x = 2.1, y = 4.7,
        label = "Feasible\nregion", color = blue, size = 5)
  }

  # The region above the emissions line contains choices with E > K.
  # Add its fill before the other objects so it never obscures their labels.
  if (stage >= 5) {
    boundary = data.frame(h = seq(0, 10, length.out = 301))
    boundary$l = (choices$baseline_emissions -
      choices$emissions_rate[["h"]] * boundary$h) /
      choices$emissions_rate[["l"]]
    boundary = boundary[boundary$l <= 9.5, ]
    plot = plot + ggplot2::geom_ribbon(data = boundary,
      ggplot2::aes(x = h, ymin = pmax(l, 0), ymax = 9.5),
      fill = red, alpha = 0.09) +
      ggplot2::annotate("text", x = 8.7, y = 7.3,
        label = "Higher total\nemissions", color = red, size = 5)
  }
  if (stage >= 2) {
    plot = plot +
      ggplot2::geom_path(data = sb_diagram_oval(1.6, emissions_case),
        ggplot2::aes(x = h, y = l), linetype = "dashed", linewidth = 0.8) +
      ggplot2::geom_path(data = sb_diagram_oval(choices$surplus_loss, emissions_case),
        ggplot2::aes(x = h, y = l), linetype = "dashed", linewidth = 0.8)
  }
  if (stage >= 3) {
    plot = label_point(plot, a, "A", "black")
  }
  if (stage >= 4) {
    plot = plot +
      ggplot2::geom_abline(intercept = choices$baseline_emissions /
        choices$emissions_rate[["l"]], slope = -choices$emissions_rate[["h"]] /
        choices$emissions_rate[["l"]], color = red, linewidth = 1) +
      # Keep the label outside the band between the two emissions lines.
      ggplot2::annotate("text", x = if (emissions_rise) 4.55 else 5.5,
        y = if (emissions_rise) 7.8 else 7.9,
        label = "beta[H]*Q[H]+beta[L]*Q[L]==K",
        parse = TRUE, color = red, size = 5, angle = -64)
  }
  if (stage >= 6) {
    plot = plot +
      ggplot2::geom_abline(intercept = 0, slope = choices$slope,
        color = blue, linewidth = 1.2) +
      ggplot2::annotate("text", x = 2.7, y = 1.7,
        label = "Q[L]==frac(beta[H]-sigma,sigma-beta[L])*Q[H]",
        parse = TRUE, color = blue, size = 5, angle = 40)
  }
  if (stage >= 7) {
    plot = label_point(plot, c, "C", blue)
  }
  if (stage >= 8) {
    plot = plot +
      ggplot2::annotate("segment", x = c(a[["h"]], c[["h"]]),
        xend = c(a[["h"]], c[["h"]]), y = 0,
        yend = c(a[["l"]], c[["l"]]), linetype = "dotted", color = "grey50") +
      ggplot2::annotate("segment", x = 0,
        xend = c(a[["h"]], c[["h"]]), y = c(a[["l"]], c[["l"]]),
        yend = c(a[["l"]], c[["l"]]), linetype = "dotted", color = "grey50")
  }
  if (stage >= 9) {
    plot = plot + ggplot2::annotate("segment", x = a[["h"]] - 0.1,
      y = a[["l"]] + 0.3, xend = c[["h"]] + 0.12, yend = c[["l"]] - 0.4,
      arrow = grid::arrow(length = grid::unit(0.18, "inches")),
      color = blue, linewidth = 1)
  }
  if (stage >= 10) {
    plot = plot + ggplot2::geom_abline(
      intercept = choices$regulated_emissions / choices$emissions_rate[["l"]],
      slope = -choices$emissions_rate[["h"]] / choices$emissions_rate[["l"]],
      color = purple, linewidth = 1, linetype = "dotdash") +
      ggplot2::annotate("text", x = 8.7, y = if (emissions_rise) 6.4 else 2,
        label = if (emissions_rise) "E[C] > E[A]" else "E[C] < E[A]",
        parse = TRUE, color = purple, size = 5)
  }
  plot
}

#' Check tangency, the binding constraint, and both signs of the emissions effect.
#' @return TRUE invisibly if geometry and all reveal stages pass.
test_sb_intensity_diagram = function() {
  grDevices::pdf(file = NULL)
  on.exit(grDevices::dev.off(), add = TRUE)
  rising = sb_diagram_choices("rise")
  falling = sb_diagram_choices("fall")
  stopifnot(identical(rising$unregulated, falling$unregulated))
  stopifnot(identical(rising$emissions_rate, falling$emissions_rate))
  stopifnot(identical(rising$standard, falling$standard))
  # Only curvature changes: the second set of ovals is wider at the same loss.
  tall = sb_diagram_oval(1.6, "rise")
  wide = sb_diagram_oval(1.6, "fall")
  stopifnot(diff(range(wide$h)) > diff(range(tall$h)))
  stopifnot(isTRUE(all.equal(range(wide$l), range(tall$l))))
  stopifnot(falling$regulated[["h"]] < rising$regulated[["h"]])
  for (emissions_case in c("rise", "fall")) {
    choices = sb_diagram_choices(emissions_case)
    a = choices$unregulated
    c = choices$regulated
    gradient = choices$curvature * (c - a)
    stopifnot(abs(c[["l"]] - choices$slope * c[["h"]]) < 1e-10)
    stopifnot(abs(gradient[["h"]] + choices$slope * gradient[["l"]]) < 1e-10)
    stopifnot(c[["h"]] < a[["h"]], c[["l"]] > a[["l"]])
    # Output expands in both examples, but wider ovals allow more substitution.
    stopifnot(sum(c) > sum(a))
    emissions_change = choices$regulated_emissions - choices$baseline_emissions
    stopifnot(if (emissions_case == "rise") emissions_change > 0 else emissions_change < 0)
    stopifnot(abs(choices$regulated_emissions / sum(c) - choices$standard) < 1e-10)
    stopifnot(choices$baseline_emissions / sum(a) > choices$standard)
    # Every point on the outer oval has the same profit as C.
    oval = sb_diagram_oval(choices$surplus_loss, emissions_case)
    loss = choices$curvature[["h"]] * (oval$h - a[["h"]])^2 +
      choices$curvature[["l"]] * (oval$l - a[["l"]])^2
    stopifnot(max(abs(loss - choices$surplus_loss)) < 1e-10)
    # Every vertex of the shaded feasible region satisfies the intensity limit.
    # Its interior is strictly feasible, while A violates the same limit.
    feasible_plot = sb_intensity_diagram(6, emissions_case = emissions_case)
    feasible_layer = Filter(function(layer) {
      inherits(layer$geom, "GeomPolygon")
    }, feasible_plot$layers)[[1]]
    feasible_vertices = feasible_layer$data
    excess_emissions = (choices$emissions_rate[["h"]] - choices$standard) *
      feasible_vertices$h + (choices$emissions_rate[["l"]] - choices$standard) *
      feasible_vertices$l
    stopifnot(all(excess_emissions <= 1e-10), mean(excess_emissions) < 0)
    # The line-only reveal precedes both the feasible-region fill and its label.
    line_only = sb_intensity_diagram(6, show_feasible = FALSE, emissions_case = emissions_case)
    stopifnot(!any(vapply(line_only$layers, function(layer) {
      inherits(layer$geom, "GeomPolygon")
    }, logical(1))))
    line_only_labels = unlist(lapply(ggplot2::ggplot_build(line_only)$data, function(layer) {
      layer$label
    }))
    stopifnot(!("Feasible\nregion" %in% line_only_labels))
    stopifnot("Q[L]==frac(beta[H]-sigma,sigma-beta[L])*Q[H]" %in% line_only_labels)
    layer_counts = vapply(1:10, function(stage) {
      built_plot = ggplot2::ggplot_build(sb_intensity_diagram(stage, emissions_case = emissions_case))
      stopifnot(all(vapply(built_plot$data, function(layer) {
        all(is.finite(layer$x)) && all(is.finite(layer$y))
      }, logical(1))))
      length(built_plot$data)
    }, integer(1))
    stopifnot(all(diff(layer_counts) > 0))
    # Revealing quantity labels must not move the axes or resize the diagram.
    plot_sizes = lapply(1:10, function(stage) {
      plot_table = ggplot2::ggplotGrob(sb_intensity_diagram(stage, emissions_case = emissions_case))
      c(grid::convertWidth(plot_table$widths, "mm", valueOnly = TRUE),
        grid::convertHeight(plot_table$heights, "mm", valueOnly = TRUE))
    })
    stopifnot(all(vapply(plot_sizes, function(size) {
      isTRUE(all.equal(size, plot_sizes[[1]], tolerance = 1e-10))
    }, logical(1))))
  }
  invisible(TRUE)
}
