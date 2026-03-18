# Schematic carbon tariff figures for Lecture 09.
# These plots preserve the economic geometry from the paper using simple linear
# demand, supply, and marginal-social-cost schedules that are easy to test.

ct_palette = list(
  demand = "#6f8fcf",
  supply = "#8f8f8f",
  msc = "#5b5b5b",
  tax = "#4f81bd",
  tariff = "#f2b233",
  loss = "#c9c9c9",
  gain = "#7fbf7b",
  guide = "#9bb4e5",
  accent = "#c44e52",
  foreign = "#7a68c5"
)

# Country-i market geometry.
ct_country_parameters = function() {
  list(
    demand_intercept = 95,
    demand_slope = 0.80,
    supply_intercept = 15,
    supply_slope = 0.90,
    external_cost = 10,
    world_price = 45,
    carbon_tax = 10,
    tariff = 10
  )
}

# World-market geometry used for the paper's two-panel figures.
ct_world_parameters = function() {
  list(
    demand_intercept = 74,
    demand_slope = 0.45,
    supply_intercept = 20,
    supply_slope = 0.35,
    external_cost = 10,
    world_price_shift = 6
  )
}

ct_country_supply = function(q, parameters) {
  parameters$supply_intercept + parameters$supply_slope * q
}

ct_country_demand = function(q, parameters) {
  parameters$demand_intercept - parameters$demand_slope * q
}

ct_country_msc = function(q, parameters) {
  ct_country_supply(q, parameters) + parameters$external_cost
}

ct_world_supply = function(q, parameters) {
  parameters$supply_intercept + parameters$supply_slope * q
}

ct_world_demand = function(q, parameters) {
  parameters$demand_intercept - parameters$demand_slope * q
}

ct_world_msc = function(q, parameters) {
  ct_world_supply(q, parameters) + parameters$external_cost
}

ct_inverse_supply = function(price, intercept, slope) {
  (price - intercept) / slope
}

ct_inverse_demand = function(price, intercept, slope) {
  (intercept - price) / slope
}

# Quantities used across Figures 1, 3, and 4.
ct_country_outcomes = function(parameters = ct_country_parameters()) {
  world_price = parameters$world_price
  tariff_inclusive_price = world_price + parameters$tariff
  producer_price_with_tax = world_price - parameters$carbon_tax

  q_supply = ct_inverse_supply(
    world_price,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_supply_tariff = ct_inverse_supply(
    tariff_inclusive_price,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_supply_tax = ct_inverse_supply(
    producer_price_with_tax,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_demand = ct_inverse_demand(
    world_price,
    parameters$demand_intercept,
    parameters$demand_slope
  )
  q_demand_tariff = ct_inverse_demand(
    tariff_inclusive_price,
    parameters$demand_intercept,
    parameters$demand_slope
  )
  q_msc = ct_inverse_supply(
    world_price - parameters$external_cost,
    parameters$supply_intercept,
    parameters$supply_slope
  )

  tibble::tibble(
    world_price = world_price,
    tariff_price = tariff_inclusive_price,
    producer_price_with_tax = producer_price_with_tax,
    q_supply = q_supply,
    q_supply_tariff = q_supply_tariff,
    q_supply_tax = q_supply_tax,
    q_demand = q_demand,
    q_demand_tariff = q_demand_tariff,
    q_msc = q_msc,
    imports_free_trade = q_demand - q_supply,
    imports_with_tariff = q_demand_tariff - q_supply_tariff,
    imports_with_tax = q_demand - q_supply_tax,
    imports_with_tax_tariff = q_demand_tariff - q_supply
  )
}

# World outcomes used in Figures 1 and 2.
ct_world_outcomes = function(parameters = ct_world_parameters()) {
  q_world = (parameters$demand_intercept - parameters$supply_intercept) /
    (parameters$demand_slope + parameters$supply_slope)
  q_world_star = (parameters$demand_intercept - parameters$supply_intercept - parameters$external_cost) /
    (parameters$demand_slope + parameters$supply_slope)
  world_price = ct_world_supply(q_world, parameters)
  efficient_price = ct_world_msc(q_world_star, parameters)
  world_price_with_small_tax = world_price + parameters$world_price_shift

  tibble::tibble(
    q_world = q_world,
    q_world_star = q_world_star,
    world_price = world_price,
    efficient_price = efficient_price,
    world_price_with_small_tax = world_price_with_small_tax
  )
}

# A world carbon price that is positive but smaller than the full external cost.
ct_small_world_tax_outcomes = function(
  country_parameters = ct_country_parameters(),
  world_parameters = ct_world_parameters(),
  small_tax = 6,
  world_price_increase = 4
) {
  no_policy_world_price = country_parameters$world_price
  world_price_small_tax = no_policy_world_price + world_price_increase
  producer_price_small_tax = world_price_small_tax - small_tax

  q_supply_small_tax = ct_inverse_supply(
    producer_price_small_tax,
    country_parameters$supply_intercept,
    country_parameters$supply_slope
  )
  q_supply_no_policy = ct_inverse_supply(
    no_policy_world_price,
    country_parameters$supply_intercept,
    country_parameters$supply_slope
  )
  q_demand_small_tax = ct_inverse_demand(
    world_price_small_tax,
    country_parameters$demand_intercept,
    country_parameters$demand_slope
  )

  q_world_no_policy = (world_parameters$demand_intercept - world_parameters$supply_intercept) /
    (world_parameters$demand_slope + world_parameters$supply_slope)
  q_world_small_tax = (world_parameters$demand_intercept - world_parameters$supply_intercept - small_tax) /
    (world_parameters$demand_slope + world_parameters$supply_slope)
  world_price_no_policy = ct_world_supply(q_world_no_policy, world_parameters)
  world_price_small = ct_world_demand(q_world_small_tax, world_parameters)

  tibble::tibble(
    small_tax = small_tax,
    world_price_increase = world_price_increase,
    no_policy_world_price = no_policy_world_price,
    world_price_small_tax = world_price_small_tax,
    producer_price_small_tax = producer_price_small_tax,
    q_supply_small_tax = q_supply_small_tax,
    q_supply_no_policy = q_supply_no_policy,
    q_demand_small_tax = q_demand_small_tax,
    q_world_no_policy = q_world_no_policy,
    q_world_small_tax = q_world_small_tax,
    world_price_no_policy = world_price_no_policy,
    world_price_small = world_price_small
  )
}

ct_intensity_outcomes = function(
  parameters = ct_country_parameters(),
  domestic_tax = 8,
  foreign_tax = 12
) {
  world_price = parameters$world_price
  consumer_price_domestic = world_price + domestic_tax
  consumer_price_foreign = world_price + foreign_tax
  producer_price_foreign = consumer_price_foreign - domestic_tax

  q_supply_tax_domestic = ct_inverse_supply(
    world_price - domestic_tax,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_supply = ct_inverse_supply(
    world_price,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_supply_foreign_tariff = ct_inverse_supply(
    producer_price_foreign,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_demand_domestic_tariff = ct_inverse_demand(
    consumer_price_domestic,
    parameters$demand_intercept,
    parameters$demand_slope
  )
  q_demand_foreign_tariff = ct_inverse_demand(
    consumer_price_foreign,
    parameters$demand_intercept,
    parameters$demand_slope
  )

  tibble::tibble(
    domestic_tax = domestic_tax,
    foreign_tax = foreign_tax,
    world_price = world_price,
    consumer_price_domestic = consumer_price_domestic,
    consumer_price_foreign = consumer_price_foreign,
    producer_price_foreign = producer_price_foreign,
    q_supply_tax_domestic = q_supply_tax_domestic,
    q_supply = q_supply,
    q_supply_foreign_tariff = q_supply_foreign_tariff,
    q_demand_domestic_tariff = q_demand_domestic_tariff,
    q_demand_foreign_tariff = q_demand_foreign_tariff
  )
}

ct_plot_theme = function() {
  ggplot2::theme_void(base_size = 16) +
    ggplot2::theme(
      plot.margin = ggplot2::margin(10, 18, 14, 18),
      plot.title = ggplot2::element_text(size = 18, face = "bold", hjust = 0),
      plot.subtitle = ggplot2::element_text(size = 14, hjust = 0.5)
    )
}

ct_base_plot = function(
  x_limit = c(0, 82),
  y_limit = c(0, 86),
  x_label = "q[i]",
  x_axis_end = 78,
  x_label_x = x_axis_end + 1
) {
  ggplot2::ggplot() +
    ggplot2::coord_cartesian(xlim = x_limit, ylim = y_limit, clip = "off") +
    ggplot2::annotate(
      "segment", x = 8, xend = 8, y = 8, yend = 82, linewidth = 0.7
    ) +
    ggplot2::annotate(
      "segment", x = 8, xend = x_axis_end, y = 8, yend = 8, linewidth = 0.7
    ) +
    ggplot2::annotate(
      "text", x = 7, y = 84, label = "P", size = 5.0, hjust = 0.5
    ) +
    ggplot2::annotate(
      "text", x = x_label_x, y = 5, label = x_label, parse = TRUE, size = 5.0, hjust = 1
    ) +
    ct_plot_theme()
}

ct_curve_data = function(q_grid, curve_function, y_floor = 8) {
  tibble::tibble(q = q_grid, p = curve_function(q_grid)) |>
    dplyr::filter(q >= 8, p >= y_floor)
}

ct_country_curve_layer = function(parameters, show_msc = FALSE) {
  q_grid = seq(8, 82, by = 0.25)

  layers = list(
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) ct_country_demand(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$demand,
      linewidth = 1.0
    ),
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) ct_country_supply(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$supply,
      linewidth = 1.0
    )
  )

  if (show_msc) {
    layers = c(
      layers,
      list(
        ggplot2::geom_line(
          data = ct_curve_data(q_grid, function(q) ct_country_msc(q, parameters)),
          ggplot2::aes(x = q, y = p),
          color = ct_palette$msc,
          linewidth = 1.0
        )
      )
    )
  }

  layers
}

ct_world_curve_layer = function(parameters, show_msc = FALSE) {
  q_grid = seq(8, 110, by = 0.25)

  layers = list(
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) ct_world_demand(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$demand,
      linewidth = 1.0
    ),
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) ct_world_supply(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$supply,
      linewidth = 1.0
    )
  )

  if (show_msc) {
    layers = c(
      layers,
      list(
        ggplot2::geom_line(
          data = ct_curve_data(q_grid, function(q) ct_world_msc(q, parameters)),
          ggplot2::aes(x = q, y = p),
          color = ct_palette$msc,
          linewidth = 1.0
        )
      )
    )
  }

  layers
}

ct_imports_arrow = function(x_start, x_end, y = 18) {
  list(
    ggplot2::annotate(
      "segment",
      x = x_start,
      xend = x_end,
      y = y,
      yend = y,
      color = ct_palette$guide,
      linewidth = 0.7,
      arrow = grid::arrow(
        type = "closed",
        ends = "both",
        length = grid::unit(0.10, "inches")
      )
    ),
    ggplot2::annotate(
      "text",
      x = mean(c(x_start, x_end)),
      y = y + 4,
      label = "imports",
      color = ct_palette$guide,
      size = 4.4
    )
  )
}

ct_guide_segments = function(x_values, y_values) {
  segments = purrr::map(
    x_values,
    ~ ggplot2::annotate(
      "segment",
      x = .x,
      xend = .x,
      y = 8,
      yend = max(y_values),
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    )
  )

  price_lines = purrr::map(
    y_values,
    ~ ggplot2::annotate(
      "segment",
      x = 8,
      xend = 78,
      y = .x,
      yend = .x,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    )
  )

  c(segments, price_lines)
}

ct_label_quantities = function(labels, x_values, y = 4.5) {
  purrr::pmap(
    list(labels, x_values),
    function(label, x_value) {
      ggplot2::annotate(
        "text",
        x = x_value,
        y = y,
        label = label,
        parse = TRUE,
        size = 4.1
      )
    }
  )
}

ct_label_prices = function(labels, y_values, x = 4.5, hjust = 0) {
  purrr::pmap(
    list(labels, y_values),
    function(label, y_value) {
      ggplot2::annotate(
        "text",
        x = x,
        y = y_value,
        label = label,
        parse = TRUE,
        size = 4.1,
        hjust = hjust
      )
    }
  )
}

ct_plot_figure_1 = function(stage = c("welfare", "free_trade", "tariff")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)
  world = ct_world_outcomes()

  if (stage == "free_trade") {
    quantity_labels = c("q[i]^S", "q[i]^D")
    quantity_values = c(country$q_supply, country$q_demand)
    price_labels = c("P[W]")
    price_values = c(country$world_price)
    imports_start = country$q_supply
    imports_end = country$q_demand
  } else {
    quantity_labels = c("q[i]^S", "q[i*tau]^S", "q[i*tau]^D", "q[i]^D")
    quantity_values = c(
      country$q_supply,
      country$q_supply_tariff,
      country$q_demand_tariff,
      country$q_demand
    )
    price_labels = c("P[W]", "P[W] + tau")
    price_values = c(country$world_price, country$tariff_price)
    imports_start = country$q_supply_tariff
    imports_end = country$q_demand_tariff
  }

  panel_a = ct_base_plot() +
    ct_country_curve_layer(parameters)

  if (stage == "welfare") {
    panel_a = panel_a +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_supply, country$q_supply_tariff, country$q_supply_tariff),
        y = c(country$world_price, country$world_price, country$tariff_price),
        fill = ct_palette$loss,
        alpha = 0.55
      ) +
      ggplot2::annotate(
        "rect",
        xmin = country$q_supply_tariff,
        xmax = country$q_demand_tariff,
        ymin = country$world_price,
        ymax = country$tariff_price,
        fill = ct_palette$tariff,
        alpha = 0.55
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_demand_tariff, country$q_demand, country$q_demand_tariff),
        y = c(country$tariff_price, country$world_price, country$world_price),
        fill = ct_palette$loss,
        alpha = 0.55
      )
  }

  panel_a = panel_a +
    ct_guide_segments(
      x_values = quantity_values,
      y_values = price_values
    ) +
    ct_imports_arrow(imports_start, imports_end) +
    ct_label_prices(
      labels = price_labels,
      y_values = price_values
    ) +
    ct_label_quantities(
      labels = quantity_labels,
      x_values = quantity_values
    ) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 74, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 48, y = 77, label = "Country i", size = 4.6)

  if (stage == "welfare") {
    panel_a = panel_a +
      ggplot2::annotate("text", x = 21, y = 48, label = "Delta*PS[tau]", parse = TRUE, size = 4.2) +
      ggplot2::annotate("text", x = 39, y = 49, label = "a", size = 4.2) +
      ggplot2::annotate("text", x = 47, y = 50, label = "R[tau]", parse = TRUE, size = 4.2) +
      ggplot2::annotate("text", x = 56, y = 49, label = "b", size = 4.2)
  }

  world_parameters = ct_world_parameters()

  panel_b = ct_base_plot(
    x_limit = c(0, 125),
    y_limit = c(0, 86),
    x_label = "Q[W]",
    x_axis_end = 116,
    x_label_x = 117
  ) +
    ct_world_curve_layer(world_parameters) +
    ggplot2::annotate(
      "segment",
      x = world$q_world,
      xend = world$q_world,
      y = 8,
      yend = world$world_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = 8,
      xend = world$q_world,
      y = world$world_price,
      yend = world$world_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate("text", x = 96, y = 58, label = "S[W]", parse = TRUE, color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 93, y = 29, label = "D[W]", parse = TRUE, color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 62, y = 77, label = "World", size = 4.6) +
    ggplot2::annotate("text", x = 6.6, y = world$world_price, label = "P[W]", parse = TRUE, size = 4.1, hjust = 1) +
    ggplot2::annotate("text", x = world$q_world - 2.2, y = 4.5, label = "Q[W]", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 102, y = 11, label = "Q[W] == sum(q[i])", parse = TRUE, size = 3.8, hjust = 0)

  patchwork::wrap_plots(panel_a, panel_b, ncol = 2, widths = c(1.7, 1))
}

ct_plot_figure_2_country = function(stage = c("damage", "msc", "baseline")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)

  quantity_guides = if (stage == "baseline") {
    c(country$q_supply, country$q_demand)
  } else {
    c(country$q_msc, country$q_supply, country$q_demand)
  }

  figure = ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = TRUE)

  if (stage == "damage") {
    figure = figure +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_msc, country$q_supply, country$q_supply),
        y = c(country$world_price, country$world_price, ct_country_msc(country$q_supply, parameters)),
        fill = ct_palette$gain,
        alpha = 0.55
      )
  }

  figure +
    ct_guide_segments(
      x_values = quantity_guides,
      y_values = c(country$world_price)
    ) +
    ct_imports_arrow(country$q_supply, country$q_demand) +
    ct_label_prices(
      labels = c("P[W]"),
      y_values = c(country$world_price)
    ) +
    {
      if (stage != "baseline") {
        ggplot2::annotate("text", x = country$q_msc, y = 4.0, label = "q[i]^\"*\"", parse = TRUE, size = 4.1)
      }
    } +
    ggplot2::annotate("text", x = country$q_supply, y = 4.0, label = "q[i]^S", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = country$q_demand, y = 4.0, label = "q[i]^D", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 68, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 86, label = "MSC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 48, y = 81, label = "Country i", size = 4.6)
}

ct_plot_figure_2_world = function() {
  world_parameters = ct_world_parameters()
  world = ct_world_outcomes(world_parameters)

  ct_base_plot(
    x_limit = c(0, 125),
    y_limit = c(0, 92),
    x_label = "Q[W]",
    x_axis_end = 116,
    x_label_x = 117
  ) +
    ct_world_curve_layer(world_parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "polygon",
      x = c(world$q_world_star, world$q_world, world$q_world),
      y = c(
        world$efficient_price,
        world$world_price,
        ct_world_msc(world$q_world, world_parameters)
      ),
      fill = ct_palette$gain,
      alpha = 0.55
    ) +
    ggplot2::annotate(
      "segment",
      x = world$q_world_star,
      xend = world$q_world_star,
      y = 8,
      yend = world$efficient_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = world$q_world,
      xend = world$q_world,
      y = 8,
      yend = world$world_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = 8,
      xend = world$q_world,
      y = world$world_price,
      yend = world$world_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate("text", x = 96, y = 50, label = "S[W]", parse = TRUE, color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 95, y = 72, label = "MSC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 93, y = 29, label = "D[W]", parse = TRUE, color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 62, y = 82, label = "World", size = 4.6) +
    ggplot2::annotate("text", x = 6.6, y = world$world_price, label = "P[W]", parse = TRUE, size = 4.1, hjust = 1) +
    ggplot2::annotate("text", x = world$q_world_star - 2.0, y = 3.2, label = "Q[W]^\"*\"", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = world$q_world + 1.2, y = 6.2, label = "Q[W]", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 102, y = 11, label = "Q[W] == sum(q[i])", parse = TRUE, size = 3.8, hjust = 0)
}

ct_plot_figure_3 = function(stage = c("welfare", "tax", "baseline")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)

  figure = ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = stage != "baseline")

  if (stage == "welfare") {
    figure = figure +
      ggplot2::annotate(
        "rect",
        xmin = 8,
        xmax = country$q_supply_tax,
        ymin = country$producer_price_with_tax,
        ymax = country$world_price,
        fill = ct_palette$tax,
        alpha = 0.35
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_supply_tax, country$q_supply, country$q_supply_tax),
        y = c(country$world_price, country$world_price, ct_country_supply(country$q_supply_tax, parameters)),
        fill = ct_palette$loss,
        alpha = 0.55
      )
  }

  figure +
    ct_guide_segments(
      x_values = if (stage == "baseline") {
        c(country$q_supply, country$q_demand)
      } else {
        c(country$q_supply_tax, country$q_supply, country$q_demand)
      },
      y_values = if (stage == "baseline") {
        c(country$world_price)
      } else {
        c(country$producer_price_with_tax, country$world_price)
      }
    ) +
    ct_imports_arrow(
      if (stage == "baseline") country$q_supply else country$q_supply_tax,
      country$q_demand
    ) +
    {
      if (stage == "baseline") {
        ct_label_prices(
          labels = c("P[W]"),
          y_values = c(country$world_price)
        )
      } else {
        list(
          ggplot2::annotate("text", x = 6.6, y = country$producer_price_with_tax, label = "P[W] - t", parse = TRUE, size = 4.1, hjust = 1),
          ggplot2::annotate("text", x = 6.6, y = country$world_price, label = "P[W]", parse = TRUE, size = 4.1, hjust = 1)
        )
      }
    } +
    {
      if (stage == "baseline") {
        ct_label_quantities(
          labels = c("q[i]^S", "q[i]^D"),
          x_values = c(country$q_supply, country$q_demand)
        )
      } else {
        ct_label_quantities(
          labels = c("q[i*t]^S", "q[i]^S", "q[i]^D"),
          x_values = c(country$q_supply_tax, country$q_supply, country$q_demand)
        )
      }
    } +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    {
      if (stage != "baseline") {
        ggplot2::annotate("text", x = 72, y = 86, label = "MSC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3)
      }
    } +
    {
      if (stage == "welfare") {
        ggplot2::annotate("text", x = 18, y = 40, label = "R[t]", parse = TRUE, size = 4.3)
      }
    } +
    {
      if (stage == "welfare") {
        ggplot2::annotate(
          "text",
          x = mean(c(country$q_supply_tax, country$q_supply, country$q_supply_tax)),
          y = mean(c(
            country$world_price,
            country$world_price,
            ct_country_supply(country$q_supply_tax, parameters)
          )),
          label = "d",
          size = 4.3
        )
      }
    } +
    ggplot2::annotate("text", x = 47, y = 81, label = "Country i", size = 4.6)
}

ct_plot_figure_4 = function(stage = c("welfare", "revenue", "tariff", "tax_only")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)

  figure = ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = TRUE)

  if (stage %in% c("revenue", "welfare")) {
    figure = figure +
      ggplot2::annotate(
        "rect",
        xmin = 8,
        xmax = country$q_supply,
        ymin = country$world_price,
        ymax = country$tariff_price,
        fill = ct_palette$tax,
        alpha = 0.30
      ) +
      ggplot2::annotate(
        "rect",
        xmin = country$q_supply,
        xmax = country$q_demand_tariff,
        ymin = country$world_price,
        ymax = country$tariff_price,
        fill = ct_palette$tariff,
        alpha = 0.45
      )
  }

  if (stage == "welfare") {
    figure = figure +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_demand_tariff, country$q_demand, country$q_demand_tariff),
        y = c(country$tariff_price, country$world_price, country$world_price),
        fill = ct_palette$loss,
        alpha = 0.55
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_demand_tariff, country$q_demand, country$q_demand),
        y = c(country$tariff_price, country$tariff_price, country$world_price),
        fill = ct_palette$gain,
        alpha = 0.45
      )
  }

  figure +
    ct_guide_segments(
      x_values = c(country$q_supply_tax, country$q_supply, country$q_demand_tariff, country$q_demand),
      y_values = c(country$producer_price_with_tax, country$world_price, country$tariff_price)
    ) +
    ct_imports_arrow(
      if (stage == "tax_only") country$q_supply_tax else country$q_supply,
      if (stage == "tax_only") country$q_demand else country$q_demand_tariff
    ) +
    ct_label_prices(
      labels = c("P[W] - t", "P[W] == P[W] - t + tau", "P[W] + tau"),
      y_values = c(country$producer_price_with_tax, country$world_price, country$tariff_price),
      x = 7.2,
      hjust = 1
    ) +
    ct_label_quantities(
      labels = c("q[i*t]^S", "q[i]^S", "q[i*tau]^D", "q[i]^D"),
      x_values = c(country$q_supply_tax, country$q_supply, country$q_demand_tariff, country$q_demand)
    ) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 86, label = "MSC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    {
      if (stage %in% c("revenue", "welfare")) {
        list(
          ggplot2::annotate("text", x = (8 + country$q_supply) / 2, y = (country$world_price + country$tariff_price) / 2, label = "R[t]", parse = TRUE, size = 4.3),
          ggplot2::annotate("text", x = (country$q_supply + country$q_demand_tariff) / 2, y = (country$world_price + country$tariff_price) / 2, label = "R[tau]", parse = TRUE, size = 4.3)
        )
      }
    } +
    {
      if (stage == "welfare") {
        list(
          ggplot2::annotate("text", x = 56, y = 48, label = "b", size = 4.3),
          ggplot2::annotate("text", x = country$q_demand - 3.2, y = country$tariff_price - 2.1, label = "f", size = 4.3)
        )
      }
    } +
    ggplot2::annotate("text", x = 47, y = 77, label = "Country i", size = 4.6) +
    ggplot2::theme(plot.margin = ggplot2::margin(10, 18, 14, 58))
}

ct_plot_figure_5 = function(stage = c("welfare", "revenue", "tariff", "baseline")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)

  figure = ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = TRUE)

  if (stage %in% c("revenue", "welfare")) {
    figure = figure +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_supply, country$q_supply_tariff, country$q_supply_tariff),
        y = c(country$world_price, country$world_price, country$tariff_price),
        fill = ct_palette$loss,
        alpha = 0.55
      ) +
      ggplot2::annotate(
        "rect",
        xmin = country$q_supply_tariff,
        xmax = country$q_demand_tariff,
        ymin = country$world_price,
        ymax = country$tariff_price,
        fill = ct_palette$tariff,
        alpha = 0.45
      )
  }

  if (stage == "welfare") {
    figure = figure +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_demand_tariff, country$q_demand, country$q_demand_tariff),
        y = c(country$tariff_price, country$world_price, country$world_price),
        fill = ct_palette$loss,
        alpha = 0.55
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_demand_tariff, country$q_demand, country$q_demand),
        y = c(country$tariff_price, country$tariff_price, country$world_price),
        fill = ct_palette$gain,
        alpha = 0.45
      )
  }

  figure +
    ct_guide_segments(
      x_values = c(country$q_supply, country$q_supply_tariff, country$q_demand_tariff, country$q_demand),
      y_values = c(country$world_price, country$tariff_price)
    ) +
    ct_imports_arrow(
      if (stage == "baseline") country$q_supply else country$q_supply_tariff,
      if (stage == "baseline") country$q_demand else country$q_demand_tariff
    ) +
    ct_label_prices(
      labels = c("P[W]", "P[W] + tau"),
      y_values = c(country$world_price, country$tariff_price),
      x = 7.2,
      hjust = 1
    ) +
    ct_label_quantities(
      labels = c("q[i]^S", "q[i*tau]^S", "q[i*tau]^D", "q[i]^D"),
      x_values = c(country$q_supply, country$q_supply_tariff, country$q_demand_tariff, country$q_demand)
    ) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 73, y = 75, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 72.5, y = 90, label = "MSC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    {
      if (stage %in% c("revenue", "welfare")) {
        list(
          ggplot2::annotate("text", x = 39, y = 49, label = "a", size = 4.2),
          ggplot2::annotate("text", x = (country$q_supply_tariff + country$q_demand_tariff) / 2, y = (country$world_price + country$tariff_price) / 2, label = "R[tau]", parse = TRUE, size = 4.2)
        )
      }
    } +
    {
      if (stage == "welfare") {
        list(
          ggplot2::annotate("text", x = 55, y = 49, label = "b", size = 4.2),
          ggplot2::annotate(
            "text",
            x = country$q_demand - 1.8,
            y = country$world_price + 0.72 * (country$tariff_price - country$world_price),
            label = "f",
            size = 4.3
          )
        )
      }
    } +
    ggplot2::annotate("text", x = 47, y = 77, label = "Country i", size = 4.6) +
    ggplot2::theme(plot.margin = ggplot2::margin(10, 18, 14, 42))
}

ct_plot_figure_6 = function() {
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)

  ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "polygon",
      x = c(country$q_supply_tax, country$q_supply, country$q_supply),
      y = c(country$world_price, country$world_price, country$tariff_price),
      fill = ct_palette$loss,
      alpha = 0.55
    ) +
    ggplot2::annotate(
      "rect",
      xmin = country$q_supply,
      xmax = country$q_demand_tariff,
      ymin = country$world_price,
      ymax = country$tariff_price,
      fill = ct_palette$tariff,
      alpha = 0.45
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(country$q_demand_tariff, country$q_demand, country$q_demand_tariff),
      y = c(country$tariff_price, country$world_price, country$world_price),
      fill = ct_palette$loss,
      alpha = 0.55
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(country$q_demand_tariff, country$q_demand, country$q_demand),
      y = c(country$tariff_price, country$tariff_price, country$world_price),
      fill = ct_palette$gain,
      alpha = 0.45
    ) +
    ct_guide_segments(
      x_values = c(country$q_supply_tax, country$q_supply, country$q_demand_tariff, country$q_demand),
      y_values = c(country$producer_price_with_tax, country$world_price, country$tariff_price)
    ) +
    ct_label_prices(
      labels = c("P[W] - t", "P[W]", "P[W] + t"),
      y_values = c(country$producer_price_with_tax, country$world_price, country$tariff_price),
      x = 7.2,
      hjust = 1
    ) +
    ct_label_quantities(
      labels = c("q[i*t]^S", "q[i]^S", "q[i]^D"),
      x_values = c(country$q_supply_tax, country$q_supply, country$q_demand)
    ) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 74, y = 75, label = "S", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 74, y = 88, label = "MSC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 29.5, y = 48.2, label = "a", size = 4.2) +
    ggplot2::annotate("text", x = 46, y = 50, label = "R[tau]", parse = TRUE, size = 4.2) +
    ggplot2::annotate("text", x = 55, y = 49, label = "b", size = 4.2) +
    ggplot2::annotate(
      "text",
      x = country$q_demand - 1.8,
      y = country$world_price + 0.72 * (country$tariff_price - country$world_price),
      label = "f",
      size = 4.3
    ) +
    ggplot2::annotate("text", x = 47, y = 77, label = "Country i", size = 4.6) +
    ggplot2::annotate(
      "segment",
      x = country$q_supply,
      xend = country$q_demand_tariff,
      y = 42.5,
      yend = 42.5,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = country$q_supply,
      xend = country$q_supply,
      y = 42.5,
      yend = 44.5,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = country$q_demand_tariff,
      xend = country$q_demand_tariff,
      y = 42.5,
      yend = 44.5,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "text",
      x = mean(c(country$q_supply, country$q_demand_tariff)),
      y = 38.8,
      label = "Imports with\nt and tau",
      size = 3.1,
      lineheight = 0.9
    ) +
    ggplot2::annotate(
      "segment",
      x = country$q_supply,
      xend = country$q_demand,
      y = 24.5,
      yend = 24.5,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = country$q_supply,
      xend = country$q_supply,
      y = 24.5,
      yend = 26.5,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = country$q_demand,
      xend = country$q_demand,
      y = 24.5,
      yend = 26.5,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "text",
      x = mean(c(country$q_supply, country$q_demand)),
      y = 19.3,
      label = "Imports if no\ncarbon tax t",
      size = 3.1,
      lineheight = 0.9
    ) +
    ggplot2::annotate(
      "segment",
      x = country$q_supply_tax,
      xend = country$q_demand,
      y = 11.2,
      yend = 11.2,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = country$q_supply_tax,
      xend = country$q_supply_tax,
      y = 11.2,
      yend = 13.2,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = country$q_demand,
      xend = country$q_demand,
      y = 11.2,
      yend = 13.2,
      linewidth = 0.9,
      color = ct_palette$guide
    ) +
    ggplot2::annotate("text", x = mean(c(country$q_supply_tax, country$q_demand)), y = 14.6, label = "efficient imports", size = 3.1)
}

ct_plot_figure_7 = function() {
  parameters = ct_country_parameters()
  small_tax = ct_small_world_tax_outcomes()
  world_parameters = ct_world_parameters()

  shifted_world_supply = function(q) ct_world_supply(q, world_parameters) + small_tax$small_tax

  panel_country = ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "rect",
      xmin = 8,
      xmax = small_tax$q_supply_small_tax,
      ymin = small_tax$producer_price_small_tax,
      ymax = small_tax$world_price_small_tax,
      fill = ct_palette$tax,
      alpha = 0.35
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(small_tax$q_supply_small_tax, small_tax$q_supply_no_policy, small_tax$q_supply_small_tax),
      y = c(small_tax$world_price_small_tax, small_tax$world_price_small_tax, small_tax$producer_price_small_tax),
      fill = ct_palette$loss,
      alpha = 0.55
    ) +
    ct_guide_segments(
      x_values = c(small_tax$q_supply_small_tax, small_tax$q_supply_no_policy, small_tax$q_demand_small_tax),
      y_values = c(small_tax$no_policy_world_price, small_tax$world_price_small_tax)
    ) +
    ct_imports_arrow(small_tax$q_supply_small_tax, small_tax$q_demand_small_tax) +
    ct_label_prices(
      labels = c("P[W]", "P[W]^\"'\""),
      y_values = c(small_tax$no_policy_world_price, small_tax$world_price_small_tax)
    ) +
    ct_label_quantities(
      labels = c("q[i*t^\"'\"]^S", "q[i]^S", "q[i]^D"),
      x_values = c(small_tax$q_supply_small_tax, small_tax$q_supply_no_policy, small_tax$q_demand_small_tax)
    ) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 80, label = "MSC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 19, y = 48, label = "R[t^\"'\"]", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 31, y = 50, label = "d", size = 4.2) +
    ggplot2::annotate("text", x = 47, y = 77, label = "Country i", size = 4.6)

  q_grid = seq(8, 110, by = 0.25)
  q_world_small = small_tax$q_world_small_tax
  q_world_no_policy = small_tax$q_world_no_policy
  world_price_small = small_tax$world_price_small

  panel_world = ct_base_plot(x_limit = c(0, 110), y_limit = c(0, 92), x_label = "Q[W]") +
    ct_world_curve_layer(world_parameters, show_msc = TRUE) +
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, shifted_world_supply),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$accent,
      linewidth = 0.9,
      linetype = "dashed"
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(q_world_small, q_world_no_policy, q_world_small),
      y = c(
        world_price_small,
        small_tax$world_price_no_policy,
        ct_world_msc(q_world_small, world_parameters)
      ),
      fill = ct_palette$tariff,
      alpha = 0.55
    ) +
    ggplot2::annotate(
      "segment",
      x = q_world_small,
      xend = q_world_small,
      y = 8,
      yend = world_price_small,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate("text", x = 92, y = 57, label = "S[W]", parse = TRUE, color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 92, y = 68, label = "MSC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 80, y = 62, label = "S[W] + t^\"'\"", parse = TRUE, color = ct_palette$accent, size = 4.0) +
    ggplot2::annotate("text", x = 90, y = 29, label = "D[W]", parse = TRUE, color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 55, y = 82, label = "World", size = 4.6) +
    ggplot2::annotate("text", x = q_world_small + 2, y = 3.5, label = "Q[W]^\"'\" == Sigma*q[i]", parse = TRUE, size = 3.8, hjust = 0)

  patchwork::wrap_plots(panel_country, panel_world, ncol = 2, widths = c(1.25, 1))
}

ct_plot_figure_8 = function() {
  parameters = ct_country_parameters()
  small_tax = ct_small_world_tax_outcomes()

  tariff_gap = parameters$carbon_tax - small_tax$small_tax
  top_price = small_tax$world_price_small_tax + tariff_gap
  q_supply_tariff = ct_inverse_supply(
    top_price - small_tax$small_tax,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_demand_tariff = ct_inverse_demand(
    top_price,
    parameters$demand_intercept,
    parameters$demand_slope
  )

  ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "rect",
      xmin = 8,
      xmax = small_tax$q_supply_small_tax,
      ymin = small_tax$no_policy_world_price,
      ymax = small_tax$world_price_small_tax,
      fill = ct_palette$tax,
      alpha = 0.30
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(small_tax$q_supply_small_tax, small_tax$q_supply_no_policy, small_tax$q_supply_small_tax),
      y = c(small_tax$world_price_small_tax, small_tax$world_price_small_tax, small_tax$no_policy_world_price),
      fill = ct_palette$loss,
      alpha = 0.55
    ) +
    ggplot2::annotate(
      "rect",
      xmin = small_tax$q_supply_no_policy,
      xmax = q_demand_tariff,
      ymin = small_tax$world_price_small_tax,
      ymax = top_price,
      fill = ct_palette$tariff,
      alpha = 0.40
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(q_demand_tariff, small_tax$q_demand_small_tax, q_demand_tariff),
      y = c(top_price, small_tax$world_price_small_tax, small_tax$world_price_small_tax),
      fill = ct_palette$loss,
      alpha = 0.55
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(q_demand_tariff, small_tax$q_demand_small_tax, small_tax$q_demand_small_tax),
      y = c(top_price, top_price, ct_country_msc(small_tax$q_demand_small_tax, parameters)),
      fill = ct_palette$gain,
      alpha = 0.45
    ) +
    ct_guide_segments(
      x_values = c(small_tax$q_supply_small_tax, small_tax$q_supply_no_policy, q_demand_tariff, small_tax$q_demand_small_tax),
      y_values = c(small_tax$no_policy_world_price, small_tax$world_price_small_tax, top_price)
    ) +
    ct_imports_arrow(small_tax$q_supply_no_policy, q_demand_tariff) +
    ct_label_prices(
      labels = c("P[W]", "P[W]^\"'\"", "P[W]^\"'\" + tau"),
      y_values = c(small_tax$no_policy_world_price, small_tax$world_price_small_tax, top_price)
    ) +
    ggplot2::annotate("text", x = small_tax$q_supply_small_tax, y = 4.2, label = "q_i,t'^S", size = 3.8) +
    ggplot2::annotate("text", x = small_tax$q_supply_no_policy, y = 4.2, label = "q_i^S*", size = 3.8) +
    ggplot2::annotate("text", x = q_demand_tariff, y = 4.2, label = "q_i,tau,t'^D", size = 3.6) +
    ggplot2::annotate("text", x = small_tax$q_demand_small_tax, y = 4.2, label = "q_i,t'^D", size = 3.8) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 80, label = "MSC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 23, y = 50, label = "Delta*PS", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 38, y = 52, label = "a", size = 4.2) +
    ggplot2::annotate("text", x = 47, y = 54, label = "R[tau]", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 58, y = 53, label = "b", size = 4.2) +
    ggplot2::annotate("text", x = small_tax$q_demand_small_tax - 2.4, y = top_price + 3.5, label = "f", size = 4.2) +
    ggplot2::annotate("text", x = 47, y = 77, label = "Country i", size = 4.6)
}

ct_plot_figure_9 = function() {
  parameters = ct_country_parameters()
  intensity = ct_intensity_outcomes()
  world = ct_world_outcomes()

  q_world_domestic = world$q_world - 6
  domestic_world_price = world$world_price + intensity$domestic_tax

  panel_country = ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "rect",
      xmin = 8,
      xmax = intensity$q_supply_tax_domestic,
      ymin = intensity$world_price,
      ymax = intensity$consumer_price_domestic,
      fill = ct_palette$tax,
      alpha = 0.35
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(intensity$q_supply_tax_domestic, intensity$q_supply, intensity$q_supply_tax_domestic),
      y = c(intensity$consumer_price_domestic, intensity$consumer_price_domestic, intensity$world_price),
      fill = ct_palette$loss,
      alpha = 0.55
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(intensity$q_demand_domestic_tariff, intensity$q_demand_domestic_tariff, intensity$q_demand_foreign_tariff),
      y = c(intensity$consumer_price_domestic, intensity$consumer_price_foreign, intensity$consumer_price_domestic),
      fill = ct_palette$gain,
      alpha = 0.45
    ) +
    ct_guide_segments(
      x_values = c(intensity$q_supply_tax_domestic, intensity$q_supply, intensity$q_demand_domestic_tariff, intensity$q_demand_foreign_tariff),
      y_values = c(intensity$world_price, intensity$consumer_price_domestic, intensity$consumer_price_foreign)
    ) +
    ct_label_prices(
      labels = c("P[W]", "P[W] + t[i]", "P[W] + t[w]"),
      y_values = c(intensity$world_price, intensity$consumer_price_domestic, intensity$consumer_price_foreign)
    ) +
    ct_label_quantities(
      labels = c("q[i*t]^S", "q[i]^S", "q[i*t]^D", "q[i]^D"),
      x_values = c(intensity$q_supply_tax_domestic, intensity$q_supply, intensity$q_demand_domestic_tariff, intensity$q_demand_foreign_tariff)
    ) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 86, label = "MSC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 21, y = 49, label = "R[t]", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 38, y = 52, label = "a", size = 4.2) +
    ggplot2::annotate("text", x = intensity$q_demand_domestic_tariff + 6, y = intensity$consumer_price_domestic - 2, label = "Country i\nexternal\ncost", color = ct_palette$accent, size = 2.8, lineheight = 0.9) +
    ggplot2::annotate("text", x = intensity$q_demand_domestic_tariff + 12, y = intensity$consumer_price_foreign + 1.5, label = "World\nexternal\ncost", color = ct_palette$foreign, size = 2.8, lineheight = 0.9) +
    ggplot2::annotate("text", x = 48, y = 77, label = "Country i", size = 4.6)

  panel_world = ct_base_plot(x_limit = c(0, 110), y_limit = c(0, 92), x_label = "Q[W]") +
    ct_world_curve_layer(ct_world_parameters(), show_msc = TRUE) +
    ggplot2::annotate(
      "polygon",
      x = c(q_world_domestic, world$q_world, q_world_domestic),
      y = c(
        domestic_world_price,
        domestic_world_price,
        ct_world_msc(q_world_domestic, ct_world_parameters())
      ),
      fill = ct_palette$gain,
      alpha = 0.45
    ) +
    ggplot2::annotate(
      "segment",
      x = 8,
      xend = q_world_domestic,
      y = domestic_world_price,
      yend = domestic_world_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate("text", x = 92, y = 57, label = "S[W]", parse = TRUE, color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 92, y = 68, label = "MSC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 90, y = 29, label = "D[W]", parse = TRUE, color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 55, y = 82, label = "World", size = 4.6) +
    ggplot2::annotate("text", x = 4.5, y = domestic_world_price, label = "P''", size = 4.1, hjust = 0) +
    ggplot2::annotate("text", x = q_world_domestic + 2, y = 3.5, label = "Q[W] == Sigma*q[i]", parse = TRUE, size = 3.8, hjust = 0) +
    ggplot2::annotate("text", x = world$q_world + 2, y = 5.5, label = "Q[W]", parse = TRUE, size = 3.9)

  patchwork::wrap_plots(panel_country, panel_world, ncol = 2, widths = c(1.15, 1))
}

ct_plot_figure_10 = function() {
  parameters = ct_country_parameters()
  intensity = ct_intensity_outcomes()

  ct_base_plot() +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "polygon",
      x = c(intensity$q_supply_tax_domestic, intensity$q_supply, intensity$q_supply_tax_domestic),
      y = c(intensity$producer_price_foreign, intensity$producer_price_foreign, intensity$world_price),
      fill = ct_palette$tariff,
      alpha = 0.50
    ) +
    ggplot2::annotate(
      "rect",
      xmin = intensity$q_supply_tax_domestic,
      xmax = intensity$q_supply_foreign_tariff,
      ymin = intensity$producer_price_foreign,
      ymax = intensity$consumer_price_foreign,
      fill = ct_palette$accent,
      alpha = 0.30
    ) +
    ggplot2::annotate(
      "rect",
      xmin = intensity$q_supply_foreign_tariff,
      xmax = intensity$q_demand_foreign_tariff,
      ymin = intensity$world_price,
      ymax = intensity$producer_price_foreign,
      fill = ct_palette$loss,
      alpha = 0.45
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(intensity$q_demand_foreign_tariff, intensity$q_demand_domestic_tariff, intensity$q_demand_domestic_tariff),
      y = c(intensity$producer_price_foreign, intensity$producer_price_foreign, ct_country_msc(intensity$q_demand_domestic_tariff, parameters)),
      fill = ct_palette$gain,
      alpha = 0.45
    ) +
    ct_guide_segments(
      x_values = c(intensity$q_supply_tax_domestic, intensity$q_supply_foreign_tariff, intensity$q_demand_foreign_tariff, intensity$q_demand_domestic_tariff),
      y_values = c(intensity$world_price, intensity$producer_price_foreign, intensity$consumer_price_foreign)
    ) +
    ct_label_prices(
      labels = c("P[W]", "P[W] + t[w] - t[i]", "P[W] + t[w]"),
      y_values = c(intensity$world_price, intensity$producer_price_foreign, intensity$consumer_price_foreign)
    ) +
    ct_label_quantities(
      labels = c("q[i*t]^S", "q[i*tau[w]]^S", "q[i*tau[w]]^D", "q[i]^D"),
      x_values = c(intensity$q_supply_tax_domestic, intensity$q_supply_foreign_tariff, intensity$q_demand_foreign_tariff, intensity$q_demand_domestic_tariff)
    ) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 86, label = "MSC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 36, y = intensity$producer_price_foreign - 2, label = "a", size = 4.2) +
    ggplot2::annotate("text", x = 53, y = mean(c(intensity$world_price, intensity$producer_price_foreign)), label = "b", size = 4.2) +
    ggplot2::annotate("text", x = intensity$q_demand_domestic_tariff - 2.2, y = intensity$producer_price_foreign + 3.5, label = "f", size = 4.2) +
    ggplot2::annotate("text", x = intensity$q_demand_foreign_tariff + 6, y = intensity$producer_price_foreign - 1.5, label = "Country i\nexternal\ncost", color = ct_palette$accent, size = 2.8, lineheight = 0.9) +
    ggplot2::annotate("text", x = intensity$q_demand_foreign_tariff + 13, y = intensity$consumer_price_foreign + 1.5, label = "World\nexternal\ncost", color = ct_palette$foreign, size = 2.8, lineheight = 0.9) +
    ggplot2::annotate("text", x = 47, y = 77, label = "Country i", size = 4.6)
}

# Test the geometry rather than the pixels. These checks ensure the diagrams
# preserve the comparative-statics logic emphasized in the lecture.
test_ct_module_one_figures = function() {
  country = ct_country_outcomes()
  world = ct_world_outcomes()

  stopifnot(country$q_supply_tax < country$q_supply)
  stopifnot(country$q_supply < country$q_supply_tariff)
  stopifnot(country$q_supply < country$q_demand)
  stopifnot(country$q_supply_tariff < country$q_demand_tariff)
  stopifnot(country$q_demand_tariff < country$q_demand)
  stopifnot(country$producer_price_with_tax < country$world_price)
  stopifnot(country$world_price < country$tariff_price)
  stopifnot(country$imports_free_trade > 0)
  stopifnot(country$imports_with_tariff < country$imports_free_trade)
  stopifnot(country$imports_with_tax > country$imports_free_trade)
  stopifnot(country$imports_with_tax_tariff < country$imports_with_tax)
  stopifnot(world$q_world_star < world$q_world)
  stopifnot(world$world_price < world$efficient_price)
  stopifnot(inherits(ct_plot_figure_1("free_trade"), "patchwork"))
  stopifnot(inherits(ct_plot_figure_1("tariff"), "patchwork"))
  stopifnot(inherits(ct_plot_figure_1("welfare"), "patchwork"))
  stopifnot(inherits(ct_plot_figure_2_country("baseline"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_2_country("msc"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_2_country("damage"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_2_country(), "ggplot"))
  stopifnot(inherits(ct_plot_figure_2_world(), "ggplot"))
  stopifnot(inherits(ct_plot_figure_3("baseline"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_3("tax"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_3("welfare"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_4("tax_only"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_4("tariff"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_4("revenue"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_4("welfare"), "ggplot"))

  invisible(TRUE)
}

test_ct_module_two_figures = function() {
  country = ct_country_outcomes()
  small_tax = ct_small_world_tax_outcomes()

  stopifnot(country$q_supply < country$q_supply_tariff)
  stopifnot(country$q_demand_tariff < country$q_demand)
  stopifnot(small_tax$q_supply_small_tax < small_tax$q_supply_no_policy)
  stopifnot(small_tax$no_policy_world_price < small_tax$world_price_small_tax)
  stopifnot(small_tax$q_world_small_tax < small_tax$q_world_no_policy)
  stopifnot(inherits(ct_plot_figure_5("baseline"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_5("tariff"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_5("revenue"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_5("welfare"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_6(), "ggplot"))

  invisible(TRUE)
}

test_ct_module_three_figures = function() {
  small_tax = ct_small_world_tax_outcomes()
  intensity = ct_intensity_outcomes()

  stopifnot(small_tax$no_policy_world_price < small_tax$world_price_small_tax)
  stopifnot(intensity$q_supply_tax_domestic < intensity$q_supply)
  stopifnot(intensity$q_supply < intensity$q_supply_foreign_tariff)
  stopifnot(intensity$q_demand_foreign_tariff < intensity$q_demand_domestic_tariff)
  stopifnot(inherits(ct_plot_figure_8(), "ggplot"))
  stopifnot(inherits(ct_plot_figure_10(), "ggplot"))

  invisible(TRUE)
}
