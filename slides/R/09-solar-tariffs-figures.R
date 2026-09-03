# Schematic solar tariff figures for Lecture 09.
# The goal is to mirror the carbon-tariff style while shifting the missing
# wedge to the benefit side of the market.

st_solar_parameters = function() {
  list(
    demand_intercept = 95,
    demand_slope = 0.80,
    supply_intercept = 15,
    supply_slope = 0.90,
    world_price = 45,
    tariff = 10,
    benefit_wedge = 10,
    manufacturing_offset = 6
  )
}

st_private_supply = function(q, parameters = st_solar_parameters()) {
  parameters$supply_intercept + parameters$supply_slope * q
}

st_private_demand = function(q, parameters = st_solar_parameters()) {
  parameters$demand_intercept - parameters$demand_slope * q
}

st_social_benefit = function(q, parameters = st_solar_parameters()) {
  st_private_demand(q, parameters) + parameters$benefit_wedge
}

st_solar_outcomes = function(parameters = st_solar_parameters()) {
  world_price = parameters$world_price
  tariff_price = world_price + parameters$tariff

  q_supply = ct_inverse_supply(
    world_price,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_supply_tariff = ct_inverse_supply(
    tariff_price,
    parameters$supply_intercept,
    parameters$supply_slope
  )
  q_demand = ct_inverse_demand(
    world_price,
    parameters$demand_intercept,
    parameters$demand_slope
  )
  q_demand_tariff = ct_inverse_demand(
    tariff_price,
    parameters$demand_intercept,
    parameters$demand_slope
  )
  q_social = ct_inverse_demand(
    world_price - parameters$benefit_wedge,
    parameters$demand_intercept,
    parameters$demand_slope
  )

  tibble::tibble(
    world_price = world_price,
    tariff_price = tariff_price,
    q_supply = q_supply,
    q_supply_tariff = q_supply_tariff,
    q_demand = q_demand,
    q_demand_tariff = q_demand_tariff,
    q_social = q_social,
    imports_free_trade = q_demand - q_supply,
    imports_with_tariff = q_demand_tariff - q_supply_tariff,
    lost_deployment = q_demand - q_demand_tariff,
    extra_domestic_production = q_supply_tariff - q_supply,
    area_g = parameters$benefit_wedge * (q_demand - q_demand_tariff),
    area_h = parameters$manufacturing_offset * (q_supply_tariff - q_supply)
  )
}

st_curve_layers = function(parameters = st_solar_parameters(), show_smb = FALSE) {
  q_grid = seq(0, 82, by = 0.25)

  layers = list(
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) st_private_demand(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$demand,
      linewidth = 1.5
    ),
    ggplot2::geom_line(
      data = ct_curve_data(q_grid, function(q) st_private_supply(q, parameters)),
      ggplot2::aes(x = q, y = p),
      color = ct_palette$supply,
      linewidth = 1.5
    )
  )

  if (show_smb) {
    layers = c(
      layers,
      list(
        ggplot2::geom_line(
          data = ct_curve_data(q_grid, function(q) st_social_benefit(q, parameters)),
          ggplot2::aes(x = q, y = p),
          color = ct_palette$msc,
          linewidth = 1.5
        )
      )
    )
  }

  layers
}

st_plot_mirror_case = function(stage = c("carbon", "solar", "both")) {
  stage = match.arg(stage)
  carbon_parameters = ct_country_parameters()
  solar_parameters = st_solar_parameters()

  carbon_panel = ct_base_plot(
    y_limit = c(0, 108),
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Carbon"
  ) +
    ct_country_curve_layer(carbon_parameters, show_msc = TRUE) +
    ggplot2::annotate("text", x = 66, y = 42, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 66, y = 76, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 40, y = 92, label = "SMC[i]", color = ct_palette$msc, size = 4.0)

  solar_panel = ct_base_plot(
    y_limit = c(0, 108),
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Solar"
  ) +
    st_curve_layers(solar_parameters, show_smb = TRUE) +
    ggplot2::annotate("text", x = 66, y = 42, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 66, y = 76, label = "S[i]", color = ct_palette$supply, size = 4.3) +
    ggplot2::annotate("text", x = 40, y = 60, label = "SMB[i]", color = ct_palette$msc, size = 4.0)

  if (stage == "carbon") {
    return(carbon_panel)
  }

  if (stage == "solar") {
    return(solar_panel)
  }

  patchwork::wrap_plots(carbon_panel, solar_panel, ncol = 2)
}

st_plot_solar_tariff = function(stage = c("free_trade", "price", "quantities", "welfare")) {
  stage = match.arg(stage)
  mapped_stage = dplyr::case_match(
    stage,
    "free_trade" ~ "free_trade",
    "price" ~ "price",
    "quantities" ~ "quantities",
    "welfare" ~ "welfare_components"
  )

  ct_plot_figure_1(mapped_stage)
}

st_plot_solar_externality = function(
  stage = c("private", "smb", "tariff_social", "manufacturing_offset")
) {
  stage = match.arg(stage)
  parameters = st_solar_parameters()
  solar = st_solar_outcomes(parameters)

  if (stage == "private") {
    quantity_values = c(solar$q_supply, solar$q_demand)
    quantity_labels = c(expression(q[i]^S), expression(q[i]^D))
    price_values = c(solar$world_price)
    price_labels = c(expression(P[W]))
  } else if (stage == "smb") {
    quantity_values = c(solar$q_supply, solar$q_demand, solar$q_social)
    quantity_labels = c(expression(q[i]^S), expression(q[i]^D), expression(q[i]^"*"))
    price_values = c(solar$world_price)
    price_labels = c(expression(P[W]))
  } else {
    quantity_values = c(
      solar$q_supply,
      solar$q_supply_tariff,
      solar$q_demand_tariff,
      solar$q_demand
    )
    quantity_labels = c(
      expression(q[i]^S),
      expression(q[i * tau]^S),
      expression(q[i * tau]^D),
      expression(q[i]^D)
    )
    price_values = c(solar$world_price, solar$tariff_price)
    price_labels = c(expression(P[W]), expression(P[W] + tau))
  }

  figure = ct_base_plot(
    y_limit = c(0, 108),
    x_breaks = quantity_values,
    x_labels = quantity_labels,
    y_breaks = price_values,
    y_labels = price_labels,
    x_label = "Quantity",
    y_label = "Price",
    subtitle = "Country i"
  ) +
    st_curve_layers(parameters, show_smb = stage != "private") +
    ct_guide_segments(
      x_values = quantity_values,
      y_values = price_values
    ) +
    ggplot2::annotate("text", x = 66, y = 42, label = "D[i]", color = ct_palette$demand, size = 4.3) +
    ggplot2::annotate("text", x = 66, y = 76, label = "S[i]", color = ct_palette$supply, size = 4.3)

  if (stage != "private") {
    figure = figure +
      ggplot2::annotate("text", x = 38, y = 66, label = "SMB[i]", color = ct_palette$msc, size = 4.0) +
      ggplot2::annotate(
        "segment",
        x = 12,
        xend = 12,
        y = st_private_demand(12, parameters),
        yend = st_social_benefit(12, parameters),
        color = ct_palette$msc,
        linewidth = 0.8,
        arrow = ggplot2::arrow(
          ends = "both",
          type = "closed",
          length = grid::unit(0.08, "inches")
        )
      ) +
      ggplot2::annotate(
        "text",
        x = 15,
        y = mean(c(
          st_private_demand(12, parameters),
          st_social_benefit(12, parameters)
        )),
        label = "B",
        color = ct_palette$msc,
        size = 4.0,
        hjust = 0
      )
  }

  if (stage == "smb") {
    return(figure)
  }

  if (stage %in% c("tariff_social", "manufacturing_offset")) {
    figure = figure +
      ggplot2::annotate(
        "polygon",
        x = c(solar$q_supply, solar$q_supply_tariff, solar$q_supply_tariff),
        y = c(solar$world_price, solar$world_price, solar$tariff_price),
        fill = ct_palette$production_dwl,
        alpha = 0.70
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(solar$q_demand_tariff, solar$q_demand, solar$q_demand_tariff),
        y = c(solar$tariff_price, solar$world_price, solar$world_price),
        fill = ct_palette$consumption_dwl,
        alpha = 0.70
      ) +
      ggplot2::annotate(
        "polygon",
        x = c(
          solar$q_demand_tariff,
          solar$q_demand,
          solar$q_demand,
          solar$q_demand_tariff
        ),
        y = c(
          st_private_demand(solar$q_demand_tariff, parameters),
          st_private_demand(solar$q_demand, parameters),
          st_social_benefit(solar$q_demand, parameters),
          st_social_benefit(solar$q_demand_tariff, parameters)
        ),
        fill = ct_palette$demand,
        alpha = 0.35
      ) +
      ggplot2::annotate("text", x = solar$q_supply_tariff - 1.5, y = solar$world_price + 3.5, label = "c", size = 4.2) +
      ggplot2::annotate("text", x = solar$q_demand_tariff + 6.0, y = solar$world_price + 3.8, label = "e", size = 4.2) +
      ggplot2::annotate(
        "text",
        x = mean(c(solar$q_demand_tariff, solar$q_demand)),
        y = mean(c(
          st_private_demand(solar$q_demand_tariff, parameters),
          st_social_benefit(solar$q_demand, parameters)
        )),
        label = "g",
        size = 4.2
      )
  }

  if (stage == "manufacturing_offset") {
    figure = figure +
      ggplot2::annotate(
        "polygon",
        x = c(
          solar$q_supply,
          solar$q_supply_tariff,
          solar$q_supply_tariff,
          solar$q_supply
        ),
        y = c(
          st_private_supply(solar$q_supply, parameters),
          st_private_supply(solar$q_supply_tariff, parameters),
          st_private_supply(solar$q_supply_tariff, parameters) + parameters$manufacturing_offset,
          st_private_supply(solar$q_supply, parameters) + parameters$manufacturing_offset
        ),
        fill = ct_palette$gain,
        alpha = 0.45
      ) +
      ggplot2::annotate(
        "text",
        x = mean(c(solar$q_supply, solar$q_supply_tariff)),
        y = mean(c(
          st_private_supply(solar$q_supply, parameters),
          st_private_supply(solar$q_supply_tariff, parameters) + parameters$manufacturing_offset
        )),
        label = "h",
        size = 4.2
      )
  }

  figure
}

test_st_module_figures = function() {
  solar = st_solar_outcomes()
  parameters = st_solar_parameters()
  mirror_case = st_plot_mirror_case("both")

  stopifnot(inherits(mirror_case, "patchwork"))
  stopifnot(solar$tariff_price > solar$world_price)
  stopifnot(solar$q_supply_tariff > solar$q_supply)
  stopifnot(solar$q_demand_tariff < solar$q_demand)
  stopifnot(solar$imports_with_tariff < solar$imports_free_trade)
  stopifnot(solar$q_social > solar$q_demand)
  stopifnot(solar$lost_deployment == solar$q_demand - solar$q_demand_tariff)
  stopifnot(solar$extra_domestic_production == solar$q_supply_tariff - solar$q_supply)
  stopifnot(all.equal(
    st_social_benefit(20, parameters) - st_private_demand(20, parameters),
    parameters$benefit_wedge
  ) == TRUE)
  stopifnot(solar$area_g > 0)
  stopifnot(solar$area_h > 0)
  stopifnot(inherits(st_plot_solar_tariff("free_trade"), "ggplot"))
  stopifnot(inherits(st_plot_solar_tariff("price"), "ggplot"))
  stopifnot(inherits(st_plot_solar_tariff("quantities"), "ggplot"))
  stopifnot(inherits(st_plot_solar_tariff("welfare"), "ggplot"))
  stopifnot(inherits(st_plot_solar_externality("private"), "ggplot"))
  stopifnot(inherits(st_plot_solar_externality("smb"), "ggplot"))
  stopifnot(inherits(st_plot_solar_externality("tariff_social"), "ggplot"))
  stopifnot(inherits(st_plot_solar_externality("manufacturing_offset"), "ggplot"))
  ct_assert_plot_is_warning_free(st_plot_mirror_case("both"))
  ct_assert_plot_is_warning_free(st_plot_solar_tariff("free_trade"))
  ct_assert_plot_is_warning_free(st_plot_solar_tariff("price"))
  ct_assert_plot_is_warning_free(st_plot_solar_tariff("quantities"))
  ct_assert_plot_is_warning_free(st_plot_solar_tariff("welfare"))
  ct_assert_plot_is_warning_free(st_plot_solar_externality("private"))
  ct_assert_plot_is_warning_free(st_plot_solar_externality("smb"))
  ct_assert_plot_is_warning_free(st_plot_solar_externality("tariff_social"))
  ct_assert_plot_is_warning_free(st_plot_solar_externality("manufacturing_offset"))

  invisible(TRUE)
}
