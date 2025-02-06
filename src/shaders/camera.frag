float verticalBump()
{
    return valueNoise2(6.*time).x;
}

const int SHOT_SIDE_FRONT = 0;
void sideShotFront()
{
    vec2 p = vec2(0.95, 0.5);
    p.x += mix(-0.5, 1., valueNoise2(0.5*time).y);
    p.x += mix(-0.01, 0.01, valueNoise2(600.*time).y);
    p.y += 0.05 * verticalBump();
    camPos = vec3(p, 1.5);
    camTa = vec3(p.x, p.y + 0.1, 0.);
    camProjectionRatio = 1.2;
}

void sideShotRear()
{
    vec2 p = vec2(-1., 0.5);
    p.x += mix(-0.2, 0.2, valueNoise2(0.5*time).y);
    p.x += mix(-0.01, 0.01, valueNoise2(600.*time).y);
    p.y += 0.05 * verticalBump();
    camPos = vec3(p, 1.5);
    camTa = vec3(p.x, p.y + 0.1, 0.);
    camProjectionRatio = 1.2;
}

void fpsDashboardShot()
{
    camPos = vec3(0.1, 1.12, 0.);
    camPos.z += mix(-0.02, 0.02, valueNoise2(0.1*time).x);
    camPos.y += 0.01 * valueNoise2(5.*time).y;
    camTa = vec3(5, 1, 0.);
    camProjectionRatio = 0.7;
}

// t should go from 0 to 1 in roughly 4 seconds
void dashBoardUnderTheShoulderShot(float t)
{
    t /= 4.;
    float bump = 0.02 * verticalBump();
    camPos = vec3(-0.2 - 0.6 * t, 0.88 + 0.35*t + bump, 0.42);
    camTa = vec3(0.5, 1. + 0.2 * t + bump, 0.25);
    camProjectionRatio = 1.5;
}

void frontWheelCloseUpShot()
{
    camPos = vec3(-0.1, 0.5, 0.5);
    camTa = vec3(0.9, 0.35, 0.2);
    vec2 vibration = 0.005 * valueNoise2(40.*time);
    float bump = 0.02 * verticalBump();
    vibration.x += bump
        + mix(-0.01, 0.01, valueNoise2(100.*time).y);
    camPos.yz += vibration;
    camTa.yz += vibration;
    camProjectionRatio = 1.6;
    camShowDriver = 0.;
}

void overTheHeadShot()
{
    camPos = vec3(-1.8, 1.7, 0.);
    camTa = vec3(0.05, 1.45, 0.);
    float bump = 0.01 * verticalBump();
    camPos.y += bump;
    camTa.y += bump;
    camProjectionRatio = 3.;
}

 // Also useful for debugging & visualizing the spline
void topDownView()
{
    camPos = vec3(0., 300., 0.);
    camTa = vec3(0.);
    camProjectionRatio = 4.;
}

void viewFromBehind(float t_in_shot)
{
    camTa = vec3(1., 1., 0.);
    camPos = vec3(-2. - 2.5*t_in_shot, .5+0.2*t_in_shot, sin(t_in_shot));
    camProjectionRatio = 1.;
}

void moonShot(float t_in_shot) {
    camMotoSpace = 0.;
    camPos = vec3(0., 18., 0.);
    camTa = vec3(-1., 18.3, 1. - 0.02*t_in_shot);
    camProjectionRatio = 1.5;
}

void staticRoadShot1(float t_in_shot) {
}

void staticRoadShot2(float t_in_shot) {
}

void staticRoadShotMotoArrives(float t_in_shot) {
    camMotoSpace = 0.;
    camPos = vec3(1., 1., 0.);
    camTa = vec3(-0., 1., 5.);// + t_in_shot);
    // camPos = vec3(-1., 3., -4.);
    // camTa = vec3(2., 1., 5.);// + t_in_shot);
    camProjectionRatio = 1.5;
}

void invisibleMotoShot(float t_in_shot) {
    t_in_shot /= 5.;
    camTa = vec3(10., 3., 1.);
    camPos = vec3(5, 3.+t_in_shot, 1.); // vec3(1. + 3.*time, 1.5, 1);
    camProjectionRatio = 1.;
}

bool get_shot(inout float time, float duration) {
    if (time < duration) {
        return true;
    }
    time -= duration;
    return false;
}

void selectShot() {
    float time = iTime;

    camProjectionRatio = 1.;
    camMotoSpace = 1.;
    camShowDriver = 1.;
    camFoV = atan(1. / camProjectionRatio);
    sheepPos = vec3(0., 1.2, 0.);
    wheelie = 0.;

    float seedOffset = 0.;
    if (get_shot(time, 4.5)) {
        camMotoSpace = 0.;
        camPos = vec3(1., 1., 0.);
        camTa = vec3(-0., 1., 5.);// + t_in_shot);
        camProjectionRatio = 1.5;

    } else if (get_shot(time, 8.)) {
        // staticRoadShotMotoArrives2(time);
        camTa = vec3(0., 1., 0.);
        camPos = vec3(5. - 0.1*time, 2.-0.2*time, 1-0.5*time);
        camProjectionRatio = 1.;
        wheelie = smoothstep(3., 3.5, time);
        driverIsSleeping = true;

    } else if (get_shot(time, 6.)) {
        seedOffset = 10.;
        sideShotRear();
    } else if (get_shot(time, 5.)) {
        sideShotFront();
    } else if (get_shot(time, 4.)) {
        seedOffset = 4.;
        frontWheelCloseUpShot();
    } else if (get_shot(time, 8.)) {
        seedOffset = 2.;
        overTheHeadShot();
    } else if (get_shot(time, 8.)) {
        fpsDashboardShot();
    } else if (get_shot(time, 8.)) {
        dashBoardUnderTheShoulderShot(time);
    } else if (get_shot(time, 8.)) {
        viewFromBehind(time);
    } else if (get_shot(time, 8.)) {
        camTa = vec3(0., 1.5, 0.);
        camPos = vec3(1. + 2.5*time, 1.5, -2);
        camProjectionRatio = 1.;

    } else if (get_shot(time, 4.)) {
        sideShotFront();
    } else if (get_shot(time, 4.)) {
        overTheHeadShot();
    } else if (get_shot(time, 4.)) {
        sideShotRear();
    } else if (get_shot(time, 4.)) {
        frontWheelCloseUpShot();
    } else if (get_shot(time, 8.)) {
        fpsDashboardShot();
    } else if (get_shot(time, 8.)) {
        dashBoardUnderTheShoulderShot(time);
    } else if (get_shot(time, 6.)) {
        viewFromBehind(time);
    } else if (get_shot(time, 10.)) {
        // staticRoadShotEnd(time);
        camMotoSpace = 0.;
        camPos = vec3(1., 1.5, 0.);
        camTa = vec3(2., 3. + 0.5*time, -10.);
        camProjectionRatio = 1.5;

    } else if (get_shot(time, 10.)) {
        moonShot(time + 20.);
    }

    PIXEL_ANGLE = camFoV / iResolution.x;

    float shotStartTime = iTime - time;

    // Use mix to skip the beginning/end of the road.
    float t = mod(shotStartTime, 14.)
        + (iTime - shotStartTime);
    motoDistanceOnCurve = mix(0.1, 0.9, t/20.);
}
