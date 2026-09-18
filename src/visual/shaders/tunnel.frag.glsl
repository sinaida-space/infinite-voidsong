#version 300 es
// Infinite Voidsong: vector-CRT tunnel.
// Concentric phosphor rings receding to a vanishing point, faint radial spokes,
// two layers of star dust drifting in depth, per-family geometry tweaks, then a
// CRT post pass: phosphor bloom, scanline, and a visible ordered (Bayer 8x8) dither
// down to 6 levels per channel, cell size uDitherScale device pixels.
// Everything is per pixel on one fullscreen triangle; no textures, no extra passes.
precision highp float;

uniform vec2  uRes;          // canvas size in device pixels
uniform float uTime;         // animated seconds; frozen when still or reduced motion
uniform float uTravel;       // integrated tunnel distance (∫ speed dt); rings advance with it
uniform float uSpeed;        // current forward speed, 0 when still
uniform float uFamily[7];    // family weights: 0 noise, 1 water, 2 air, 3 fire, 4 place, 5 music, 6 tone
uniform vec4  uLevels;       // smoothed rms, low, mid, high (0..1)
uniform float uBeat;         // 1 on a kick, decays to 0 over 300 ms
uniform vec3  uLineColor;    // blended family hue (the only non-brand colour on screen)
uniform float uLineBright;   // line brightness after rms modulation, never above 0.85
uniform float uGrain;        // grain amount, noise family only
uniform float uWidthAdd;     // extra line width from the beat, music family only
uniform float uDpr;          // device pixel ratio actually rendered at
uniform float uDither;       // 0 smooth .. 1 fully dithered (default 0.8)
uniform float uDitherScale;  // dither cell size in device pixels (default 2.0)

out vec4 outColor;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float RING_DENSITY = 2.6;   // rings per unit of depth
const float SPOKES = 12.0;        // radial lines around the tunnel
const float LEVELS = 5.0;         // quantisation steps: 6 output levels per channel (0..5)
const float BLOOM_W = 5.0;        // bloom halo width as a multiple of the line width
const float BLOOM_AMT = 0.32;     // bloom halo peak brightness relative to the line
const float MAX_BRIGHT = 0.85;    // hard ceiling so UI text stays legible

// Bayer 8x8 threshold matrix, values 0..63.
const float BAYER[64] = float[64](
   0., 32.,  8., 40.,  2., 34., 10., 42.,
  48., 16., 56., 24., 50., 18., 58., 26.,
  12., 44.,  4., 36., 14., 46.,  6., 38.,
  60., 28., 52., 20., 62., 30., 54., 22.,
   3., 35., 11., 43.,  1., 33.,  9., 41.,
  51., 19., 59., 27., 49., 17., 57., 25.,
  15., 47.,  7., 39., 13., 45.,  5., 37.,
  63., 31., 55., 23., 61., 29., 53., 21.);

// Cheap 2D hash, good enough for dust and grain.
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Anti-aliased line: 1 at the line centre, 0 beyond widthPx pixels.
float lineAt(float distPx, float widthPx) {
  return 1.0 - smoothstep(widthPx - 0.6, widthPx + 0.6, distPx);
}

// Hashed point sprites in polar space (theta, depth), drifting toward the viewer.
// Each cell holds at most one point; its screen position is reprojected so points
// stay round and keep a constant pixel size regardless of depth.
//   cols/rows  cell grid resolution in theta / depth
//   drift      how far the grid has moved in depth (bigger = closer)
//   density    fraction of cells that hold a point
float sprites(vec2 uv, float theta, float z, float cols, float rows,
              float drift, float density, float sizePx, float seed) {
  vec2 g = vec2(theta / TAU * cols, z * rows + drift);
  vec2 cell = floor(g);
  cell.x = mod(cell.x, cols);                      // wrap around the tunnel
  float h = hash21(cell + seed);
  if (h > density) return 0.0;
  // Point stays inside the cell so it is never clipped at a cell edge.
  vec2 pos = vec2(hash21(cell + seed + 7.1), hash21(cell + seed + 13.7)) * 0.7 + 0.15;
  float thetaStar = (floor(g.x) + pos.x) / cols * TAU;
  float zStar = (cell.y + pos.y - drift) / rows;
  if (zStar < 0.5) return 0.0;                     // behind the viewer
  vec2 starUv = vec2(cos(thetaStar), sin(thetaStar)) / zStar;
  float dPx = length(uv - starUv) * uRes.y;
  // Fade in with depth so points appear out of the vanishing point, not pop.
  float depthFade = smoothstep(0.0, 8.0, 1.0 / zStar * 40.0);
  return lineAt(dPx, sizePx) * depthFade * (0.5 + 0.5 * h / density);
}

void main() {
  float wNoise = uFamily[0], wWater = uFamily[1], wAir = uFamily[2], wFire = uFamily[3];
  float wPlace = uFamily[4], wMusic = uFamily[5], wTone = uFamily[6];

  // --- Screen to polar, centre origin, aspect-correct ------------------------
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  // The whole tunnel breathes: a slow 7 s cycle, a little wider on the in-breath.
  float breath = 0.5 + 0.5 * sin(uTime * TAU / 7.0);
  uv *= 1.0 - 0.03 * breath;

  float theta = atan(uv.y, uv.x);
  float r = length(uv);

  // Water: the ring shapes wobble with theta, like light through a surface.
  r *= 1.0 + wWater * 0.018 * (sin(theta * 3.0 + uTime * 0.4) + 0.5 * sin(theta * 5.0 - uTime * 0.25));
  // Place: rectangularise the rings toward a square corridor cross-section.
  r = mix(r, r * max(abs(cos(theta)), abs(sin(theta))) * 1.25, wPlace);

  r = max(r, 1e-4);
  float z = 1.0 / r;                                       // depth into the tunnel

  // Distant rings dim into the void and the vanishing point itself goes black,
  // which also hides the aliasing where rings get denser than pixels.
  float depthFade = smoothstep(0.0, 0.12, r) * mix(0.18, 1.0, smoothstep(0.06, 0.55, r));

  // --- Rings ----------------------------------------------------------------
  float ringCoord = z * RING_DENSITY - uTravel;             // integer values are rings
  float ringsPerPx = fwidth(ringCoord);
  float ringDist = abs(fract(ringCoord) - 0.5);             // 0.5 at a ring, 0 halfway
  float ringDistPx = (0.5 - ringDist) / max(ringsPerPx, 1e-5);
  float lineW = (1.1 + uWidthAdd + 0.15 * breath) * uDpr;
  float ring = lineAt(ringDistPx, lineW);
  // Phosphor bloom: a wide, dim halo with a soft falloff. It sits in the low
  // brightness range where 6 levels are far apart, so this is where the dither
  // pattern is most visible; keep it wide and smooth so the cells have room.
  float ringGlow = 1.0 - smoothstep(0.0, lineW * BLOOM_W, ringDistPx);
  ringGlow *= ringGlow;                                     // quadratic falloff, brighter near the line
  float rings = clamp(ring + BLOOM_AMT * ringGlow, 0.0, 1.0);
  // Where rings get denser than about 3 px apart they would moiré; let them dissolve.
  rings *= 1.0 - smoothstep(0.12, 0.35, ringsPerPx);

  // --- Dither cell: every post effect below snaps to this grid ---------------
  // Cells are uDitherScale device pixels wide so the pattern survives dpr 1.5.
  vec2 cell = floor(gl_FragCoord.xy / uDitherScale);

  // 1-bit grain on the ring lines: each dither cell is either lit or slightly
  // dimmed, refreshed 12 times a second (frozen with uTime in reduced motion).
  // Faint on every family; the noise family adds its own analogue grain below.
  float bit = step(0.5, hash21(cell * 0.37 + floor(uTime * 12.0) * 17.0));
  rings *= 1.0 - 0.14 * uDither * bit * ring;

  // Noise: grain on the line brightness, refreshed 12 times a second, not every frame.
  float grain = hash21(gl_FragCoord.xy + floor(uTime * 12.0) * 17.0) - 0.5;
  rings *= 1.0 + uGrain * grain;

  // Tone: the rings fade and a single axial line remains.
  rings *= 1.0 - 0.85 * wTone;

  // --- Spokes: faint radial lines converging on the vanishing point ---------
  float spokeAngle = abs(fract(theta / TAU * SPOKES + 0.5) - 0.5) * TAU / SPOKES;
  float spokeDistPx = spokeAngle * r * uRes.y;
  float spokes = lineAt(spokeDistPx, 0.8 * uDpr) * 0.22 * smoothstep(0.05, 0.4, r);
  spokes *= 1.0 - wTone;

  // Tone: one horizontal line through the vanishing point.
  float axial = lineAt(abs(uv.y) * uRes.y, 0.9 * uDpr) * 0.7 * wTone;
  axial += lineAt(abs(uv.y) * uRes.y, 3.0 * uDpr) * 0.2 * wTone;

  // --- Dust and sprites -----------------------------------------------------
  // Two layers of star dust, different grids and drift so they parallax.
  float dust  = sprites(uv, theta, z, 24.0, 6.0, uTravel * 1.3, 0.35, 0.8 * uDpr, 1.0);
  dust       += sprites(uv, theta, z, 36.0, 9.0, uTravel * 2.2, 0.25, 0.6 * uDpr, 2.0) * 0.7;
  dust *= 0.5 * depthFade;                                  // rests at ~0.5 px brightness

  // Fire: warmer, larger sparks rising out of the depth, faster than the dust.
  float sparks = sprites(uv, theta, z, 20.0, 5.0, uTravel * 3.0 + uTime * 0.6, 0.30, 1.4 * uDpr, 3.0);
  sparks *= wFire * 0.7 * depthFade;

  // Air: a soft haze around the vanishing point.
  float haze = wAir * 0.06 * (1.0 - smoothstep(0.0, 0.8, r)) * (0.85 + 0.15 * breath);

  // --- Compose --------------------------------------------------------------
  float lineAmt = (rings + spokes) * depthFade + axial;
  float bright = uLineBright * (0.94 + 0.06 * breath);

  vec3 col = vec3(0.0);                                      // Void
  col += uLineColor * lineAmt * bright;
  col += mix(vec3(1.0), uLineColor, 0.4) * dust;
  col += vec3(0.878, 0.541, 0.118) * sparks;                 // fire hue
  col += uLineColor * haze;
  col = min(col, vec3(MAX_BRIGHT));

  // --- CRT post: scanline, then ordered dither to 6 levels per channel ------
  col *= 0.96 + 0.04 * sin(gl_FragCoord.y * PI);

  // Bayer 8x8 threshold looked up per dither cell (not per pixel), centred on 0.
  ivec2 px = ivec2(cell) & 7;
  float threshold = (BAYER[px.y * 8 + px.x] + 0.5) / 64.0 - 0.5;
  // Quantise in units of MAX_BRIGHT so the top level is still the legibility
  // ceiling: 6 levels per channel, 0, 0.17, 0.34, 0.51, 0.68, 0.85.
  vec3 quantised = floor(col / MAX_BRIGHT * LEVELS + threshold + 0.5) / LEVELS * MAX_BRIGHT;
  // uDither blends smooth (0) to fully dithered (1) so the two can be compared.
  col = mix(col, quantised, uDither);

  outColor = vec4(col, 1.0);
}
