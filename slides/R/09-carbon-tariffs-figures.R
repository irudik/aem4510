# Schematic carbon tariff figures for Lecture 09.
# These plots preserve the economic geometry from the paper using simple linear
# demand, supply, and marginal-social-cost schedules that are easy to test.

ct_palette = list(
  demand = "#638ccc",
  supply = "#ca5670",
  msc = "#000000",
  tax = "#638ccc",
  tariff = "#f2b233",
  loss = "#c9c9c9",
  gain = "#7fbf7b",
  revenue = "#f2b233",
  producer_gain = "#5aa469",
  production_dwl = "#d95f02",
  consumption_dwl = "#6a51a3",
  surplus_rect = "#8ecae6",
  surplus_triangle = "#fb8500",
  guide = "grey50",
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
  producer_price_with_tax_tariff = tariff_inclusive_price - parameters$carbon_tax

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
    producer_price_with_tax_tariff = producer_price_with_tax_tariff,
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

# Shared round-number example used for the lecture's equivalence results.
ct_numeric_example_parameters = function() {
  list(
    demand_intercept = 100,
    demand_slope = 1,
    supply_intercept = 20,
    supply_slope = 1,
    world_price = 40,
    carbon_tax = 10,
    tariff = 10,
    consumption_tax = 10,
    production_subsidy = 10
  )
}

ct_numeric_example_outcomes = function(parameters = ct_numeric_example_parameters()) {
  free_trade = tibble::tibble(
    regime = "free_trade",
    consumer_price = parameters$world_price,
    producer_price = parameters$world_price,
    domestic_production = parameters$world_price - parameters$supply_intercept,
    domestic_consumption = parameters$demand_intercept - parameters$world_price,
    imports = (parameters$demand_intercept - parameters$world_price) -
      (parameters$world_price - parameters$supply_intercept),
    tariff_revenue = 0,
    carbon_tax_revenue = 0,
    consumption_tax_revenue = 0,
    production_subsidy_cost = 0
  )

  tariff_alone_price = parameters$world_price + parameters$tariff
  tariff_alone = tibble::tibble(
    regime = "tariff_alone",
    consumer_price = tariff_alone_price,
    producer_price = tariff_alone_price,
    domestic_production = tariff_alone_price - parameters$supply_intercept,
    domestic_consumption = parameters$demand_intercept - tariff_alone_price,
    imports = (parameters$demand_intercept - tariff_alone_price) -
      (tariff_alone_price - parameters$supply_intercept),
    tariff_revenue = parameters$tariff * (
      (parameters$demand_intercept - tariff_alone_price) -
        (tariff_alone_price - parameters$supply_intercept)
    ),
    carbon_tax_revenue = 0,
    consumption_tax_revenue = 0,
    production_subsidy_cost = 0
  )

  tax_tariff_consumer_price = parameters$world_price + parameters$tariff
  tax_tariff_producer_price = tax_tariff_consumer_price - parameters$carbon_tax
  tax_tariff = tibble::tibble(
    regime = "tax_tariff",
    consumer_price = tax_tariff_consumer_price,
    producer_price = tax_tariff_producer_price,
    domestic_production = tax_tariff_producer_price - parameters$supply_intercept,
    domestic_consumption = parameters$demand_intercept - tax_tariff_consumer_price,
    imports = (parameters$demand_intercept - tax_tariff_consumer_price) -
      (tax_tariff_producer_price - parameters$supply_intercept),
    tariff_revenue = parameters$tariff * (
      (parameters$demand_intercept - tax_tariff_consumer_price) -
        (tax_tariff_producer_price - parameters$supply_intercept)
    ),
    carbon_tax_revenue = parameters$carbon_tax * (
      tax_tariff_producer_price - parameters$supply_intercept
    ),
    consumption_tax_revenue = 0,
    production_subsidy_cost = 0
  )

  consumption_tax_price = parameters$world_price + parameters$consumption_tax
  consumption_tax = tibble::tibble(
    regime = "consumption_tax",
    consumer_price = consumption_tax_price,
    producer_price = parameters$world_price,
    domestic_production = parameters$world_price - parameters$supply_intercept,
    domestic_consumption = parameters$demand_intercept - consumption_tax_price,
    imports = (parameters$demand_intercept - consumption_tax_price) -
      (parameters$world_price - parameters$supply_intercept),
    tariff_revenue = 0,
    carbon_tax_revenue = 0,
    consumption_tax_revenue = parameters$consumption_tax * (
      parameters$demand_intercept - consumption_tax_price
    ),
    production_subsidy_cost = 0
  )

  consumption_tax_subsidy_price = parameters$world_price + parameters$consumption_tax
  production_subsidy_net_price = parameters$world_price + parameters$production_subsidy
  consumption_tax_prod_subsidy = tibble::tibble(
    regime = "consumption_tax_prod_subsidy",
    consumer_price = consumption_tax_subsidy_price,
    producer_price = production_subsidy_net_price,
    domestic_production = production_subsidy_net_price - parameters$supply_intercept,
    domestic_consumption = parameters$demand_intercept - consumption_tax_subsidy_price,
    imports = (parameters$demand_intercept - consumption_tax_subsidy_price) -
      (production_subsidy_net_price - parameters$supply_intercept),
    tariff_revenue = 0,
    carbon_tax_revenue = 0,
    consumption_tax_revenue = parameters$consumption_tax * (
      parameters$demand_intercept - consumption_tax_subsidy_price
    ),
    production_subsidy_cost = parameters$production_subsidy * (
      production_subsidy_net_price - parameters$supply_intercept
    )
  )

  dplyr::bind_rows(
    free_trade,
    tariff_alone,
    tax_tariff,
    consumption_tax,
    consumption_tax_prod_subsidy
  ) |>
    dplyr::mutate(
      net_revenue = .data$tariff_revenue +
        .data$carbon_tax_revenue +
        .data$consumption_tax_revenue -
        .data$production_subsidy_cost
    )
}

ct_plot_theme = function() {
  ggplot2::theme_minimal() +
    ggplot2::theme(
      legend.position = "none",
      plot.margin = ggplot2::margin(10, 18, 14, 24),
      plot.title = ggplot2::element_text(size = 24, face = "bold", hjust = 0),
      plot.subtitle = ggplot2::element_text(size = 15, hjust = 0.5),
      axis.text.x = ggplot2::element_text(size = 18, color = "black"),
      axis.text.y = ggplot2::element_text(size = 18, color = "black"),
      axis.title.x = ggplot2::element_text(size = 24, color = "black", margin = ggplot2::margin(t = 10)),
      axis.title.y = ggplot2::element_text(size = 24, color = "black", margin = ggplot2::margin(r = 10)),
      axis.line = ggplot2::element_line(color = "black"),
      axis.ticks = ggplot2::element_blank(),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major = ggplot2::element_blank(),
      panel.background = ggplot2::element_rect(fill = "#ffffff", colour = NA),
      plot.background = ggplot2::element_rect(fill = "#ffffff", colour = NA)
    )
}

ct_base_plot = function(
  x_limit = c(0, 82),
  y_limit = c(0, 100),
  x_label = "Domestic quantity",
  y_label = "Price",
  subtitle = NULL,
  x_breaks = NULL,
  x_labels = NULL,
  y_breaks = NULL,
  y_labels = NULL,
  x_axis_end = NULL,
  x_label_x = NULL
) {
  if (is.null(x_breaks)) {
    x_breaks = pretty(x_limit, n = 5)
  }
  if (is.null(y_breaks)) {
    y_breaks = pretty(y_limit, n = 5)
  }

  ggplot2::ggplot() +
    ggplot2::coord_cartesian(xlim = x_limit, ylim = y_limit, clip = "off") +
    ggplot2::scale_x_continuous(
      expand = c(0, 0),
      breaks = x_breaks,
      labels = if (is.null(x_labels)) ggplot2::waiver() else x_labels
    ) +
    ggplot2::scale_y_continuous(
      expand = c(0, 0),
      breaks = y_breaks,
      labels = if (is.null(y_labels)) ggplot2::waiver() else y_labels
    ) +
    ggplot2::labs(x = x_label, y = y_label, subtitle = subtitle) +
    ct_plot_theme()
}

ct_curve_data = function(q_grid, curve_function, y_floor = 0) {
  tibble::tibble(q = q_grid, p = curve_function(q_grid)) |>
    dplyr::filter(q >= 0, p >= y_floor)
}

ct_country_curve_layer = function(parameters, show_msc = FALSE) {
  q_grid = seq(0, 82, by = 0.25)

  layers = list(
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) ct_country_demand(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$demand,
      linewidth = 1.5
    ),
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) ct_country_supply(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$supply,
      linewidth = 1.5
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
          linewidth = 1.5
        )
      )
    )
  }

  layers
}

ct_world_curve_layer = function(parameters, show_msc = FALSE) {
  q_grid = seq(0, 110, by = 0.25)

  layers = list(
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) ct_world_demand(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$demand,
      linewidth = 1.5
    ),
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) ct_world_supply(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$supply,
      linewidth = 1.5
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
          linewidth = 1.5
        )
      )
    )
  }

  layers
}

ct_imports_arrow = function(
  x_start,
  x_end,
  y = 14,
  label = "imports",
  color = ct_palette$guide,
  parse = FALSE,
  text_size = 5.2,
  text_y_offset = 4,
  lineheight = 1.0
) {
  list(
    ggplot2::annotate(
      "segment",
      x = x_start,
      xend = x_end,
      y = y,
      yend = y,
      color = color,
      linewidth = 1.2,
      arrow = grid::arrow(
        type = "closed",
        ends = "both",
        length = grid::unit(0.10, "inches")
      )
    ),
    ggplot2::annotate(
      "text",
      x = mean(c(x_start, x_end)),
      y = y + text_y_offset,
      label = label,
      color = color,
      parse = parse,
      size = text_size,
      lineheight = lineheight
    )
  )
}

ct_delta_imports_arrow = function(
  x_start,
  x_end,
  y = 14,
  color = ct_palette$accent
) {
  list(
    ggplot2::annotate(
      "segment",
      x = x_start,
      xend = x_end,
      y = y,
      yend = y,
      color = color,
      linewidth = 1.2,
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
      label = "Delta~imports",
      parse = TRUE,
      color = color,
      size = 5.0
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
      y = 0,
      yend = max(y_values),
      linetype = "dashed",
      linewidth = 1.0,
      color = ct_palette$guide
    )
  )

  price_lines = purrr::map(
    y_values,
    ~ ggplot2::annotate(
      "segment",
      x = 0,
      xend = max(x_values),
      y = .x,
      yend = .x,
      linetype = "dashed",
      linewidth = 1.0,
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
        size = 5.2
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
        size = 5.2,
        hjust = hjust
      )
    }
  )
}

ct_plot_surplus_refresher = function(type = c("consumer", "producer")) {
  type = match.arg(type)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)

  if (type == "consumer") {
    figure = ct_base_plot(
      x_breaks = c(country$q_demand_tariff, country$q_demand),
      x_labels = c(expression(q[i * tau]^D), expression(q[i]^D)),
      y_breaks = c(country$world_price, country$tariff_price),
      y_labels = c(expression(P[W]), expression(P[W] + tau)),
      x_label = "Quantity",
      y_label = "Price"
    ) +
      ggplot2::annotate(
        "rect",
        xmin = 0,
        xmax = country$q_demand_tariff,
        ymin = country$world_price,
        ymax = country$tariff_price,
        fill = ct_palette$surplus_rect,
        alpha = 0.45
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_demand_tariff, country$q_demand, country$q_demand_tariff),
        y = c(country$tariff_price, country$world_price, country$world_price),
        fill = ct_palette$surplus_triangle,
        alpha = 0.70
      ) +
      ct_country_curve_layer(parameters) +
      ct_guide_segments(
        x_values = c(country$q_demand_tariff, country$q_demand),
        y_values = c(country$world_price, country$tariff_price)
      ) +
      ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
      ggplot2::annotate("text", x = 72, y = 74, label = "S[i]", color = ct_palette$supply, size = 4.3)

    return(figure)
  }

  ct_base_plot(
    x_breaks = c(country$q_supply, country$q_supply_tariff),
    x_labels = c(expression(q[i]^S), expression(q[i * tau]^S)),
    y_breaks = c(country$world_price, country$tariff_price),
    y_labels = c(expression(P[W]), expression(P[W] + tau)),
    x_label = "Quantity",
    y_label = "Price"
  ) +
    ggplot2::annotate(
      "rect",
      xmin = 0,
      xmax = country$q_supply,
      ymin = country$world_price,
      ymax = country$tariff_price,
      fill = ct_palette$surplus_rect,
      alpha = 0.45
    ) +
    ggplot2::annotate(
      "polygon",
      x = c(country$q_supply, country$q_supply, country$q_supply_tariff),
      y = c(country$world_price, country$tariff_price, country$tariff_price),
      fill = ct_palette$surplus_triangle,
      alpha = 0.70
    ) +
    ct_country_curve_layer(parameters) +
    ct_guide_segments(
      x_values = c(country$q_supply, country$q_supply_tariff),
      y_values = c(country$world_price, country$tariff_price)
    ) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 74, label = "S[i]", color = ct_palette$supply, size = 4.3)
}

ct_tariff_welfare_components = function(parameters = ct_country_parameters()) {
  country = ct_country_outcomes(parameters)
  tariff_wedge = country$tariff_price - country$world_price

  producer_gain_rectangle = country$q_supply * tariff_wedge
  producer_gain_triangle = 0.5 * (country$q_supply_tariff - country$q_supply) * tariff_wedge
  tariff_revenue = (country$q_demand_tariff - country$q_supply_tariff) * tariff_wedge
  production_dwl = 0.5 * (country$q_supply_tariff - country$q_supply) * tariff_wedge
  consumption_dwl = 0.5 * (country$q_demand - country$q_demand_tariff) * tariff_wedge
  consumer_loss = country$q_demand_tariff * tariff_wedge +
    0.5 * (country$q_demand - country$q_demand_tariff) * tariff_wedge

  tibble::tibble(
    area_a = producer_gain_rectangle,
    area_b = producer_gain_triangle,
    area_c = production_dwl,
    area_d = tariff_revenue,
    area_e = consumption_dwl,
    producer_gain_rectangle = producer_gain_rectangle,
    producer_gain_triangle = producer_gain_triangle,
    producer_gain = producer_gain_rectangle + producer_gain_triangle,
    tariff_revenue = tariff_revenue,
    production_dwl = production_dwl,
    consumption_dwl = consumption_dwl,
    consumer_loss = consumer_loss,
    national_welfare_change = -(production_dwl + consumption_dwl)
  )
}

ct_plot_figure_1 = function(
  stage = c(
    "consumption_distortion",
    "production_distortion",
    "welfare_dwl",
    "welfare_components",
    "welfare",
    "quantities",
    "price",
    "free_trade",
    "tariff"
  )
) {
  stage = match.arg(stage)
  if (stage == "tariff") {
    stage = "quantities"
  }
  if (stage == "welfare") {
    stage = "welfare_components"
  }
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)

  if (stage == "free_trade") {
    quantity_values = c(country$q_supply, country$q_demand)
    price_values = c(country$world_price)
    quantity_labels = c(expression(q[i]^S), expression(q[i]^D))
    price_labels = c(expression(P[W]))
    imports_start = country$q_supply
    imports_end = country$q_demand
  } else if (stage == "price") {
    quantity_values = c(country$q_supply, country$q_demand)
    price_values = c(country$world_price, country$tariff_price)
    quantity_labels = c(expression(q[i]^S), expression(q[i]^D))
    price_labels = c(expression(P[W]), expression(P[W] + tau))
    imports_start = country$q_supply
    imports_end = country$q_demand
  } else {
    quantity_values = c(
      country$q_supply,
      country$q_supply_tariff,
      country$q_demand_tariff,
      country$q_demand
    )
    price_values = c(country$world_price, country$tariff_price)
    quantity_labels = c(
      expression(q[i]^S),
      expression(q[i * tau]^S),
      expression(q[i * tau]^D),
      expression(q[i]^D)
    )
    price_labels = c(expression(P[W]), expression(P[W] + tau))
    imports_start = country$q_supply_tariff
    imports_end = country$q_demand_tariff
  }

  figure = ct_base_plot(
    x_breaks = quantity_values,
    x_labels = quantity_labels,
    y_breaks = price_values,
    y_labels = price_labels,
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Country i"
  ) +
    ct_country_curve_layer(parameters)

  if (stage %in% c("welfare_components", "welfare_dwl", "production_distortion", "consumption_distortion")) {
    producer_gain_alpha = dplyr::case_when(
      stage == "welfare_components" ~ 0.55,
      stage == "welfare_dwl" ~ 0.55,
      TRUE ~ 0.18
    )
    revenue_alpha = dplyr::case_when(
      stage == "welfare_components" ~ 0.60,
      stage == "welfare_dwl" ~ 0.60,
      TRUE ~ 0.18
    )
    production_alpha = dplyr::case_when(
      stage == "production_distortion" ~ 0.78,
      stage == "welfare_dwl" ~ 0.78,
      stage == "consumption_distortion" ~ 0.18,
      TRUE ~ 0.70
    )
    consumption_alpha = dplyr::case_when(
      stage == "consumption_distortion" ~ 0.78,
      stage == "welfare_dwl" ~ 0.78,
      stage == "production_distortion" ~ 0.18,
      TRUE ~ 0.70
    )

    figure = figure +
      ggplot2::annotate(
        "rect",
        xmin = 0,
        xmax = country$q_supply,
        ymin = country$world_price,
        ymax = country$tariff_price,
        fill = ct_palette$producer_gain,
        alpha = producer_gain_alpha
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_supply, country$q_supply, country$q_supply_tariff),
        y = c(country$world_price, country$tariff_price, country$tariff_price),
        fill = ct_palette$producer_gain,
        alpha = producer_gain_alpha
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_supply, country$q_supply_tariff, country$q_supply_tariff),
        y = c(country$world_price, country$world_price, country$tariff_price),
        fill = ct_palette$production_dwl,
        alpha = production_alpha
      ) +
      ggplot2::annotate(
        "rect",
        xmin = country$q_supply_tariff,
        xmax = country$q_demand_tariff,
        ymin = country$world_price,
        ymax = country$tariff_price,
        fill = ct_palette$revenue,
        alpha = revenue_alpha
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(country$q_demand_tariff, country$q_demand, country$q_demand_tariff),
        y = c(country$tariff_price, country$world_price, country$world_price),
        fill = ct_palette$consumption_dwl,
        alpha = consumption_alpha
      )
  }

  figure = figure +
    ct_guide_segments(
      x_values = quantity_values,
      y_values = price_values
    ) +
    ct_imports_arrow(imports_start, imports_end) +
    ggplot2::annotate("text", x = 72, y = 34, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 74, label = "S[i]", color = ct_palette$supply, size = 4.3)

  if (stage == "price") {
    figure = figure +
      ggplot2::annotate(
        "segment",
        x = 6.5,
        xend = 6.5,
        y = country$world_price,
        yend = country$tariff_price,
        linewidth = 0.8,
        color = ct_palette$tariff,
        arrow = ggplot2::arrow(
          ends = "both",
          type = "closed",
          length = grid::unit(0.08, "inches")
        )
      ) +
      ggplot2::annotate(
        "text",
        x = 10.5,
        y = mean(c(country$world_price, country$tariff_price)),
        label = "tariff wedge",
        color = ct_palette$tariff,
        size = 4.1,
        hjust = 0
      )
  }

  if (stage %in% c("welfare_components", "welfare_dwl")) {
    figure = figure +
      ggplot2::annotate("text", x = 16, y = 50, label = "a", size = 4.2) +
      ggplot2::annotate("text", x = 36.5, y = 53.0, label = "b", size = 4.2) +
      ggplot2::annotate("text", x = 40.5, y = 48.5, label = "c", size = 4.2) +
      ggplot2::annotate("text", x = 47, y = 50, label = "d", size = 4.2) +
      ggplot2::annotate("text", x = 56, y = 49, label = "e", size = 4.2)
  }

  if (stage == "production_distortion") {
    figure = figure +
      ggplot2::annotate("text", x = 40.5, y = 48.5, label = "c", size = 4.2)
  }

  if (stage == "consumption_distortion") {
    figure = figure +
      ggplot2::annotate("text", x = 56, y = 49, label = "e", size = 4.2)
  }

  figure
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
  quantity_labels = if (stage == "baseline") {
    c(expression(q[i]^S), expression(q[i]^D))
  } else {
    c(expression(q[i]^"*"), expression(q[i]^S), expression(q[i]^D))
  }

  figure = ct_base_plot(
    y_limit = c(0, 92),
    x_breaks = quantity_guides,
    x_labels = quantity_labels,
    y_breaks = c(country$world_price),
    y_labels = c(expression(P[W])),
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Country i"
  ) +
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
    {
      if (stage != "baseline") {
        list(
          ggplot2::annotate(
            "segment",
            x = 7.2,
            xend = 7.2,
            y = parameters$supply_intercept + 6.0,
            yend = parameters$supply_intercept + parameters$external_cost + 6.0,
            linewidth = 0.6,
            color = ct_palette$msc,
            arrow = ggplot2::arrow(
              ends = "both",
              type = "closed",
              length = grid::unit(0.08, "inches")
            )
          ),
          ggplot2::annotate(
            "text",
            x = 5.8,
            y = parameters$supply_intercept + 0.6 * parameters$external_cost,
            label = "e %*% d",
            parse = TRUE,
            size = 4.0,
            hjust = 1
          )
        )
      }
    } +
    ggplot2::annotate("text", x = 72, y = 28, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 72, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 64, y = 90, label = "SMC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3)
}

ct_plot_figure_2_world = function() {
  world_parameters = ct_world_parameters()
  world = ct_world_outcomes(world_parameters)

  ct_base_plot(
    x_limit = c(0, 125),
    y_limit = c(0, 92),
    x_breaks = c(world$q_world_star, world$q_world),
    x_labels = c(expression(Q[W]^"*"), expression(Q[W])),
    y_breaks = c(world$world_price, world$efficient_price),
    y_labels = c(expression(P[W]), expression(P^"*")),
    x_label = "World quantity",
    y_label = "Price",
    subtitle = "World"
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
      y = 0,
      yend = world$efficient_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = world$q_world,
      xend = world$q_world,
      y = 0,
      yend = world$world_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = 0,
      xend = world$q_world_star,
      y = world$efficient_price,
      yend = world$efficient_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate(
      "segment",
      x = 0,
      xend = world$q_world,
      y = world$world_price,
      yend = world$world_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate("text", x = 96, y = 47, label = "S[W]", parse = TRUE, color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 95, y = 72, label = "SMC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 93, y = 29, label = "D[W]", parse = TRUE, color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 102, y = 11, label = "Q[W] == sum(q[i])", parse = TRUE, size = 3.8, hjust = 0) +
    ggplot2::theme(
      axis.text.x = ggplot2::element_text(size = 15, color = "black"),
      plot.margin = ggplot2::margin(10, 22, 14, 24)
    )
}

ct_plot_figure_3 = function(stage = c("welfare", "tax_delta_imports", "tax", "baseline")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)
  quantity_breaks = if (stage == "baseline") {
    c(country$q_supply, country$q_demand)
  } else {
    c(country$q_supply_tax, country$q_supply, country$q_demand)
  }
  quantity_labels = if (stage == "baseline") {
    c(expression(q[i]^S), expression(q[i]^D))
  } else {
    c(expression(q[i * t]^S), expression(q[i]^S), expression(q[i]^D))
  }
  price_breaks = if (stage == "baseline") {
    c(country$world_price)
  } else {
    c(country$producer_price_with_tax, country$world_price)
  }
  price_labels = if (stage == "baseline") {
    c(expression(P[W]))
  } else {
    c(expression(P[W] - t), expression(P[W]))
  }

  figure = ct_base_plot(
    x_breaks = quantity_breaks,
    x_labels = quantity_labels,
    y_breaks = price_breaks,
    y_labels = price_labels,
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Country i"
  ) +
    ct_country_curve_layer(parameters, show_msc = TRUE)

  if (stage == "welfare") {
    figure = figure +
      ggplot2::annotate(
        "rect",
        xmin = 0,
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
        fill = ct_palette$surplus_triangle,
        alpha = 0.70
      )
  }

  figure +
    ct_guide_segments(
      x_values = quantity_breaks,
      y_values = price_breaks
    ) +
    ct_imports_arrow(
      if (stage %in% c("baseline", "tax", "tax_delta_imports")) country$q_supply else country$q_supply_tax,
      country$q_demand,
      label = dplyr::case_when(
        stage %in% c("tax", "tax_delta_imports") ~ "pre-tax\nimports",
        stage == "welfare" ~ "post-tax\nimports",
        TRUE ~ "imports"
      ),
      text_size = if (stage %in% c("tax", "tax_delta_imports", "welfare")) 4.8 else 5.2,
      text_y_offset = if (stage %in% c("tax", "tax_delta_imports", "welfare")) 6.5 else 4,
      lineheight = if (stage %in% c("tax", "tax_delta_imports", "welfare")) 0.85 else 1.0
    ) +
    {
      if (stage == "tax_delta_imports") {
        ct_delta_imports_arrow(country$q_supply_tax, country$q_supply, y = 14)
      }
    } +
    ggplot2::annotate("text", x = 72, y = 30, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 66, y = 94, label = "SMC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    {
      if (stage == "welfare") {
        ggplot2::annotate("text", x = 8.5, y = 40, label = "R[t]", parse = TRUE, size = 4.3, hjust = 0)
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
    }
}

ct_plot_figure_4 = function(stage = c("welfare", "revenue", "tariff", "tax_only")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)
  if (stage == "tax_only") {
    quantity_breaks = c(country$q_supply_tax, country$q_demand)
    quantity_labels = c(
      expression(q[i * t]^S),
      expression(q[i]^D)
    )
    price_breaks = c(country$producer_price_with_tax, country$world_price)
    price_labels = c(expression(P[W] - t), expression(P[W]))
  } else {
    quantity_breaks = c(country$q_supply_tax, country$q_supply, country$q_demand_tariff, country$q_demand)
    quantity_labels = c(
      expression(q[i * t]^S),
      expression(q[i]^S),
      expression(q[i * tau]^D),
      expression(q[i]^D)
    )
    price_breaks = c(country$producer_price_with_tax, country$world_price, country$tariff_price)
    price_labels = c(expression(P[W] - t), expression(P[W]), expression(P[W] + tau))
  }

  figure = ct_base_plot(
    x_breaks = quantity_breaks,
    x_labels = quantity_labels,
    y_breaks = price_breaks,
    y_labels = price_labels,
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Country i"
  ) +
    ct_country_curve_layer(parameters, show_msc = TRUE)

  if (stage %in% c("revenue", "welfare")) {
    figure = figure +
      ggplot2::annotate(
        "rect",
        xmin = 0,
        xmax = country$q_supply,
        ymin = country$producer_price_with_tax_tariff,
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
      x_values = quantity_breaks,
      y_values = price_breaks
    ) +
    ct_imports_arrow(
      if (stage == "tax_only") country$q_supply_tax else country$q_supply,
      if (stage == "tax_only") country$q_demand else country$q_demand_tariff,
      label = if (stage == "tax_only") "pre-tariff\nimports" else "post-tariff\nimports",
      text_size = 4.4,
      text_y_offset = 6.5,
      lineheight = 0.85
    ) +
    ggplot2::annotate("text", x = 72, y = 30, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 66, y = 94, label = "SMC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    {
      if (stage %in% c("revenue", "welfare")) {
        list(
          ggplot2::annotate("text", x = country$q_supply / 2, y = (country$producer_price_with_tax_tariff + country$tariff_price) / 2, label = "R[t]", parse = TRUE, size = 4.3),
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
    ggplot2::theme(plot.margin = ggplot2::margin(10, 18, 14, 58))
}

ct_plot_figure_5 = function(stage = c("welfare", "revenue", "tariff", "baseline")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)
  quantity_breaks = c(country$q_supply, country$q_supply_tariff, country$q_demand_tariff, country$q_demand)
  quantity_labels = c(
    expression(q[i]^S),
    expression(q[i * tau]^S),
    expression(q[i * tau]^D),
    expression(q[i]^D)
  )
  price_breaks = c(country$world_price, country$tariff_price)
  price_labels = c(expression(P[W]), expression(P[W] + tau))

  figure = ct_base_plot(
    x_breaks = quantity_breaks,
    x_labels = quantity_labels,
    y_breaks = price_breaks,
    y_labels = price_labels,
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Country i"
  ) +
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
      x_values = quantity_breaks,
      y_values = price_breaks
    ) +
    ct_imports_arrow(
      if (stage == "baseline") country$q_supply else country$q_supply_tariff,
      if (stage == "baseline") country$q_demand else country$q_demand_tariff,
      label = if (stage == "baseline") "pre-tariff\nimports" else "post-tariff\nimports",
      text_size = 4.4,
      text_y_offset = 6.5,
      lineheight = 0.85
    ) +
    ggplot2::annotate("text", x = 72, y = 30, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 66, y = 94, label = "SMC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
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
    ggplot2::theme(plot.margin = ggplot2::margin(10, 18, 14, 42))
}

ct_plot_figure_6 = function(stage = c("baseline", "tax")) {
  stage = match.arg(stage)
  parameters = ct_country_parameters()
  country = ct_country_outcomes(parameters)

  if (stage == "baseline") {
    return(
      ct_base_plot(
        x_breaks = c(country$q_supply_tax, country$q_supply, country$q_demand),
        x_labels = c(expression(q[i*t]^S), expression(q[i]^S), expression(q[i]^D)),
        y_breaks = c(country$world_price),
        y_labels = c(expression(P[W])),
        x_label = "Quantity",
        y_label = "Price",
        subtitle = "Country i"
      ) +
        ct_country_curve_layer(parameters, show_msc = TRUE) +
        ggplot2::annotate(
          "polygon",
          x = c(country$q_supply_tax, country$q_supply, country$q_supply),
          y = c(country$world_price, country$world_price, ct_country_msc(country$q_supply, parameters)),
          fill = ct_palette$loss,
          alpha = 0.55
        ) +
        ct_guide_segments(
          x_values = c(country$q_supply_tax, country$q_supply, country$q_demand),
          y_values = c(country$world_price)
        ) +
        ggplot2::annotate("text", x = 72, y = 30, label = "D", color = ct_palette$demand, size = 4.3) +
        ggplot2::annotate("text", x = 72, y = 71, label = "S", color = ct_palette$supply, size = 4.3) +
        ggplot2::annotate("text", x = 66, y = 94, label = "SMC", color = ct_palette$msc, size = 4.3) +
        ggplot2::annotate(
          "text",
          x = mean(c(country$q_supply_tax, country$q_supply, country$q_supply)),
          y = mean(c(country$world_price, country$world_price, ct_country_msc(country$q_supply, parameters))),
          label = "a",
          size = 4.2
        )
    )
  }

  ct_base_plot(
    x_breaks = c(country$q_supply_tax, country$q_supply, country$q_demand),
    x_labels = c(
      expression(q[i*t]^S),
      expression(q[i]^S),
      expression(q[i]^D)
    ),
    y_breaks = c(country$producer_price_with_tax, country$world_price),
    y_labels = c(expression(P[W] - t), expression(P[W])),
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Country i"
  ) +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ct_guide_segments(
      x_values = c(country$q_supply_tax, country$q_supply, country$q_demand),
      y_values = c(country$producer_price_with_tax, country$world_price)
    ) +
    ct_imports_arrow(
      country$q_supply_tax,
      country$q_demand,
      label = "imports",
      text_size = 4.4,
      text_y_offset = 3.4
    ) +
    ggplot2::annotate("text", x = 72, y = 30, label = "D", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 72, y = 71, label = "S", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 66, y = 94, label = "SMC", color = ct_palette$msc, size = 4.3)
}

ct_plot_figure_7 = function() {
  parameters = ct_country_parameters()
  small_tax = ct_small_world_tax_outcomes()
  world_parameters = ct_world_parameters()

  shifted_world_supply = function(q) ct_world_supply(q, world_parameters) + small_tax$small_tax

  panel_country = ct_base_plot(subtitle = "Country i") +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "rect",
      xmin = 0,
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
    ggplot2::annotate("text", x = 72, y = 80, label = "SMC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 19, y = 48, label = "R[t^\"'\"]", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 31, y = 50, label = "d", size = 4.2)

  q_grid = seq(8, 110, by = 0.25)
  q_world_small = small_tax$q_world_small_tax
  q_world_no_policy = small_tax$q_world_no_policy
  world_price_small = small_tax$world_price_small

  panel_world = ct_base_plot(x_limit = c(0, 110), y_limit = c(0, 92), x_label = "World quantity", subtitle = "World") +
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
      y = 0,
      yend = world_price_small,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate("text", x = 92, y = 57, label = "S[W]", parse = TRUE, color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 92, y = 68, label = "SMC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 80, y = 62, label = "S[W] + t^\"'\"", parse = TRUE, color = ct_palette$accent, size = 4.0) +
    ggplot2::annotate("text", x = 90, y = 29, label = "D[W]", parse = TRUE, color = ct_palette$demand, size = 4.3) +
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

  ct_base_plot(subtitle = "Country i") +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "rect",
      xmin = 0,
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
    ggplot2::annotate("text", x = 72, y = 80, label = "SMC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 23, y = 50, label = "Delta*PS", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 38, y = 52, label = "a", size = 4.2) +
    ggplot2::annotate("text", x = 47, y = 54, label = "R[tau]", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 58, y = 53, label = "b", size = 4.2) +
    ggplot2::annotate("text", x = small_tax$q_demand_small_tax - 2.4, y = top_price + 3.5, label = "f", size = 4.2)
}

ct_plot_figure_9 = function() {
  parameters = ct_country_parameters()
  intensity = ct_intensity_outcomes()
  world = ct_world_outcomes()

  q_world_domestic = world$q_world - 6
  domestic_world_price = world$world_price + intensity$domestic_tax

  panel_country = ct_base_plot(subtitle = "Country i") +
    ct_country_curve_layer(parameters, show_msc = TRUE) +
    ggplot2::annotate(
      "rect",
      xmin = 0,
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
    ggplot2::annotate("text", x = 72, y = 86, label = "SMC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 21, y = 49, label = "R[t]", parse = TRUE, size = 4.1) +
    ggplot2::annotate("text", x = 38, y = 52, label = "a", size = 4.2) +
    ggplot2::annotate("text", x = intensity$q_demand_domestic_tariff + 6, y = intensity$consumer_price_domestic - 2, label = "Country i\nexternal\ncost", color = ct_palette$accent, size = 2.8, lineheight = 0.9) +
    ggplot2::annotate("text", x = intensity$q_demand_domestic_tariff + 12, y = intensity$consumer_price_foreign + 1.5, label = "World\nexternal\ncost", color = ct_palette$foreign, size = 2.8, lineheight = 0.9)

  panel_world = ct_base_plot(x_limit = c(0, 110), y_limit = c(0, 92), x_label = "World quantity", subtitle = "World") +
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
      x = 0,
      xend = q_world_domestic,
      y = domestic_world_price,
      yend = domestic_world_price,
      linetype = "dashed",
      linewidth = 0.5,
      color = ct_palette$guide
    ) +
    ggplot2::annotate("text", x = 92, y = 57, label = "S[W]", parse = TRUE, color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 92, y = 68, label = "SMC", color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 90, y = 29, label = "D[W]", parse = TRUE, color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 4.5, y = domestic_world_price, label = "P''", size = 4.1, hjust = 0) +
    ggplot2::annotate("text", x = q_world_domestic + 2, y = 3.5, label = "Q[W] == Sigma*q[i]", parse = TRUE, size = 3.8, hjust = 0) +
    ggplot2::annotate("text", x = world$q_world + 2, y = 5.5, label = "Q[W]", parse = TRUE, size = 3.9)

  patchwork::wrap_plots(panel_country, panel_world, ncol = 2, widths = c(1.15, 1))
}

ct_plot_figure_10 = function() {
  parameters = ct_country_parameters()
  intensity = ct_intensity_outcomes()

  ct_base_plot(subtitle = "Country i") +
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
    ggplot2::annotate("text", x = 72, y = 86, label = "SMC[i]", parse = TRUE, color = ct_palette$msc, size = 4.3) +
    ggplot2::annotate("text", x = 36, y = intensity$producer_price_foreign - 2, label = "a", size = 4.2) +
    ggplot2::annotate("text", x = 53, y = mean(c(intensity$world_price, intensity$producer_price_foreign)), label = "b", size = 4.2) +
    ggplot2::annotate("text", x = intensity$q_demand_domestic_tariff - 2.2, y = intensity$producer_price_foreign + 3.5, label = "f", size = 4.2) +
    ggplot2::annotate("text", x = intensity$q_demand_foreign_tariff + 6, y = intensity$producer_price_foreign - 1.5, label = "Country i\nexternal\ncost", color = ct_palette$accent, size = 2.8, lineheight = 0.9) +
    ggplot2::annotate("text", x = intensity$q_demand_foreign_tariff + 13, y = intensity$consumer_price_foreign + 1.5, label = "World\nexternal\ncost", color = ct_palette$foreign, size = 2.8, lineheight = 0.9)
}

ct_assert_plot_is_warning_free = function(plot_object) {
  plot_warnings = character()

  withCallingHandlers(
    {
      print(plot_object)
    },
    warning = function(warning_condition) {
      plot_warnings <<- c(plot_warnings, conditionMessage(warning_condition))
      invokeRestart("muffleWarning")
    }
  )

  if (length(plot_warnings) > 0) {
    stop(paste(unique(plot_warnings), collapse = "\n"))
  }

  invisible(TRUE)
}

# Test the geometry rather than the pixels. These checks ensure the diagrams
# preserve the comparative-statics logic emphasized in the lecture.
test_ct_module_one_figures = function() {
  country = ct_country_outcomes()
  world = ct_world_outcomes()
  tariff_welfare = ct_tariff_welfare_components()
  numeric_example = ct_numeric_example_outcomes()
  numeric_free_trade = numeric_example |>
    dplyr::filter(.data$regime == "free_trade")
  numeric_tax_tariff = numeric_example |>
    dplyr::filter(.data$regime == "tax_tariff")
  numeric_consumption_tax = numeric_example |>
    dplyr::filter(.data$regime == "consumption_tax")
  numeric_tariff_alone = numeric_example |>
    dplyr::filter(.data$regime == "tariff_alone")
  numeric_consumption_tax_prod_subsidy = numeric_example |>
    dplyr::filter(.data$regime == "consumption_tax_prod_subsidy")
  equivalence_columns = c(
    "consumer_price",
    "producer_price",
    "domestic_production",
    "domestic_consumption",
    "imports",
    "net_revenue"
  )

  stopifnot(country$q_supply_tax < country$q_supply)
  stopifnot(country$q_supply < country$q_supply_tariff)
  stopifnot(country$q_supply < country$q_demand)
  stopifnot(country$q_supply_tariff < country$q_demand_tariff)
  stopifnot(country$q_demand_tariff < country$q_demand)
  stopifnot(country$producer_price_with_tax < country$world_price)
  stopifnot(country$world_price < country$tariff_price)
  stopifnot(country$tariff_price - country$producer_price_with_tax_tariff == ct_country_parameters()$carbon_tax)
  stopifnot(country$imports_free_trade > 0)
  stopifnot(country$imports_with_tariff < country$imports_free_trade)
  stopifnot(country$imports_with_tax > country$imports_free_trade)
  stopifnot(country$imports_with_tax_tariff < country$imports_with_tax)
  stopifnot(world$q_world_star < world$q_world)
  stopifnot(world$world_price < world$efficient_price)
  stopifnot(abs(
    tariff_welfare$consumer_loss - (
      tariff_welfare$producer_gain +
        tariff_welfare$tariff_revenue +
        tariff_welfare$production_dwl +
        tariff_welfare$consumption_dwl
    )
  ) < 1e-8)
  stopifnot(abs(
    tariff_welfare$consumer_loss - (
      tariff_welfare$area_a +
        tariff_welfare$area_b +
        tariff_welfare$area_c +
        tariff_welfare$area_d +
        tariff_welfare$area_e
    )
  ) < 1e-8)
  stopifnot(abs(tariff_welfare$producer_gain - (tariff_welfare$area_a + tariff_welfare$area_b)) < 1e-8)
  stopifnot(abs(tariff_welfare$tariff_revenue - tariff_welfare$area_d) < 1e-8)
  stopifnot(abs(tariff_welfare$national_welfare_change + (tariff_welfare$area_c + tariff_welfare$area_e)) < 1e-8)
  stopifnot(tariff_welfare$producer_gain > 0)
  stopifnot(tariff_welfare$tariff_revenue > 0)
  stopifnot(tariff_welfare$national_welfare_change < 0)
  stopifnot(all(numeric_example$imports == numeric_example$domestic_consumption - numeric_example$domestic_production))
  stopifnot(all(
    numeric_example$net_revenue ==
      numeric_example$tariff_revenue +
      numeric_example$carbon_tax_revenue +
      numeric_example$consumption_tax_revenue -
      numeric_example$production_subsidy_cost
  ))
  stopifnot(numeric_free_trade$imports == 40)
  stopifnot(numeric_tax_tariff$consumer_price == 50)
  stopifnot(numeric_tax_tariff$producer_price == 40)
  stopifnot(numeric_tax_tariff$net_revenue == 500)
  stopifnot(numeric_tariff_alone$consumer_price == 50)
  stopifnot(numeric_tariff_alone$producer_price == 50)
  stopifnot(numeric_tariff_alone$net_revenue == 200)
  stopifnot(all(vapply(
    equivalence_columns,
    function(column_name) identical(numeric_tax_tariff[[column_name]], numeric_consumption_tax[[column_name]]),
    logical(1)
  )))
  stopifnot(all(vapply(
    equivalence_columns,
    function(column_name) identical(numeric_tariff_alone[[column_name]], numeric_consumption_tax_prod_subsidy[[column_name]]),
    logical(1)
  )))
  stopifnot(inherits(ct_plot_figure_1("free_trade"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_1("price"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_1("tariff"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_1("welfare_components"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_1("welfare_dwl"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_1("production_distortion"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_1("consumption_distortion"), "ggplot"))
  stopifnot(inherits(ct_plot_surplus_refresher("consumer"), "ggplot"))
  stopifnot(inherits(ct_plot_surplus_refresher("producer"), "ggplot"))
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
  ct_assert_plot_is_warning_free(ct_plot_surplus_refresher("consumer"))
  ct_assert_plot_is_warning_free(ct_plot_surplus_refresher("producer"))
  ct_assert_plot_is_warning_free(ct_plot_figure_1("welfare_components"))
  ct_assert_plot_is_warning_free(ct_plot_figure_1("welfare_dwl"))
  ct_assert_plot_is_warning_free(ct_plot_figure_1("consumption_distortion"))
  ct_assert_plot_is_warning_free(ct_plot_figure_4("welfare"))

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
  stopifnot(inherits(ct_plot_figure_6("baseline"), "ggplot"))
  stopifnot(inherits(ct_plot_figure_6("tax"), "ggplot"))
  ct_assert_plot_is_warning_free(ct_plot_figure_6("baseline"))
  ct_assert_plot_is_warning_free(ct_plot_figure_6("tax"))

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
  ct_assert_plot_is_warning_free(ct_plot_figure_7())
  ct_assert_plot_is_warning_free(ct_plot_figure_8())
  ct_assert_plot_is_warning_free(ct_plot_figure_10())

  invisible(TRUE)
}
