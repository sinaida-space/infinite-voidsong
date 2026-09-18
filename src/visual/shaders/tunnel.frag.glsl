#version 300 es
// Infinite Voidsong: a living vector-CRT tunnel.
// Phosphor rings receding to a vanishing point, but the walls are alive: two layers
// of low-frequency value noise bend the ring contours and the angle, a dim helix at
// half the ring frequency gives the walls depth and twist, the camera sways and
// rolls very slowly so the eye is led forward. Star dust drifts between the rings,
// per-family geometry tweaks stay, and the CRT post pass (phosphor bloom, scanline,
// ordered Bayer dither to 6 levels) closes it. Everything is slow: no strobing, no
// fast rotation. Everything is per pixel on one fullscreen triangle; no textures.
precision highp float;

uniform vec2  uRes;          // canvas size in device pixels
uniform float uTime;         // animated seconds; frozen when still or reduced motion
uniform float uTravel;       // integrated tunnel distance (∫ speed dt); rings advance with it
uniform float uSpeed;        // current forward speed, 0 when still
uniform float uFamily[7];    // family weights: 0 noise, 1 water, 2 air, 3 fire, 4 place, 5 music, 6 tone
uniform vec4  uLevels;       // smoothed rms, low, mid, high (0..1)
uniform float uBeat;         // 1 on a kick, decays to 0 over 300 ms
uniform vec3  uLineColor;    // wall hue near the viewer (family blend, music per source)
uniform vec3  uLineColorFar; // wall hue deep in the tunnel (differs only for two-tone sources)
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

// Camera: the vanishing point wanders on a Lissajous path and the view rolls a little.
const float SWAY_AMT = 0.06;      // ±6 % of the viewport height
const float SWAY_HZ_X = 0.017;
const float SWAY_HZ_Y = 0.011;
const float ROLL_DEG = 4.0;       // ±4° roll
const float ROLL_HZ = 0.01;

// Organic walls: noise displaces the ring coordinate (radial undulation) and the angle.
const float WARP_RING = 0.14;     // ring displacement in ring units (0.05..0.15 per spec)
const float WARP_ANGLE = 0.09;    // angular displacement in radians
const float HELIX_MIX = 0.32;     // brightness of the coarse helical set behind the rings

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

// Cheap 2D hash, good enough for dust, grain and value noise.
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Value noise on a cylinder, -1..1: the x axis wraps every `wrap` cells so the tunnel
// angle has no seam. Smoothstep interpolation keeps the contours soft, never sawtooth.
float cylNoise(vec2 p, float wrap) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, wrap);
  float x1 = mod(i.x + 1.0, wrap);
  float a = hash21(vec2(x0, i.y));
  float b = hash21(vec2(x1, i.y));
  float c = hash21(vec2(x0, i.y + 1.0));
  float d = hash21(vec2(x1, i.y + 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
}

// Two octaves are enough for a low-frequency organic drift and cheap enough for
// integrated GPUs (8 hashes per call).
float fbm(vec2 p, float wrap) {
  return cylNoise(p, wrap) * 0.65 + cylNoise(p * 2.0 + 17.0, wrap * 2.0) * 0.35;
}

// Anti-aliased line: 1 at the line centre, 0 beyond widthPx pixels.
float lineAt(float distPx, float widthPx) {
  return 1.0 - smoothstep(widthPx - 0.6, widthPx + 0.6, distPx);
}

// A phosphor line set on a periodic coordinate (integer values are lines), with the
// bloom halo and the moiré dissolve where lines get denser than pixels.
float lineSet(float coord, float widthPx) {
  float perPx = fwidth(coord);
  float dist = abs(fract(coord) - 0.5);                     // 0.5 at a line, 0 halfway
  float distPx = (0.5 - dist) / max(perPx, 1e-5);
  float line = lineAt(distPx, widthPx);
  // Phosphor bloom: a wide, dim halo with a quadratic falloff. It lives in the low
  // brightness range where 6 levels are far apart, which is where the dither shows.
  float glow = 1.0 - smoothstep(0.0, widthPx * BLOOM_W, distPx);
  glow *= glow;
  float amt = clamp(line + BLOOM_AMT * glow, 0.0, 1.0);
  // Where lines get denser than about 3 px apart they would moiré; let them dissolve.
  return amt * (1.0 - smoothstep(0.12, 0.35, perPx));
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

  // Camera sway: the vanishing point drifts on a slow Lissajous path.
  vec2 sway = SWAY_AMT * vec2(sin(uTime * TAU * SWAY_HZ_X), sin(uTime * TAU * SWAY_HZ_Y + 1.3));
  uv -= sway;

  // Camera roll: a few degrees either way, once every 100 s.
  float roll = radians(ROLL_DEG) * sin(uTime * TAU * ROLL_HZ);
  float cr = cos(roll), sr = sin(roll);
  uv = mat2(cr, -sr, sr, cr) * uv;

  // The whole tunnel breathes: a slow 7 s cycle, a little wider on the in-breath,
  // plus a subtle swell with the audio level.
  float breath = 0.5 + 0.5 * sin(uTime * TAU / 7.0);
  uv *= 1.0 - 0.03 * breath - 0.02 * uLevels.x;

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

  // --- Living walls: domain warp in (theta, depth, time) ---------------------
  // depth is measured along the tunnel and travels with it, so the bends belong to
  // the walls and slide past the viewer. Two layers at different scales and drift
  // rates (0.02..0.05 Hz) so the motion never repeats visibly.
  // Toward the vanishing point the rings compress and any bend would turn into
  // kinks, so the warp fades out there.
  float depth = z * RING_DENSITY - uTravel;
  float warpFade = smoothstep(0.05, 0.32, r);
  vec2 warpA = vec2(theta / TAU * 3.0 + uTime * 0.020, depth * 0.09 + uTime * 0.035);
  vec2 warpB = vec2(theta / TAU * 5.0 - uTime * 0.031, depth * 0.17 - uTime * 0.022);
  float bendA = fbm(warpA, 3.0);
  float bendB = fbm(warpB, 5.0);
  // Ring displacement: coarse layer shapes the contour, fine layer adds texture.
  float ringWarp = WARP_RING * warpFade * (0.75 * bendA + 0.45 * bendB);
  // Angular displacement (coarse layer only, so spokes bend without kinks).
  float thetaWarp = WARP_ANGLE * warpFade * bendA;
  float thetaW = theta + thetaWarp;

  // --- Rings and the helix behind them ----------------------------------------
  // The beat widens the lines briefly (music only), the breath a little always.
  float lineW = (1.1 + uWidthAdd + 0.15 * breath) * uDpr;
  float ringCoord = depth + ringWarp;                        // integer values are rings
  float rings = lineSet(ringCoord, lineW);
  // A coarser set at half frequency, wound once per two rings into a slow helix:
  // dimmer and a touch wider, it gives the walls depth and a hypnotic twist. One
  // whole turn per period keeps it seamless at theta = ±pi.
  rings += HELIX_MIX * lineSet(ringCoord * 0.5 + thetaW / TAU + 0.25, lineW * 1.3);
  rings = min(rings, 1.0);

  // --- Dither cell: every post effect below snaps to this grid ---------------
  // Cells are uDitherScale device pixels wide so the pattern survives dpr 1.5.
  vec2 cell = floor(gl_FragCoord.xy / uDitherScale);

  // 1-bit grain on the ring lines: each dither cell is either lit or slightly
  // dimmed, refreshed 12 times a second (frozen with uTime in reduced motion).
  // Faint on every family; the noise family adds its own analogue grain below.
  float bit = step(0.5, hash21(cell * 0.37 + floor(uTime * 12.0) * 17.0));
  rings *= 1.0 - 0.14 * uDither * bit * smoothstep(0.4, 1.0, rings);

  // Noise: grain on the line brightness, refreshed 12 times a second, not every frame.
  float grain = hash21(gl_FragCoord.xy + floor(uTime * 12.0) * 17.0) - 0.5;
  rings *= 1.0 + uGrain * grain;

  // Tone: the rings fade and a single axial line remains.
  rings *= 1.0 - 0.85 * wTone;

  // --- Spokes: faint radial lines converging on the vanishing point ---------
  // They follow the angular warp so they bend with the walls.
  float spokeAngle = abs(fract(thetaW / TAU * SPOKES + 0.5) - 0.5) * TAU / SPOKES;
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

  // Wall hue: the far colour deep in the tunnel, the near colour at the edges.
  vec3 wallHue = mix(uLineColorFar, uLineColor, smoothstep(0.08, 0.5, r));

  vec3 col = vec3(0.0);                                      // Void
  col += wallHue * lineAmt * bright;
  col += mix(vec3(1.0), wallHue, 0.4) * dust;
  col += vec3(0.878, 0.541, 0.118) * sparks;                 // fire hue
  col += wallHue * haze;
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
