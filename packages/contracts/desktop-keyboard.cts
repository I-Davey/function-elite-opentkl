/** USB keyboard usages to Windows scan codes, including E0 extended keys. */
export const keyboardOutputs: Record<number, { label: string; scanCode: number }> = Object.fromEntries([
  ...[0x1e, 0x30, 0x2e, 0x20, 0x12, 0x21, 0x22, 0x23, 0x17, 0x24, 0x25, 0x26, 0x32,
    0x31, 0x18, 0x19, 0x10, 0x13, 0x1f, 0x14, 0x16, 0x2f, 0x11, 0x2d, 0x15, 0x2c]
    .map((scanCode, i) => [i + 4, { label: String.fromCharCode(65 + i), scanCode }]),
  ...Array.from({ length: 10 }, (_, i) => [30 + i, { label: String((i + 1) % 10), scanCode: i + 2 }]),
  ...Array.from({ length: 12 }, (_, i) => [58 + i, { label: 'F' + (i + 1), scanCode: i < 10 ? 0x3b + i : 0x57 + i - 10 }]),
  ...Array.from({ length: 12 }, (_, i) => [104 + i, { label: 'F' + (i + 13), scanCode: i === 11 ? 0x76 : 0x64 + i }]),
  ...([
    [40, 'Enter', 0x1c], [41, 'Escape', 1], [42, 'Backspace', 0x0e], [43, 'Tab', 0x0f], [44, 'Space', 0x39],
    [45, '-', 0x0c], [46, '=', 0x0d], [47, '[', 0x1a], [48, ']', 0x1b], [49, '\\', 0x2b],
    [50, 'Non-US #', 0x2b], [51, ';', 0x27], [52, "'", 0x28], [53, '`', 0x29], [54, ',', 0x33],
    [55, '.', 0x34], [56, '/', 0x35], [57, 'Caps Lock', 0x3a], [70, 'Print Screen', 0xe037], [71, 'Scroll Lock', 0x46],
    [73, 'Insert', 0xe052], [74, 'Home', 0xe047], [75, 'Page Up', 0xe049], [76, 'Delete', 0xe053],
    [77, 'End', 0xe04f], [78, 'Page Down', 0xe051], [79, 'Right arrow', 0xe04d], [80, 'Left arrow', 0xe04b],
    [81, 'Down arrow', 0xe050], [82, 'Up arrow', 0xe048], [83, 'Num Lock', 0x45], [84, 'Numpad /', 0xe035],
    [85, 'Numpad *', 0x37], [86, 'Numpad -', 0x4a], [87, 'Numpad +', 0x4e], [88, 'Numpad Enter', 0xe01c],
    [89, 'Numpad 1', 0x4f], [90, 'Numpad 2', 0x50], [91, 'Numpad 3', 0x51], [92, 'Numpad 4', 0x4b],
    [93, 'Numpad 5', 0x4c], [94, 'Numpad 6', 0x4d], [95, 'Numpad 7', 0x47], [96, 'Numpad 8', 0x48],
    [97, 'Numpad 9', 0x49], [98, 'Numpad 0', 0x52], [99, 'Numpad .', 0x53], [100, 'Non-US \\', 0x56],
    [101, 'Menu', 0xe05d], [224, 'Left Ctrl', 0x1d], [225, 'Left Shift', 0x2a], [226, 'Left Alt', 0x38],
    [227, 'Left Windows', 0xe05b], [228, 'Right Ctrl', 0xe01d], [229, 'Right Shift', 0x36],
    [230, 'Right Alt', 0xe038], [231, 'Right Windows', 0xe05c],
  ] as [number, string, number][]).map(([key, label, scanCode]) => [key, { label, scanCode }]),
]);
