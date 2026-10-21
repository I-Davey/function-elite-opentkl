/** Retained stacking order, shared by maintained controls and remaining recovered callers. */
export const layers = [
  'selectionInModal',
  'modal',
  'appHeader',
  'tooltip',
  'selection-area',
  'select',
  'tooltipIcon',
  'key',
  'sliderHandle',
  'sliderRail',
  'devicePreview',
  'base',
];
export const zIndex = (layer: string) => layers.length - layers.indexOf(layer);
