#version 150

// #define DEBUG 1
const bool ENABLE_STOCHASTIC_MOTION_BLUR = false;
// #define ENABLE_STEP_COUNT
// #define ENABLE_DAY_MODE
// #define DISABLE_MOTO
// #define DISABLE_MOTO_DRIVER
// #define DISABLE_TERRAIN
// #define DISABLE_TREES

// Constants:
const int MAX_RAY_MARCH_STEPS = 250;
const float MAX_RAY_MARCH_DIST = 500.;
const int MAX_SHADOW_STEPS = 30;
const float MAX_SHADOW_DIST = 5.0;
const float NORMAL_DP = 2.*1e-3;
const float BOUNCE_OFFSET = 1e-3;
const int SPLINE_SIZE = 13;
const float INF = 1e6;
#include "shared.h"
vec2 iResolution = vec2(XRES, YRES);

const float lampHeight = 7.;

// Uniforms:
uniform float iTime;
uniform sampler2D tex;

float camFoV;
float camMotoSpace;
float camProjectionRatio;
float camShowDriver;
vec3 camPos;
vec3 camTa;
// x: actual width
// y: width + transition
// z: max width
const vec3 roadWidthInMeters = vec3(4.0, 8.0, 8.0);


// Outputs:
out vec4 fragColor;

// Semantic constants:
float PIXEL_ANGLE;
float time;

#include "common.frag"
#include "ids.frag"
#include "backgroundContent.frag"
#include "roadContent.frag"
#include "motoContent.frag"
#include "sheep.frag"
#include "rendering.frag"
#include "camera.frag"

float bloom(vec3 ro, vec3 rd, vec3 lightPosition, vec3 lightDirection, float falloff, float distFalloff)
{
    vec3 ol = motoToWorld(lightPosition, true) - ro;
    vec3 cameraToLightDir = normalize(ol);
    float dist = mix(1., length(ol), distFalloff);
    float aligned = max(0., dot(cameraToLightDir, -motoToWorld(normalize(lightDirection), false)));
    float d = 1.-dot(rd, cameraToLightDir);
    return aligned / (1.+falloff*d) / dist;
}

void main()
{
    vec2 texCoord = gl_FragCoord.xy/iResolution.xy;
    vec2 uv = (texCoord * 2. - 1.) * vec2(1., iResolution.y / iResolution.x);

    if (ENABLE_STOCHASTIC_MOTION_BLUR) {
        time = iTime + hash31(vec3(gl_FragCoord.xy, 1e-3*iTime)) * 0.008;
    } else {
        time = iTime;
    }

    selectShot();
    computeMotoPosition();

    // Compute moto position

    // camPos and camTa are passed by the vertex shader
    vec3 ro;
    vec3 rd;
    vec3 cameraTarget = camTa;
    vec3 cameraUp = vec3(0., 1., 0.);
    vec3 cameraPosition = camPos;
    if (camMotoSpace > 0.5) {
        cameraPosition = motoToWorld(camPos, true);
        cameraTarget = motoToWorld(camTa, true);
        //cameraUp = motoToWorld(cameraUp, false);
    } else {
        getRoadPositionDirectionAndCurvature(0.7, cameraPosition);
        cameraTarget = cameraPosition + camTa;
        cameraPosition += camPos;
    }
    setupCamera(uv, cameraPosition, cameraTarget, cameraUp, ro, rd);

    // View moto from front
    // motoCamera(uv, vec3(1.26, 1.07, 0.05), vec3(-10.,0.,0), ro, rd);

    // First-person view
    // motoCamera(uv, vec3(0.02, 1.2, 0.05), vec3(10.,0.,0.), ro, rd);

    // Third-person view, near ground
    // motoCamera(uv, vec3(-2., 0.5, -0.2), vec3(10.,0.,0.), ro, rd);


    vec3 p;
    vec3 radiance = rayMarchScene(ro, rd, p);

    // Bloom around headlight
    radiance += 0.2*bloom(ro, rd, headLightOffsetFromMotoRoot + vec3(0.1, -0.05, 0.), vec3(1.0, -0.15, 0.0), 10000., 0.) * 5.*vec3(1., 0.9, .8);
    radiance += bloom(ro, rd, breakLightOffsetFromMotoRoot, vec3(-1.0, -0.5, 0.0), 2000., 1.) * vec3(1., 0., 0.);

    vec3 i_color = radiance;

    // Motion blur
    fragColor = vec4(mix(i_color, texture(tex, texCoord).rgb, 0.3)
        +vec3(hash21(fract(uv+iTime)), hash21(fract(uv-iTime)), hash21(fract(uv.yx+iTime)))*.04-0.02
    , 1.);

    fragColor /= 1.+pow(length(uv),4.)*.1;

    //fragColor = vec4(radiance, 0.);
}
