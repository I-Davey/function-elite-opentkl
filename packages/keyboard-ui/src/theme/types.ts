/** Required colour operations supplied by the existing light/dark themes. */
export interface ThemeColor {
  toString(): string;
  alpha(amount: number): ThemeColor;
  lighten(amount: number): ThemeColor;
  darken(amount: number): ThemeColor;
  toHex(): string;
}

interface ShimlessButtonColors {
  color: ThemeColor;
  hoverColor: ThemeColor;
  activeColor: ThemeColor;
}

interface SelectColors {
  control: {
    backgroundColor: ThemeColor;
    borderColor: ThemeColor;
    focusedBorderColor: ThemeColor;
    hoverBackgroundColor: ThemeColor;
  };
  dropdownIndicator: { color: ThemeColor };
  value: { color: ThemeColor };
  menu: { borderColor: ThemeColor; backgroundColor: ThemeColor };
  option: {
    color: ThemeColor;
    backgroundColor: ThemeColor;
    hoverBackgroundColor: ThemeColor;
    focusedColor: ThemeColor;
    selectedBackgroundColor: ThemeColor;
  };
}

/** Component-owned portion of the existing CAM theme; expand with each migrated control. */
export interface KeyboardTheme {
  macroUI: { activationKeyWarning: ThemeColor; title: { text: ThemeColor } };
  keyboard: {
    keyCapWall: ThemeColor; keyCapSurface: ThemeColor; selectedKeyText: ThemeColor;
    opaqueKey: ThemeColor; keyBackground: ThemeColor; simpleRemap: ThemeColor;
    simpleRemapDual: ThemeColor; macro: ThemeColor; snapOverride: ThemeColor;
    selectionBackground: ThemeColor; selectionBorder: ThemeColor; quickSelectBorder: ThemeColor;
    snapOverrideFirstRectPressed: ThemeColor; snapOverrideFirstRect: ThemeColor;
    snapOverrideSecondRectPressed: ThemeColor; snapOverrideSecondRect: ThemeColor;
    snapOverrideThirdRectPressed: ThemeColor; snapOverridesThirdRect: ThemeColor;
    snapOverrideFontColor: ThemeColor;
  };
  colorPicker: { backgroundColor: ThemeColor; button: { borderColor: ThemeColor; color: ThemeColor } };
  lightingAccessory: { expandedBackgroundColor: ThemeColor };
  modal: { backgroundColor: ThemeColor; closeButton: ThemeColor; closeIcon: ThemeColor };
  tooltip: { backgroundColor: ThemeColor };
  select: SelectColors & { control: { disableBackgroundColor: ThemeColor } };
  secondarySelect: SelectColors;
  body: {
    primary: ThemeColor;
    secondary: ThemeColor;
    labelColor: ThemeColor;
    backgroundColor: ThemeColor;
    borderColor: ThemeColor;
    text1: ThemeColor;
    separatorColor: ThemeColor;
    text2: ThemeColor;
    text3: ThemeColor;
    text4: ThemeColor;
    ddColor: ThemeColor;
    dtColor: ThemeColor;
  };
  settings: { navBackgroundColor: ThemeColor };
  subnav: { hoverBackgroundColor: ThemeColor };
  controlTabs: { background: ThemeColor; selectedBackground: ThemeColor; selected: ThemeColor };
  segmentedPicker: {
    borderColor: ThemeColor;
    underline: { background: ThemeColor; selected: ThemeColor };
  };
  ui: {
    tooltipBackgroundColor: ThemeColor;
    tooltipColor: ThemeColor;
    tooltipSecondaryColor: ThemeColor;
    disabledColor: ThemeColor;
    disabledText: ThemeColor;
    borderColor: ThemeColor;
    focusedBorderColor: ThemeColor;
    selectedBackgroundColor: ThemeColor;
    selectedIndicatorColor: ThemeColor;
  };
  slider: {
    disableBackgroundColor: ThemeColor;
    disableIconColor: ThemeColor;
    disableSliderColor: ThemeColor;
    sliderColor: ThemeColor;
    iconColor: ThemeColor;
    color: ThemeColor;
    backgroundColor: ThemeColor;
    valueColor: ThemeColor;
    labelColor: ThemeColor;
    hintTextColor: ThemeColor;
  };
  primaryShimlessButton: ShimlessButtonColors;
  secondaryShimlessButton: ShimlessButtonColors;
  secondaryButton: {
    backgroundColor: ThemeColor;
    borderColor: ThemeColor;
    color: ThemeColor;
    hoverBackgroundColor: ThemeColor;
    hoverBorderColor: ThemeColor;
    hoverColor: ThemeColor;
  };
}

declare module '@emotion/react' {
  export interface Theme extends KeyboardTheme {}
}
