/* Per-key dimming is encoded in the selected zones' RGB palettes. The firmware
 * brightness command is a master control and must never be used for selection. */
(function (root) {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function colors(value, visit) {
    if (!value || typeof value !== 'object') return;
    if (['r', 'g', 'b'].every((key) => Number.isFinite(value[key]))) {
      visit(value);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'color' && typeof child === 'string' && /^#[0-9a-f]{6}$/i.test(child)) {
        const rgb = {
          r: parseInt(child.slice(1, 3), 16),
          g: parseInt(child.slice(3, 5), 16),
          b: parseInt(child.slice(5, 7), 16),
        };
        visit(rgb);
        value[key] =
          '#' + [rgb.r, rgb.g, rgb.b].map((v) => v.toString(16).padStart(2, '0')).join('');
      } else colors(child, visit);
    }
  }
  function inspect(zones, selected) {
    const keys = new Set(selected),
      maxima = [];
    let covered = 0;
    for (const zone of zones) {
      const affected = zone.keys.filter((key) => keys.has(key));
      if (!affected.length) continue;
      covered += affected.length;
      const values = [];
      colors(clone(zone.effectSettings), (rgb) => values.push(rgb.r, rgb.g, rgb.b));
      if (!values.length)
        throw Error('Per-key brightness needs a solid color or custom color palette.');
      maxima.push(Math.max(...values));
    }
    if (!covered) throw Error('Select keys with a lighting color first.');
    return Math.max(...maxima) / 255;
  }
  /** Split selected keys out of shared zones, leaving every other palette intact. */
  function adjust(zones, selected, level, maximum = 10) {
    if (!Number.isFinite(level) || level < 0 || level > 1) throw Error('Invalid brightness.');
    inspect(zones, selected);
    const keys = new Set(selected),
      result = [];
    for (const source of zones) {
      const affected = source.keys.filter((key) => keys.has(key));
      if (!affected.length) {
        result.push(clone(source));
        continue;
      }
      const untouched = source.keys.filter((key) => !keys.has(key));
      if (untouched.length) result.push({ ...clone(source), keys: untouched });
      const effect = clone(source.effectSettings),
        values = [];
      colors(effect, (rgb) => values.push(rgb.r, rgb.g, rgb.b));
      const peak = Math.max(...values);
      if (!peak && level > 0) throw Error('Choose a color before brightening a black key.');
      colors(effect, (rgb) => {
        for (const channel of ['r', 'g', 'b'])
          rgb[channel] = Math.min(255, Math.round(peak ? (rgb[channel] / peak) * level * 255 : 0));
      });
      result.push({
        ...clone(source),
        id: source.id + '-dim-' + affected.join('-'),
        keys: affected,
        effectSettings: effect,
      });
    }
    const merged = [];
    for (const zone of result) {
      const same = merged.find(
        (other) => JSON.stringify(other.effectSettings) === JSON.stringify(zone.effectSettings),
      );
      if (same) same.keys.push(...zone.keys);
      else merged.push(zone);
    }
    if (merged.length > maximum)
      throw Error('Too many lighting groups. Use the same brightness for more keys.');
    return merged;
  }
  const api = { inspect, adjust };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.__keyBrightness = api;
})(globalThis);
