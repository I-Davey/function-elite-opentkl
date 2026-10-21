/** Physical key/gap geometry shared by configuration and sensors. */
export interface KeyGeometry {
  code?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  w2?: number;
  h2?: number;
  joinedWith?: number;
}
export type KeyboardLayout = KeyGeometry[][];
export interface KeyCoordinate { x: number; y: number }
export type KeyCoordinateMap = Partial<Record<number, KeyCoordinate>>;
export interface KeyboardLayoutInfo {
  physicalLayout: 'ANSI' | 'ISO';
  formFactor: 'Fullsize' | 'MiniTkl' | 'Tenkeyless';
  keys: number[];
  coordinates: KeyCoordinateMap;
  layout: KeyboardLayout;
  width: number;
}
export interface KeyboardLayoutDevice {
  capabilityData: {
    physicalKeys?: { physicalKeysLayout?: { formFactor?: string; layout?: string } };
  };
}
