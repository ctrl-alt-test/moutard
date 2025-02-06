float smoothMin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}


// Function to compute the closest distance to a line segment
float distanceToSegment(vec2 A, vec2 B, vec2 p) {
    vec2 AB = B - A;
    float t = clamp(dot(p - A, AB) / dot(AB, AB), 0.0, 1.0);
    vec2 closest = mix(A, B, t);
    return length(p - closest);
}

// Interpolation for t on a line segment (returns a parameter t along the segment)
float tOnSegment(vec2 A, vec2 B, vec2 p) {
    vec2 AB = B - A;
    return clamp(dot(p - A, AB) / dot(AB, AB), 0.0, 1.0);
}

const float roadScale = 200.;
const vec2 roadP1 = vec2(-1., -1.) * roadScale;
const vec2 roadP2 = vec2(1., 1.) * roadScale;

// Compute a simple signed distance approximation for a road
vec4 ToSplineLocalSpace(vec2 p, float splineWidth) {
    float d = distanceToSegment(roadP1, roadP2, p);
    float t = tOnSegment(roadP1, roadP2, p);
    return vec4(d, 0., t, 1.);
}

//
// 2D position on a given Bezier curve of the spline.
// - x in [0, 1] of that curve.
// - y the index of the curve in the spline.
//
// If you have a splineUV, call:
// position = GetPositionOnSpline(splineUV.yw, directionAndCurvature)
//
// If you don't, get the pair with GetTAndIndex(t)
//
vec2 GetPositionOnSpline(vec2 spline_t_and_index, out vec3 directionAndCurvature)
{
    directionAndCurvature = normalize(vec3(-1., -1., 0.));
    return mix(roadP2, roadP1, spline_t_and_index.x);
}

const float laneWidth = 3.5;

float roadMarkings(vec2 uv, float width, vec2 params)
{
    // Total interval, line length
    vec2 t1  = vec2(26.0 / 2.0, 3.0);
    vec2 t1b = vec2(26.0 / 4.0, 1.5);
    vec2 t2  = vec2(26.0 / 4.0, 3.0);
    vec2 t3  = vec2(26.0 / 6.0, 3.0);
    vec2 t3b = vec2(26.0 / 1.0, 20.0);
    vec2 continuous = vec2(100.0, 100.0);

    vec2 separationLineParams = t1;
    if (params.x > 0.25) separationLineParams = t1b;
    if (params.x > 0.50) separationLineParams = t3;
    if (params.x > 0.75) separationLineParams = continuous;

    vec2 sideLineParams = t2;
    if (width > 4.0) sideLineParams = t3b;

    float tileY = uv.y - floor(clamp(uv.y, 3.5-width, width) / 3.5) * 3.5;
    vec2 separationTileUV = vec2(fract(uv.x / separationLineParams.x) * separationLineParams.x, tileY);
    vec2 sideTileUV = vec2(fract((uv.x + 0.4) / sideLineParams.x) * sideLineParams.x, uv.y);

    float sideLine1 = Box2(sideTileUV - vec2(0.5 * sideLineParams.y, width), vec2(0.5 * sideLineParams.y, 0.10), 0.03);
    float sideLine2 = Box2(sideTileUV - vec2(0.5 * sideLineParams.y, -width), vec2(0.5 * sideLineParams.y, 0.10), 0.03);

    float separationLine1 = Box2(separationTileUV - vec2(0.5 * separationLineParams.y, 0.0), vec2(0.5 * separationLineParams.y, 0.10), 0.01);

    float pattern = min(min(sideLine1, sideLine2), separationLine1);

    return 1.-smoothstep(-0.01, 0.01, pattern+valueNoise(uv*30)*.03*valueNoise(uv));
}

float roadBumpHeight(float d)
{
    float x = clamp(abs(d / roadWidthInMeters.x), 0., 1.);
    return 0.2 * (1. - x * x * x);
}

//
// Returns the 3D direction and curvature as a 4D return value, and the
// 3D position as an out argument, on the road spline at t in [0, 1].
//
vec4 getRoadPositionDirectionAndCurvature(float t, out vec3 position)
{
    // return vec4(0, 0, 0, 0.3);
    vec4 directionAndCurvature;
    position.xz = GetPositionOnSpline(vec2(t), directionAndCurvature.xzw);
    position.y = 0.;
    directionAndCurvature.y = 0.;

    directionAndCurvature.xyz = normalize(directionAndCurvature.xyz);
    return directionAndCurvature;
}

vec2 terrainShape(vec3 p, vec4 splineUV)
{
    // Compute the road presence
    float isRoad = 1.0 - smoothstep(roadWidthInMeters.x, roadWidthInMeters.y, abs(splineUV.x));

    // If (even partly) on the road, flatten road
    float height = 0.;
    if (isRoad > 0.0)
    {
        // Get the point on the center line of the spline
        vec3 directionAndCurvature;
        vec2 positionOnSpline = GetPositionOnSpline(splineUV.yw, directionAndCurvature);

        height += roadBumpHeight(splineUV.x) + pow(valueNoise(mod(p.xz*40, 100)), .01) * .1;
    }

    return vec2(p.y - height, GROUND_ID);
}

const float halfTreeSpace = 5.;
const float maxTreeHeight = 20.;

float tree(vec3 globalP, vec3 localP, vec2 id, vec4 splineUV, float current_t) {
    float h1 = hash21(id);
    float h2 = hash11(h1);
    float terrainHeight = -1.;

    float verticalClearance = globalP.y - terrainHeight - maxTreeHeight;
    if (verticalClearance > 0.)
    {
        // The conservative value to return is verticalClearance, but
        // doing so we run out of steps and have artifacts in the sky.
        // So instead we assume we're not going to hit any tree closer
        // than what the scene SDF is.
        return INF;
    }

    float d = halfTreeSpace * 0.7;

    // Define if the area has trees
    float presence = 1.;//smoothstep(-0.7, 0.7, fBm(id / 500., 2, 0.5, 0.3));
    if (h1 >= presence)
    {
        // We'll have to try the next cell.
        return d;
    }

    // Opportunity for early out: there should be no tree part on the road.
    if (abs(splineUV.x) < roadWidthInMeters.x) return d;

    // Clear trees too close to the road.
    //
    // The splineUV is relative to the current position, but we have to
    // check the distance of the road from the position of the potential
    // tree.
    float treeClearance = roadWidthInMeters.y + halfTreeSpace;
    vec4 splineUVatTree = ToSplineLocalSpace(id, treeClearance);
    if (abs(splineUVatTree.x) < treeClearance) return d;

    float treeHeight = mix(5., maxTreeHeight, 1.-h1*h1);
    float treeWidth = treeHeight * mix(0.3, 0.5, h2*h2);

    localP.y -= terrainHeight + 0.5 * treeHeight;
    localP.xz += (vec2(h1, h2) - 0.5) * 1.5; // We cannot move the trees too much due to artifacts.

    d = min(d, Ellipsoid(localP, 0.5*vec3(treeWidth, treeHeight, treeWidth)));

    float leaves = 1. - smoothstep(50., 200., current_t);
    if (leaves > 0.)
    {
        vec2 pNoise = vec2(2.*atan(localP.z, localP.x), localP.y) + id;
        d += 0.2*fBm(2. * pNoise, 2, 0.7, 0.5) + 1.;
    }

    return d;
}

vec2 treesShape(vec3 p, vec4 splineUV, float current_t)
{
    // iq - repeated_ONLY_SYMMETRIC_SDFS (https://iquilezles.org/articles/sdfrepetition/)
    //vec3 lim = vec3(1e8,0,1e8);
    vec2 id = round(p.xz / (halfTreeSpace * 2.)) * (halfTreeSpace * 2.);
    vec3 localP = p;
    localP.xz -= id;
    return vec2(tree(p, localP, id, splineUV, current_t), TREE_ID);
}
