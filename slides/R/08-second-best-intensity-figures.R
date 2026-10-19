# Stylized market diagrams for the intensity-standard section of Lecture 08.
# These plots separate the policy into its implicit tax on H and subsidy on L
# so the lecture can compare market-by-market deadweight loss to no policy.

sb_intensity_palette = c(
  pmb = "#638ccc",
  policy = "#000000",
  pmc = "#ca5670",
  damage = "darkslateblue",
  smc = "#2f255f",
  no_policy_dwl = "#ca5670",
  intensity_dwl = "#638ccc",
  guide = "grey50"
)

sb_intensity_theme = function() {
  ggplot2::theme_minimal() +
    ggplot2::theme(
      legend.position = "none",
      title = ggplot2::element_text(size = 20),
      axis.text.x = ggplot2::element_text(size = 20),
      axis.text.y = ggplot2::element_blank(),
      axis.title.x = ggplot2::element_text(size = 20),
      axis.title.y = ggplot2::element_text(size = 20, margin = ggplot2::margin(r = 48)),
      axis.ticks.y = ggplot2::element_blank(),
      panel.grid.minor.x = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_blank(),
      panel.grid.minor.y = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_blank(),
      panel.background = ggplot2::element_rect(fill = "#ffffff", colour = NA),
      plot.background = ggplot2::element_rect(fill = "#ffffff", colour = NA),
      axis.line = ggplot2::element_line(colour = "black"),
      plot.margin = ggplot2::margin(8, 14, 8, 8)
    )
}

# Parameter choices are purely illustrative. They preserve the lecture's
# qualitative point that the intensity standard reduces overproduction in H
# but expands overproduction in L because L is still polluting.
sb_intensity_market_parameters = function() {
  tibble::tribble(
    ~market, ~price, ~mc_intercept, ~mc_slope, ~emissions_rate,
    "H", 10, 0, 0.15, 1.0,
    "L", 10, 0, 0.15, 0.4
  ) |>
    dplyr::mutate(
      standard = 0.7,
      shadow_value = 6,
      marginal_damage = 3
    )
}

# Compute the unregulated, efficient, and intensity-standard quantities for
# each output market, along with the implied wedge and deadweight loss.
sb_intensity_market_outcomes = function() {
  sb_intensity_market_parameters() |>
    dplyr::mutate(
      private_surplus_intercept = price - mc_intercept,
      implicit_wedge = shadow_value * (emissions_rate - standard),
      marginal_damage_line = emissions_rate * marginal_damage,
      q_efficient = (private_surplus_intercept - marginal_damage_line) / mc_slope,
      q_unregulated = private_surplus_intercept / mc_slope,
      q_intensity_standard = (private_surplus_intercept - implicit_wedge) / mc_slope,
      gap_unregulated = marginal_damage_line,
      gap_intensity_standard = marginal_damage_line - implicit_wedge,
      dwl_unregulated = 0.5 * (q_unregulated - q_efficient) * gap_unregulated,
      dwl_intensity_standard = 0.5 * (q_intensity_standard - q_efficient) * gap_intensity_standard
    )
}

# Private marginal cost slopes upward and price is fixed for each firm.
# Marginal damage is the vertical distance between social and private cost.
sb_intensity_pmc = function(quantity, market_outcome) {
  market_outcome$mc_intercept + market_outcome$mc_slope * quantity
}

sb_intensity_social_marginal_cost = function(quantity, market_outcome) {
  sb_intensity_pmc(quantity, market_outcome) + market_outcome$marginal_damage_line
}

sb_intensity_curve_data = function(market_outcome) {
  # A common output range keeps the two markets comparable across reveals.
  all_outcomes = sb_intensity_market_outcomes()
  quantity_max = max(all_outcomes$q_unregulated,
    all_outcomes$q_intensity_standard) * 1.08

  tibble::tibble(
    quantity = seq(0, quantity_max, length.out = 300)
  ) |>
    dplyr::mutate(
      pmc = sb_intensity_pmc(quantity, market_outcome),
      pmb = market_outcome$price,
      policy_adjusted_pmc = sb_intensity_pmc(quantity, market_outcome) + market_outcome$implicit_wedge,
      marginal_damage_line = market_outcome$marginal_damage_line,
      social_marginal_cost = sb_intensity_social_marginal_cost(quantity, market_outcome)
    )
}

sb_intensity_dwl_data = function(market_outcome, quantity_column) {
  quantity_target = market_outcome[[quantity_column]]

  if (quantity_target <= market_outcome$q_efficient) {
    return(tibble::tibble(
      quantity = numeric(0),
      pmb = numeric(0),
      social_marginal_cost = numeric(0),
      lower_bound = numeric(0),
      upper_bound = numeric(0)
    ))
  }

  tibble::tibble(
    quantity = seq(market_outcome$q_efficient, quantity_target, length.out = 150)
  ) |>
    dplyr::mutate(
      pmb = market_outcome$price,
      social_marginal_cost = sb_intensity_social_marginal_cost(quantity, market_outcome),
      lower_bound = pmin(.data$pmb, .data$social_marginal_cost),
      upper_bound = pmax(.data$pmb, .data$social_marginal_cost)
    )
}

sb_intensity_dwl_triangle = function(market_outcome, quantity_column, triangle_group) {
  quantity_target = market_outcome[[quantity_column]]

  if (quantity_target <= market_outcome$q_efficient) {
    return(tibble::tibble(
      quantity = numeric(0),
      cost = numeric(0),
      triangle_group = character(0)
    ))
  }

  target_cost = sb_intensity_social_marginal_cost(quantity_target, market_outcome)

  tibble::tibble(
    quantity = c(
      market_outcome$q_efficient,
      quantity_target,
      quantity_target
    ),
    cost = c(
      market_outcome$price,
      market_outcome$price,
      target_cost
    ),
    triangle_group = triangle_group
  )
}

sb_intensity_quantity_breaks = function(market_outcome, show_policy = TRUE) {
  if (!show_policy) {
    return(tibble::tibble(
      quantity = c(
        market_outcome$q_efficient,
        market_outcome$q_unregulated
      ),
      label = c("q*", "q^0")
    ) |>
      dplyr::arrange(quantity))
  }

  tibble::tibble(
    quantity = c(
      market_outcome$q_efficient,
      market_outcome$q_unregulated,
      market_outcome$q_intensity_standard
    ),
    label = c("q*", "q^0", "q^IS")
  ) |>
    dplyr::arrange(quantity)
}

sb_intensity_quantity_labels = function(selected_market, show_policy = TRUE) {
  if (!show_policy) {
    if (selected_market == "H") {
      return(c(expression(q[H]^"*"), expression(q[H]^0)))
    }

    return(c(expression(q[L]^"*"), expression(q[L]^0)))
  }

  if (selected_market == "H") {
    c(expression(q[H]^"*"), expression(q[H]^IS), expression(q[H]^0))
  } else {
    c(expression(q[L]^"*"), expression(q[L]^0), expression(q[L]^IS))
  }
}

#' Draw one output market with optional social cost, policy, and DWL reveals.
#' @param market Dirtier output "H" or cleaner output "L".
#' @param show_policy Show marginal cost including the implicit tax or subsidy.
#' @param dwl_mode Shade no loss, baseline loss, both losses, or policy loss only.
#' @param show_social Show social marginal cost and the damage bracket.
#' @param show_efficient Show the efficient output guide.
#' @param show_policy_quantity Show the output guide under the standard.
#' @return A ggplot with the same axes and label space at every reveal.
sb_intensity_market_plot = function(
  market = c("H", "L"),
  show_policy = TRUE,
  dwl_mode = c("none", "baseline", "change", "policy"),
  show_social = TRUE,
  show_efficient = show_social,
  show_policy_quantity = show_policy
) {
  selected_market = match.arg(market)
  dwl_mode = match.arg(dwl_mode)
  market_outcome = sb_intensity_market_outcomes() |>
    dplyr::filter(.data$market == selected_market)
  curve_data = sb_intensity_curve_data(market_outcome)
  quantity_breaks = sb_intensity_quantity_breaks(market_outcome, show_policy = TRUE)
  quantity_labels = sb_intensity_quantity_labels(selected_market, show_policy = TRUE)
  visible_quantities = quantity_breaks$label == "q^0" |
    (quantity_breaks$label == "q*" & show_efficient) |
    (quantity_breaks$label == "q^IS" & show_policy & show_policy_quantity)
  # Invisible labels reserve identical space before each quantity is revealed.
  for (index in which(!visible_quantities)) {
    quantity_labels[[index]] = bquote(phantom(.(quantity_labels[[index]])))
  }
  policy_label = if (selected_market == "H") {
    "MC[H] + tax"
  } else {
    "MC[L] - subsidy"
  }
  pmb_label = if (selected_market == "H") {
    "p[H]"
  } else {
    "p[L]"
  }
  pmb_label_x = if (selected_market == "H") {
    curve_data$quantity[26]
  } else {
    curve_data$quantity[26]
  }
  pmb_label_y = if (selected_market == "H") {
    curve_data$pmb[26] + 0.75
  } else {
    curve_data$pmb[26] + 0.75
  }
  policy_label_x = if (selected_market == "H") {
    curve_data$quantity[76]
  } else {
    curve_data$quantity[136]
  }
  policy_label_y = if (selected_market == "H") {
    curve_data$policy_adjusted_pmc[76] + 0.55
  } else {
    curve_data$policy_adjusted_pmc[146] - 1.20
  }
  damage_label = if (selected_market == "H") {
    "beta[H] * MD"
  } else {
    "beta[L] * MD"
  }
  mc_label = if (selected_market == "H") {
    "MC[H]"
  } else {
    "MC[L]"
  }
  mc_label_x = if (selected_market == "H") {
    curve_data$quantity[58]
  } else {
    curve_data$quantity[60]
  }
  mc_label_y = if (selected_market == "H") {
    curve_data$pmc[58] - 0.8
  } else {
    curve_data$pmc[60] - 0.8
  }
  smc_label = if (selected_market == "H") {
    "SMC[H]"
  } else {
    "SMC[L]"
  }
  smc_label_x = if (selected_market == "H") {
    curve_data$quantity[72]
  } else {
    curve_data$quantity[108]
  }
  smc_label_y = if (selected_market == "H") {
    curve_data$social_marginal_cost[72] + 0.85
  } else {
    curve_data$social_marginal_cost[108] + 0.85
  }
  x_axis_label = if (selected_market == "H") {
    expression(Output ~~ q[H])
  } else {
    expression(Output ~~ q[L])
  }

  market_plot = ggplot2::ggplot(curve_data, ggplot2::aes(x = .data$quantity)) +
    ggplot2::geom_vline(xintercept = 0, linewidth = 1.0, color = "black") +
    ggplot2::geom_hline(
      yintercept = market_outcome$price,
      color = sb_intensity_palette[["pmb"]],
      linewidth = 1.5
    ) +
    ggplot2::geom_line(
      ggplot2::aes(y = .data$pmc),
      data = dplyr::filter(curve_data, .data$pmc >= 0, .data$pmc <= 13.5),
      color = sb_intensity_palette[["pmc"]],
      linewidth = 1.5
    ) +
    ggplot2::annotate("segment",
      x = quantity_breaks$quantity[visible_quantities],
      xend = quantity_breaks$quantity[visible_quantities],
      y = 0, yend = market_outcome$price,
      color = sb_intensity_palette[["guide"]], linewidth = 0.7,
      linetype = "dashed"
    ) +
    ggplot2::annotate(
      "text",
      x = pmb_label_x,
      y = pmb_label_y,
      label = pmb_label,
      parse = TRUE,
      color = sb_intensity_palette[["pmb"]],
      size = 5.8
    ) +
    ggplot2::annotate(
      "text",
      x = mc_label_x,
      y = mc_label_y,
      label = mc_label,
      parse = TRUE,
      color = sb_intensity_palette[["pmc"]],
      size = 5.8,
      angle = 31,
      hjust = 0
    ) +
    ggplot2::scale_x_continuous(
      breaks = quantity_breaks$quantity,
      labels = quantity_labels,
      expand = c(0, 0.02),
      guide = ggplot2::guide_axis(n.dodge = 1)
    ) +
    ggplot2::scale_y_continuous(
      expand = c(0, 0),
      breaks = NULL
    ) +
    ggplot2::coord_cartesian(xlim = range(curve_data$quantity),
      ylim = c(0, 13.5), clip = "off") +
    ggplot2::labs(
      title = if (selected_market == "H") "Dirtier output H" else "Cleaner output L",
      x = x_axis_label, y = "Price / cost"
    ) +
    sb_intensity_theme()

  if (show_social) {
    # The bracket measures SMC - MC at zero output; constant marginal damage
    # makes the same distance apply at every output level.
    market_plot = market_plot +
      ggplot2::geom_line(
        data = dplyr::filter(curve_data, .data$social_marginal_cost <= 13.5),
        ggplot2::aes(y = .data$social_marginal_cost),
        color = sb_intensity_palette[["smc"]], linewidth = 1.5
      ) +
      ggplot2::annotate("text", x = smc_label_x, y = smc_label_y,
        label = smc_label, parse = TRUE, color = sb_intensity_palette[["smc"]],
        size = 5.8, angle = 31, hjust = 0) +
      ggplot2::annotate("segment", x = 0, xend = 0,
        y = market_outcome$mc_intercept,
        yend = market_outcome$mc_intercept + market_outcome$marginal_damage_line,
        color = sb_intensity_palette[["damage"]], linewidth = 1.1,
        arrow = grid::arrow(ends = "both", type = "closed",
          length = grid::unit(0.065, "inches"))) +
      ggplot2::annotate("text", x = -1.4,
        y = market_outcome$mc_intercept + market_outcome$marginal_damage_line / 2,
        label = damage_label, parse = TRUE, color = sb_intensity_palette[["damage"]],
        size = 5.8, hjust = 1)
  }

  if (show_policy) {
    market_plot = market_plot +
      ggplot2::geom_line(
        data = dplyr::filter(curve_data,
          .data$policy_adjusted_pmc >= 0, .data$policy_adjusted_pmc <= 13.5),
        ggplot2::aes(y = .data$policy_adjusted_pmc),
        color = sb_intensity_palette[["policy"]],
        linewidth = 1.5,
        linetype = "22"
      ) +
      ggplot2::annotate(
        "text",
        x = policy_label_x,
        y = policy_label_y,
        label = policy_label,
        parse = TRUE,
        color = sb_intensity_palette[["policy"]],
        size = 5,
        angle = 31,
        hjust = 0
      )
  }

  if (dwl_mode == "none") {
    return(market_plot)
  }

  if (dwl_mode %in% c("baseline", "change")) {
    no_policy_dwl = sb_intensity_dwl_triangle(
      market_outcome,
      "q_unregulated",
      "no_policy"
    )

    market_plot = market_plot +
      ggplot2::geom_polygon(
        data = no_policy_dwl,
        ggplot2::aes(
          x = .data$quantity,
          y = .data$cost,
          group = .data$triangle_group
        ),
        inherit.aes = FALSE,
        fill = sb_intensity_palette[["no_policy_dwl"]],
        alpha = 0.28
      )

  }

  if (dwl_mode == "baseline") {
    return(market_plot)
  }

  intensity_dwl = sb_intensity_dwl_triangle(
    market_outcome,
    "q_intensity_standard",
    "intensity_standard"
  )

  market_plot +
    ggplot2::geom_polygon(
      data = intensity_dwl,
      ggplot2::aes(
        x = .data$quantity,
        y = .data$cost,
        group = .data$triangle_group
      ),
      inherit.aes = FALSE,
      fill = sb_intensity_palette[["intensity_dwl"]],
      alpha = 0.20
    )
}

# Combine the H and L panels so the lecture can compare the two distortions
# in either a horizontal or vertical layout.
sb_plot_intensity_market_pair = function(
  show_policy = TRUE,
  dwl_mode = c("none", "baseline", "change"),
  ncol = 2
) {
  dwl_mode = match.arg(dwl_mode)
  patchwork::wrap_plots(
    sb_intensity_market_plot("H", show_policy = show_policy, dwl_mode = dwl_mode),
    sb_intensity_market_plot("L", show_policy = show_policy, dwl_mode = dwl_mode),
    ncol = ncol
  )
}

#' Reveal the market diagrams one economic object at a time.
#' @param stage Integer from 1 (private choices) to 13 (comparison of DWL).
#' @return A pair of ggplots with fixed positions and one change per advance.
sb_intensity_market_step = function(stage = 13L) {
  stopifnot(length(stage) == 1L, stage %in% 1:13)
  market_plots = lapply(c("H", "L"), function(market) {
    is_high = market == "H"
    policy_stage = if (is_high) 6L else 8L
    quantity_stage = if (is_high) 7L else 9L
    baseline_stage = if (is_high) 4L else 5L
    after_policy_stage = if (is_high) 11L else 12L
    dwl_mode = if (stage >= after_policy_stage) {
      "policy"
    } else if ((stage >= baseline_stage && stage <= 5L) || stage >= 10L) {
      "baseline"
    } else {
      "none"
    }
    sb_intensity_market_plot(market,
      show_policy = stage >= policy_stage, dwl_mode = dwl_mode,
      show_social = stage >= 2L, show_efficient = stage >= 3L,
      show_policy_quantity = stage >= quantity_stage)
  })
  patchwork::wrap_plots(market_plots, ncol = 2)
}

# Geometry tests check the economic logic instead of the rendered pixels.
test_sb_intensity_market_figures = function() {
  market_outcomes = sb_intensity_market_outcomes()
  high_market = market_outcomes |>
    dplyr::filter(.data$market == "H")
  low_market = market_outcomes |>
    dplyr::filter(.data$market == "L")

  stopifnot(high_market$q_efficient < high_market$q_intensity_standard)
  stopifnot(high_market$q_intensity_standard < high_market$q_unregulated)
  stopifnot(low_market$q_efficient < low_market$q_unregulated)
  stopifnot(low_market$q_unregulated < low_market$q_intensity_standard)
  stopifnot(high_market$dwl_intensity_standard < high_market$dwl_unregulated)
  stopifnot(low_market$dwl_unregulated < low_market$dwl_intensity_standard)
  stopifnot(inherits(sb_plot_intensity_market_pair(show_policy = FALSE, dwl_mode = "baseline"), "patchwork"))
  stopifnot(inherits(sb_plot_intensity_market_pair(show_policy = TRUE, dwl_mode = "none"), "patchwork"))
  stopifnot(inherits(sb_plot_intensity_market_pair(show_policy = TRUE, dwl_mode = "change"), "patchwork"))
  stopifnot(inherits(sb_plot_intensity_market_pair(show_policy = TRUE, dwl_mode = "change", ncol = 1), "patchwork"))

  # Triangle area must equal the analytical DWL in each market.
  for (market_index in seq_len(nrow(market_outcomes))) {
    outcome = market_outcomes[market_index, ]
    curves = sb_intensity_curve_data(outcome)
    stopifnot(all(abs(curves$social_marginal_cost - curves$pmc -
      outcome$emissions_rate * outcome$marginal_damage) < 1e-10))
    for (allocation in c("unregulated", "intensity_standard")) {
      triangle = sb_intensity_dwl_triangle(outcome, paste0("q_", allocation), allocation)
      area = diff(range(triangle$quantity)) * diff(range(triangle$cost)) / 2
      stopifnot(abs(area - outcome[[paste0("dwl_", allocation)]]) < 1e-10)
    }
    plot = sb_intensity_market_plot(outcome$market, dwl_mode = "policy")
    horizontal_lines = Filter(function(layer) inherits(layer$geom, "GeomHline"), plot$layers)
    stopifnot(length(horizontal_lines) == 1L)
    stopifnot(horizontal_lines[[1]]$data$yintercept == outcome$price)
    # The y-axis arrow measures exactly beta_i MD, from MC(0) to SMC(0).
    segments = Filter(function(layer) inherits(layer$geom, "GeomSegment"), plot$layers)
    bracket = Filter(function(layer) all(layer$data$x == 0 & layer$data$xend == 0), segments)
    stopifnot(length(bracket) == 1L)
    stopifnot(abs(bracket[[1]]$data$y - outcome$mc_intercept) < 1e-10)
    stopifnot(abs(bracket[[1]]$data$yend - bracket[[1]]$data$y -
      outcome$emissions_rate * outcome$marginal_damage) < 1e-10)
  }

  # Introduce each policy curve before its new quantity guide; no reveal
  # overlays the old and new DWL fills in the same market.
  expected_guides = list(
    c(1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3),
    c(1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3)
  )
  grDevices::pdf(file = NULL)
  on.exit(grDevices::dev.off(), add = TRUE)
  plot_sizes = lapply(1:13, function(stage) {
    pair = sb_intensity_market_step(stage)
    for (market_index in 1:2) {
      plot = pair[[market_index]]
      segments = Filter(function(layer) inherits(layer$geom, "GeomSegment"), plot$layers)
      quantity_guides = segments[[1]]$data
      stopifnot(nrow(quantity_guides) == expected_guides[[market_index]][[stage]])
      stopifnot(all(quantity_guides$yend == 10))
      polygons = Filter(function(layer) inherits(layer$geom, "GeomPolygon"), plot$layers)
      stopifnot(length(polygons) <= 1L)
      built = ggplot2::ggplot_build(plot)
      stopifnot(all(vapply(built$data, function(layer) {
        all(is.finite(layer$x)) && all(is.finite(layer$y))
      }, logical(1))))
    }
    table = patchwork::patchworkGrob(pair)
    c(grid::convertWidth(table$widths, "mm", valueOnly = TRUE),
      grid::convertHeight(table$heights, "mm", valueOnly = TRUE))
  })
  stopifnot(all(vapply(plot_sizes, function(size) {
    isTRUE(all.equal(size, plot_sizes[[1]], tolerance = 1e-10))
  }, logical(1))))

  invisible(TRUE)
}
