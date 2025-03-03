float rect(vec2 p, vec2 size, float r) {
  float f1 = pow(max(abs(p.x) + r - size.x, 0.), 4.);
  float f2 = pow(max(abs(p.y) + r - size.y, 0.), 4.);
  return smoothstep(0., 0.000000008, f1 + f2 - pow(r, 4.));
}

float spacing = 0.15;

float base(vec2 p, float t) {
  float col = 1.;
  vec2 size = vec2(mix(0., 0.06, t));
  
  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 3; j++) {
      if (i == 3 && j == 1) continue;
    
      col *= rect(p - vec2(float(i), float(j)) * spacing, size, 0.01);
    }
  }
  
  return col;
}

float holes(vec2 p, float t) {
  float col = 1.;
  vec2 size = vec2(mix(0., 0.0255, t));
  float r = 0.01;
  
  float h = 0.25;  // horizontal shift
  float v = 0.25;  // vertical shift
  float v2 = 0.19; // vertical shift for E and S

  // Ctrl
  col *= rect(p - vec2(0.+h, 2.) * spacing, size, r);
  col *= rect(p - vec2(1.-h, 2.-v) * spacing, size, r);
  col *= rect(p - vec2(1.+h, 2.-v) * spacing, size, r);
  col *= rect(p - vec2(2.+h, 2.-v) * spacing, size, r);
  col *= rect(p - vec2(3.+h, 2.+v) * spacing, size, r);

  // Alt
  col *= rect(p - vec2(0., 1.-v) * spacing, size, r);
  col *= rect(p - vec2(1.+h, 1.+v) * spacing, size, r);
  col *= rect(p - vec2(2.-h, 1.-v) * spacing, size, r);
  col *= rect(p - vec2(2.+h, 1.-v) * spacing, size, r);
  
  // Test
  col *= rect(p - vec2(-h, -v) * spacing, size, r);
  col *= rect(p - vec2(h, -v) * spacing, size, r);

  col *= rect(p - vec2(1.+h, v2) * spacing, size, r);
  col *= rect(p - vec2(1.+h, -v2) * spacing, size, r);

  col *= rect(p - vec2(2.-h, -v2) * spacing, size, r);
  col *= rect(p - vec2(2.+h, v2) * spacing, size, r);

  col *= rect(p - vec2(3.-h, -v) * spacing, size, r);
  col *= rect(p - vec2(3.+h, -v) * spacing, size, r);

  return 1. - col;
}

vec3 drawLogo(vec2 uv) {
  if (shouldDrawLogo <= 0.) return vec3(0.);

  uv += vec2(0.25);
  float t = shouldDrawLogo;
  float t1 = clamp(t*2., 0., 1.);
  float t2 = clamp(t*2.-1., 0., 1.);
  vec3 col = vec3(1. - base(uv, t1) - holes(uv, t2));
  return col;
}
