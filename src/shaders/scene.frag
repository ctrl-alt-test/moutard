#version 150

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

const float lampHeight = 7.;

// Uniforms:
uniform float iTime;
uniform sampler2D tex;

const int SCENE_SHEEP = 0;
const int SCENE_MOTO = 1;
const int SCENE_BLOOD = 2;
const int SCENE_MOUTARD = 3;
int sceneID = 0;
int roadSignType = 0; // road sign: 1 is exclamation mark; 0 is sheep.
float camMotoSpace;
float camProjectionRatio = 1.;
float wheelie = 0.;
float globalFade = 1.;
float shouldDrawLogo = 0.;
float motoPitch;
vec3 camPos;
vec3 camTa;
vec3 sheepPos = vec3(0.);
vec3 panelWarningPos = vec3(6., 0., 0.);
vec3 motoPos;
vec3 headLightOffsetFromMotoRoot = vec3(0.53, 0.98, 0.0);
vec3 breakLightOffsetFromMotoRoot = vec3(-0.8, 0.75, 0.0);


// Outputs:
out vec4 fragColor;

#include "common.frag"
#include "ids.frag"
#include "backgroundContent.frag"
#include "roadContent.frag"
#include "motoContent.frag"
#include "sheep.frag"
#include "rendering.frag"
#include "camera.frag"
#include "logo.frag"


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
    vec2 iResolution = vec2(XRES, YRES);
    vec2 texCoord = gl_FragCoord.xy/iResolution.xy;
    vec2 uv = (texCoord * 2. - 1.) * vec2(1., iResolution.y / iResolution.x);

    selectShot();
    computeMotoPosition();

    // Compute moto position

    // camPos and camTa are passed by the vertex shader
    vec3 cameraTarget = camTa;
    vec3 cameraUp = vec3(0., 1., 0.);
    vec3 cameraPosition = camPos;
    if (camMotoSpace > 0.5) {
        cameraPosition = motoToWorldForCamera(camPos);
        cameraTarget = motoToWorldForCamera(camTa);
        //cameraUp = motoToWorld(cameraUp, false);
    } else {
        cameraTarget = camTa;
        cameraPosition = camPos;
    }

    // Setup camera
    vec3 cameraForward = normalize(cameraTarget - cameraPosition);
    vec3 ro = cameraPosition;
    if (abs(dot(cameraForward, cameraUp)) > 0.99)
    {
        cameraUp = vec3(1., 0., 0.);
    }
    vec3 cameraRight = normalize(cross(cameraForward, cameraUp));
    cameraUp = normalize(cross(cameraRight, cameraForward));

    // meh. FIXME
    uv *= mix(1., length(uv), 0.1);
    vec3 rd = normalize(cameraForward * camProjectionRatio + uv.x * cameraRight + uv.y * cameraUp);
    // 

    vec3 radiance = rayMarchScene(ro, rd);

    // Bloom around headlight
    if (sceneID == SCENE_MOTO || sceneID == SCENE_MOUTARD) {
        radiance += 0.3*bloom(ro, rd, headLightOffsetFromMotoRoot + vec3(0.1, -0.05, 0.), vec3(1.0, -0.15, 0.0), 10000., 0.1)
            * 5.*vec3(1., 0.9, .8);
        radiance += bloom(ro, rd, breakLightOffsetFromMotoRoot, vec3(-1.0, -0.5, 0.0), 20000., 0.1)
            * 1.5 * vec3(1., 0., 0.);
    }

    radiance = pow(pow(radiance, vec3(1./2.2)), vec3(1.0,1.05,1.1));

    // fade in + logo
    fragColor.rgb = radiance * globalFade * drawLogo(uv);

    // debug
    // uint n = uint(iTime / 5);
    // digits7(fragColor, vec4(1.,.0,0,1), uv*20.+vec2(18,-10), iResolution, n);

    fragColor /= 1.+pow(length(uv),4.)*0.6;
}
