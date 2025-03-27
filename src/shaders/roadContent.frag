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

const float roadScale = 1000.;
const vec2 roadP1 = vec2(0., -1.) * roadScale;
const vec2 roadP2 = vec2(0, 1.) * roadScale;

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
    directionAndCurvature = normalize(vec3(0., -1., 0.));
    return mix(roadP2, roadP1, spline_t_and_index.x);
}

const float laneWidth = 3.5;
const float warningHeight = 3.;

vec2 panelWarning(vec3 p) {
    p -= panelWarningPos;
    float pan = Triangle(p - vec3(0., warningHeight,-5.), vec2(1.7, .1), .3);
    if (pan > 8.) {
        return vec2(INF, GROUND_ID);
    }

    pan = smax(pan, -Triangle(p - vec3(0., warningHeight, -5.1), vec2(1.6,.1), .3), .001);
    
    float tube = Box3(p-vec3(0., 2.,-5.1), vec3(.11, 2., .08), 0.);
    vec3 pp = p;
    pp.y = abs(pp.y - 3.65)-.3;
    tube = min(tube, Box3(pp-vec3(0.,0.,-5.05), vec3(.35,.1,.05), 0.));
    
    vec2 dmat = vec2(tube, METAL_ID);
    return MinDist(dmat, vec2(pan, PANEL_ID));
}

vec2 blood(vec3 p) {
    if (sceneID != SCENE_SLEEPING) {
        return vec2(INF, GROUND_ID);
    }
    p -= vec3(0, 1.2, -2.5);

    float d = p.y + smoothstep(1.5,8.,length(p.xz)) + 1.;
    if (d < 0.4) {
        d -= pow((noise(p*.9+0.)*.5+noise(p*1.6)*.3+noise(p*2.7)*.1)*.5+.5, 3.) *.45
             ;//* (1.-exp(-(iTime-137.3)*3.));
        return vec2(d, BLOOD_ID);
    }
    return vec2(d, GROUND_ID);
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
    float height = mix(
        valueNoise(p.xz*5.)*0.1 + 0.5 * 1. * fBm(p.xz * 2. / 5., 1, 0.6, 0.5),
        0.,
        isRoad*isRoad);

    if (isRoad > 0.0)
    {
        // Get the point on the center line of the spline
        vec3 directionAndCurvature;
        vec2 positionOnSpline = GetPositionOnSpline(splineUV.yw, directionAndCurvature);

        height += roadBumpHeight(splineUV.x) + pow(valueNoise(mod(p.xz*50, 100)), .01) * .1;
    }

    return vec2(p.y - height, GROUND_ID);
}

const float treeSpace = 10.;
const float maxTreeHeight = 20.;

float tree(vec3 globalP, vec3 localP, vec2 id, vec4 splineUV) {
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

    float d = treeSpace * 0.5 * 0.7;

    // Opportunity for early out: there should be no tree part on the road.
    if (abs(splineUV.x) < roadWidthInMeters.x) return d;

    // Clear trees too close to the road.
    //
    // The splineUV is relative to the current position, but we have to
    // check the distance of the road from the position of the potential
    // tree.
    float treeClearance = roadWidthInMeters.y + treeSpace * 0.5;
    vec4 splineUVatTree = ToSplineLocalSpace(id, treeClearance);
    if (abs(splineUVatTree.x) < treeClearance) return d;

    float treeHeight = mix(7., maxTreeHeight, h1);
    float treeWidth = max(3.5, treeHeight * mix(0.3, 0.4, h2*h2));

    localP.y -= terrainHeight + 0.5 * treeHeight;
    localP.xz += (vec2(h1, h2) - 0.5) * 1.5; // We cannot move the trees too much due to artifacts.

    d = min(d, Ellipsoid(localP, 0.5*vec3(treeWidth, treeHeight, treeWidth)));

    // leaves
    vec2 pNoise = vec2(2.*atan(localP.z, localP.x), localP.y) + id;
    d += 0.2*fBm(2. * pNoise, 2, 0.7, 0.5) + 0.5;

    return d;
}

vec2 treesShape(vec3 p, vec4 splineUV)
{
    // iq - repeated_ONLY_SYMMETRIC_SDFS (https://iquilezles.org/articles/sdfrepetition/)
    //vec3 lim = vec3(1e8,0,1e8);
    vec2 id = round(p.xz / treeSpace) * treeSpace;
    vec3 localP = p;
    localP.xz -= id;
    return vec2(tree(p, localP, id, splineUV), TREE_ID);
}
