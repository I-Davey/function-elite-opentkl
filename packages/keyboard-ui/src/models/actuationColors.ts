import { scaleLinear } from 'd3-scale';

/** Colours interpolate across firmware level indices; these are not measured depths. */
export const displayLevelTicks = [0, 4, 16, 28, 39];
export const levelColorScale = scaleLinear<string>()
  .domain(displayLevelTicks)
  .range(['#E81B15', '#FD7202', '#FFE60C', '#08FF01', '#01FFC0']);
export const rapidColorScale = scaleLinear<string>().domain([1, 39]).range(['#E493CF', '#AB3CB7']);
