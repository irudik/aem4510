# State RPS coverage from Berkeley Lab's June 2026 data update.
# The published policy map describes policies in force as of April 2026.
# Source: https://emp.lbl.gov/projects/renewables-portfolio
# Boundaries: U.S. Census 2010 TIGER states, simplified for classroom display;
# Alaska and Hawaii are repositioned and rescaled as insets in an Albers map.

#' Read the reported 2026 RPS targets, including programs with zero requirements.
#' @param asset_dir Directory containing the saved Berkeley Lab workbook.
#' @return One row per reported state, with its target and policy classification.
sb_rps_targets = function(asset_dir = "files") {
  workbook = readxl::read_excel(
    file.path(asset_dir, "08-rps-targets-june-2026.xlsx"),
    sheet = "RPS & CES Targets (%)", range = "A25:BE166",
    col_names = FALSE, .name_repair = "minimal"
  )
  target_column = which(as.character(unlist(workbook[1, ])) == "2026")
  stopifnot(length(target_column) == 1L)
  tibble::tibble(
    state = as.character(workbook[[1]]),
    category = as.character(workbook[[3]]),
    target = suppressWarnings(as.numeric(workbook[[target_column]]))
  ) |>
    dplyr::filter(!is.na(state), grepl("^Total RPS", category)) |>
    dplyr::transmute(state, target, mandatory_rps = target > 0)
}

#' Join RPS classifications to all 50 states and the District of Columbia.
#' @param asset_dir Directory containing the workbook and state boundaries.
#' @return An sf object with one observation per state or district.
sb_rps_map_data = function(asset_dir = "files") {
  targets = sb_rps_targets(asset_dir)
  boundaries = sf::st_read(
    file.path(asset_dir, "08-us-state-boundaries.geojson"), quiet = TRUE
  )
  stopifnot(!anyDuplicated(targets$state), !anyDuplicated(boundaries$state))
  stopifnot(all(is.finite(targets$target)), all(targets$target >= 0))
  stopifnot(all(targets$state %in% boundaries$state))
  # States absent from the report's target table have no mandatory RPS.
  dplyr::left_join(boundaries, targets, by = "state", relationship = "one-to-one") |>
    dplyr::mutate(mandatory_rps = dplyr::coalesce(mandatory_rps, FALSE))
}

#' Draw mandatory RPS coverage without conflating it with voluntary goals or CES.
#' @param asset_dir Directory containing the saved map inputs.
#' @return A ggplot of the 50 states and DC, with Alaska and Hawaii insets.
sb_rps_map = function(asset_dir = "files") {
  states = sb_rps_map_data(asset_dir) |>
    dplyr::mutate(policy = factor(
      ifelse(mandatory_rps, "Mandatory RPS", "No mandatory RPS"),
      levels = c("Mandatory RPS", "No mandatory RPS")
    ))
  dc = states |>
    dplyr::filter(state == "DC") |>
    sf::st_geometry() |>
    sf::st_point_on_surface() |>
    sf::st_sf(geometry = _)
  dc_xy = sf::st_coordinates(dc)[1, ]
  ggplot2::ggplot(states) +
    ggplot2::geom_sf(ggplot2::aes(fill = policy), color = "white", linewidth = 0.35) +
    ggplot2::geom_sf(data = dc, shape = 21, fill = "#638ccc", color = "white", size = 3) +
    ggplot2::annotate("segment", x = dc_xy[[1]], y = dc_xy[[2]],
      xend = dc_xy[[1]] + 330000, yend = dc_xy[[2]] - 160000,
      color = "grey35", linewidth = 0.4) +
    ggplot2::annotate("text", x = dc_xy[[1]] + 420000,
      y = dc_xy[[2]] - 180000, label = "DC", size = 5) +
    ggplot2::scale_fill_manual(values = c(
      "Mandatory RPS" = "#638ccc", "No mandatory RPS" = "#e4e7eb"
    ), drop = FALSE) +
    ggplot2::coord_sf(datum = NA, expand = FALSE, clip = "off") +
    ggplot2::theme_void(base_size = 20, base_family = "sans") +
    ggplot2::theme(
      legend.position = "bottom", legend.title = ggplot2::element_blank(),
      legend.text = ggplot2::element_text(size = 17),
      plot.margin = ggplot2::margin(8, 14, 0, 2)
    )
}

#' Check policy coverage and the arithmetic used in the classroom example.
#' @param asset_dir Directory containing the saved map inputs.
#' @return TRUE invisibly when geographic joins and compliance arithmetic pass.
test_sb_rps_figures = function(asset_dir = "../files") {
  states = sb_rps_map_data(asset_dir)
  stopifnot(nrow(states) == 51L, setequal(states$state, c(state.abb, "DC")))
  stopifnot(!anyDuplicated(states$state), !anyNA(states$mandatory_rps))
  stopifnot(all(sf::st_is_valid(states)), !any(sf::st_is_empty(states)))
  stopifnot(sum(states$mandatory_rps) == 28L)
  stopifnot(all(states$mandatory_rps[states$state %in% c("NY", "CA", "HI", "DC")]))
  stopifnot(!any(states$mandatory_rps[states$state %in% c("AZ", "TX", "KS", "MT", "AK")]))
  # At a fixed renewable share, a larger market needs more RECs and can still
  # accommodate more nonrenewable generation; the standard is not a tonnage cap.
  sales = c(100, 200)
  renewable_share = 0.30
  required_recs = renewable_share * sales
  other_generation = sales - required_recs
  stopifnot(all(required_recs == c(30, 60)), all(other_generation == c(70, 140)))
  stopifnot(all(required_recs / sales == renewable_share))
  ggplot2::ggplot_build(sb_rps_map(asset_dir))
  invisible(TRUE)
}
