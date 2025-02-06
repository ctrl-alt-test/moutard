const bool ENABLE_SMOOTHER_STEP_NOISE = false;
const float PI = acos(-1.);

// -------------------------------------------------------
// Palette function
// Code by IQ
// See: https://iquilezles.org/articles/palettes/

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d)
{
    return a + b * cos(2. * PI * (c * t + d));
}

//
// Debug palette to show the number of steps
//
#ifdef ENABLE_STEP_COUNT
vec3 stepsToColor(int steps)
{
    vec3 colorCodedCount = vec3(0.);

    vec3 colorCodes[] = vec3[](
        vec3(0.),
        vec3(0., 0., 1.),
        vec3(0., 1., 1.),
        vec3(0., 1., 0.),
        vec3(1., 1., 0.),
        vec3(1., 0., 0.),
        vec3(1., 0.4, 1.)
    );
    if (steps <= 10)
    {
        colorCodedCount = mix(colorCodes[0], colorCodes[1], clamp(float(steps) / 10, 0., 1.));
    }
    else if (steps <= 50)
    {
        colorCodedCount = mix(colorCodes[1], colorCodes[2], clamp(float(steps - 10) / 40, 0., 1.));
    }
    else if (steps <= 100)
    {
        colorCodedCount = mix(colorCodes[2], colorCodes[3], clamp(float(steps - 50) / 50, 0., 1.));
    }
    else if (steps <= 150)
    {
        colorCodedCount = mix(colorCodes[2], colorCodes[3], clamp(float(steps - 100) / 50, 0., 1.));
    }
    else if (steps <= 200)
    {
        colorCodedCount = mix(colorCodes[3], colorCodes[4], clamp(float(steps - 150) / 50, 0., 1.));
    }
    else if (steps <= 250)
    {
        colorCodedCount = mix(colorCodes[4], colorCodes[5], clamp(float(steps - 200) / 50, 0., 1.));
    }
    else
    {
        colorCodedCount = mix(colorCodes[5], colorCodes[6], clamp(float(steps - 250) / 50, 0., 1.));
    }

    return colorCodedCount;
}
#endif


// -------------------------------------------------------
// Shading functions

float invV1(float NdotV, float sqrAlpha)
{
    return NdotV + sqrt(sqrAlpha + (1.0 - sqrAlpha) * NdotV * NdotV);
}

vec3 cookTorrance(
    vec3 f0,
	float roughness,
	vec3 NcrossH,
	float VdotH,
    float NdotL,
    float NdotV)
{
	float alpha = roughness * roughness;
    float sqrAlpha = alpha * alpha;

    // Normal distribution term D:
	float distribution = dot(NcrossH, NcrossH) * (1. - sqrAlpha) + sqrAlpha;
	float D = sqrAlpha / (PI * distribution * distribution);

    // Visibility term V:
    float V = 1.0 / (invV1(NdotV, sqrAlpha) * invV1(NdotL, sqrAlpha));

    // Fresnel term F:
	float x = 1. - VdotH;
	vec3 F = x + f0 * (1. - x*x*x*x*x);

	return F * D * V;
}

// -------------------------------------------------------
// Noise functions

// TODO: try to reduce the number of hash functions?
float hash11(float x) { return fract(sin(x) * 43758.5453); }
float hash21(vec2 xy) { return fract(sin(dot(xy, vec2(12.9898, 78.233))) * 43758.5453); }
float hash31(vec3 xyz) { return hash21(vec2(hash21(xyz.xy), xyz.z)); }
vec2 hash22(vec2 xy) { return fract(sin(vec2(dot(xy, vec2(127.1,311.7)), dot(xy, vec2(269.5,183.3)))) * 43758.5453); }
vec2 hash12(float x) { float h = hash11(x); return vec2(h, hash11(h)); }

float valueNoise(vec2 p)
{
    vec2 p00 = floor(p);
    vec2 p10 = p00 + vec2(1.0, 0.0);
    vec2 p01 = p00 + vec2(0.0, 1.0);
    vec2 p11 = p00 + vec2(1.0, 1.0);

    float v00 = hash21(p00);
    float v10 = hash21(p10);
    float v01 = hash21(p01);
    float v11 = hash21(p11);

    vec2 fp = p - p00;
    if (ENABLE_SMOOTHER_STEP_NOISE)
    {
        fp = fp*fp*fp* (fp* (fp * 6.0 - 15.0) + 10.0);
    }
    else
    {
        fp = fp*fp * (3.0 - 2.0 * fp);
    }

    return mix(
        mix(v00, v10, fp.x),
        mix(v01, v11, fp.x),
    fp.y);
}

float noise(vec3 x) {

    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*f*(f*(f*6.0-15.0)+10.0);
    return mix(mix(mix( hash31(i+vec3(0,0,0)), 
                        hash31(i+vec3(1,0,0)),f.x),
                   mix( hash31(i+vec3(0,1,0)), 
                        hash31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix( hash31(i+vec3(0,0,1)), 
                        hash31(i+vec3(1,0,1)),f.x),
                   mix( hash31(i+vec3(0,1,1)), 
                        hash31(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.;
}

// TODO: merge with previous function?
vec2 valueNoise2(float p)
{
    float p0 = floor(p);
    float p1 = p0 + 1.;

    vec2 v0 = hash12(p0);
    vec2 v1 = hash12(p1);

    float fp = p - p0;
    fp = fp*fp * (3.0 - 2.0 * fp);

    return mix(v0, v1, fp);
}

float fBm(vec2 p, int iterations, float weight_param, float frequency_param)
{
    float v = 0.;
    float weight = 1.0;
    float frequency = 1.0;
    float offset = 0.0;

    for (int i = 0; i < iterations; ++i)
    {
        float noise = valueNoise(p * frequency + offset) * 2. - 1.;
        v += weight * noise;
        weight *= clamp(weight_param, 0., 1.);
        frequency *= 1.0 + 2.0 * clamp(frequency_param, 0., 1.);
        offset += 1.0;
    }
    return v;
}

// -------------------------------------------------------
// SDF functions

float smin( float d1, float d2, float k )
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

/*
float smin(float a, float b, float k)
{
    k /= 1.0 - sqrt(0.5);
    return max(k, min(a, b)) - length(max(k - vec2(a, b), 0.0));
}
*/

// merge with other capsule function?
float capsule( vec3 p, vec3 a, vec3 b, float r )
{
  vec3 pa = p - a, ba = b - a;
  return length( pa - ba*clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 ) ) - r;
}

float cappedCone( vec3 p, float h, float r1, float r2 )
{
  vec2 q = vec2( length(p.xz), p.y );
  vec2 k1 = vec2(r2,h);
  vec2 k2 = vec2(r2-r1,2.0*h);
  vec2 ca = vec2(q.x-min(q.x,(q.y<0.0)?r1:r2), abs(q.y)-h);
  vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot(k2,k2), 0.0, 1.0 );
  float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
  return s*sqrt( min(dot(ca,ca),dot(cb,cb)) );
}

float smax( float a, float b, float k )
{
    k *= 1.4;
    float h = max(k-abs(a-b),0.0);
    return max(a, b) + h*h*h/(6.0*k*k);
}

float Box2(vec2 p, vec2 size, float corner)
{
   p = abs(p) - size + corner;
   return length(max(p, 0.)) + min(max(p.x, p.y), 0.) - corner;
}

float Box3(vec3 p, vec3 size, float corner)
{
   p = abs(p) - size + corner;
   return length(max(p, 0.)) + min(max(max(p.x, p.y), p.z), 0.) - corner;
}

float Ellipsoid(in vec3 p, in vec3 r)
{
    float k0 = length(p / r);
    float k1 = length(p / (r*r));
    return k0 * (k0-1.0) / k1;
}

float Segment3(vec3 p, vec3 a, vec3 b, out float h)
{
	vec3 ap = p - a;
	vec3 ab = b - a;
	h = clamp(dot(ap, ab) / dot(ab, ab), 0., 1.);
	return length(ap - ab * h);
}

float Capsule(vec3 p, float h, float r)
{
    p.y += clamp(-p.y, 0., h);
    return length(p) - r;
}

float Torus(vec3 p, vec2 t)
{
    return length(vec2(length(p.xz) - t.x,p.y)) - t.y;
}

mat2 Rotation(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, s, -s, c);
}

// Returns 1.0 if the two vector are clockwise sorted, -1.0 otherwise
float GetWinding(vec2 a, vec2 b)
{
    return 2.0 * step(a.x * b.y, a.y * b.x) - 1.0;
}

// -------------------------------------------------------
// Raymarching functions

// x: distance
// y: ID
vec2 MinDist(vec2 d1, vec2 d2)
{
    return d1.x < d2.x ? d1 : d2;
}

// -------------------------------------------------------
// Camera functions

void setupCamera(vec2 uv, vec3 cameraPosition, vec3 cameraTarget, vec3 cameraUp, out vec3 ro, out vec3 rd)
{
    vec3 cameraForward = normalize(cameraTarget - cameraPosition);
    if (abs(dot(cameraForward, cameraUp)) > 0.99)
    {
        cameraUp = vec3(1., 0., 0.);
    }
    vec3 cameraRight = normalize(cross(cameraForward, cameraUp));
    cameraUp = normalize(cross(cameraRight, cameraForward));

    // meh. FIXME
    uv *= mix(1., length(uv), 0.1);
    ro = cameraPosition;
    rd = normalize(cameraForward * camProjectionRatio + uv.x * cameraRight + uv.y * cameraUp);
}
