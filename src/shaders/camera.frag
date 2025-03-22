bool hideMoto = false;

float verticalBump()
{
    return valueNoise2(6.*time).x;
}

void sideShotFront()
{
    vec2 p = vec2(0.95, 0.5);
    p.x += mix(-1., 1., valueNoise2(0.5*time).y);
    p.x += mix(-0.01, 0.01, valueNoise2(600.*time).y);
    p.y += 0.05 * verticalBump();
    camPos = vec3(p, -1.5);
    camTa = vec3(p.x, p.y + 0.1, 0.);
    camProjectionRatio = 1.2;
}

void viewFromBehind(float t_in_shot)
{
    camTa = vec3(1., 1., 0.);
    camPos = vec3(-2. - 2.5*t_in_shot, .5+0.2*t_in_shot, sin(t_in_shot));
    camProjectionRatio = 1.;
}

void motoFaceImpactShot(float t_in_shot) {
        float shift = t_in_shot/10.;
        float impact = smoothstep(9.7,10., t_in_shot);
        vec2 noise = valueNoise2(500.*t_in_shot)*shift;
        camPos = vec3(3. - impact - shift*1.2, 0.5, 0.);
        camPos.x += noise.x*.05;
        camPos.z += noise.y*.05;
        camTa = vec3(0., 1. + shift*.2, 0.);
        camProjectionRatio = 2. + impact*5.;

        globalFade *= 1. - impact; // smoothstep(4., 5., time);
}

void sheepScaredShot(float t_in_shot) {
    camMotoSpace = 0.;
    hideMoto = true;
    animationSpeed *= 0.;

    float shift = t_in_shot / 5.;
    headRot = vec2(0., -0.1);
    eyeDir = vec3(0.,-0.1,1.);
    vec2 noise = valueNoise2(100.*t_in_shot)*smoothstep(0., 5., t_in_shot);
    headRot.x += noise.x*.1;
    headRot.y += noise.y*.1;
    // headRot.x += valueNoise2(10.*t_in_shot).y*.3;
    // sin(t_in_shot*6.)*.3;

    camPos = vec3(1., 0.9, 6. - shift);
    camTa = vec3(1., 0.8, 7.);
    sheepPos = vec3(1., 0.5, 7.);
    camProjectionRatio = 1.5 + shift*2.;
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
    blink = max(fract(iTime*.333), fract(iTime*.123+.1));

    float seedOffset = 0.;

    if (get_shot(time, 10.)) {
        globalFade *= smoothstep(0., 7., time);

        // intro shot, sheep face
        camMotoSpace = 0.;
        float motion = time*.1;
        float vshift = smoothstep(6., 0., time);
        camPos = vec3(1., 0.9 + vshift*.5, 6. - motion);
        camTa = vec3(1., 0.8 + vshift*1., 7. - motion);// + t_in_shot);
        sheepPos = vec3(1., 0.5, 7. - motion);
        camProjectionRatio = 1.5;

        float headShift =
            smoothstep(6., 6.5, time) * smoothstep(9., 8.5, time);
        headRot = vec2(0., 0.4 - headShift*.5);
        eyeDir = vec3(0.,0.1-headShift*0.2,1.);
        hideMoto = true;

    } else if (get_shot(time, 5.)) {
        viewFromBehind(time);
        sheepPos = vec3(INF);

    } else if (get_shot(time, 5.)) {
        // sheep walking
        camMotoSpace = 0.;
        float motion = time*.1;
        camPos = vec3(2.5, 0.5, 3. - motion);
        sheepPos = vec3(1., 0.5, 5. - motion);
        camTa = vec3(0., 1., 4.8 - motion);// + t_in_shot);
        camProjectionRatio = 1.5;
        headRot = vec2(0., 0.2);
        eyeDir = vec3(0.,0.1,1.);

    } else if (get_shot(time, 5.)) { // moto
        sideShotFront();

    } else if (get_shot(time, 5.)) {
        // shot from back, sheep walking + /!\ warning
        float shift = smoothstep(0., 5., time);
        float motion = time*.1;
        camMotoSpace = 0.;
        camPos = vec3(0., 1.5 - motion, 6. + motion);
        sheepPos = vec3(1., 0.5, 3.7 - motion);
        panelWarningPos = vec3(3., 0.5, 2.5);
        camTa = sheepPos+vec3(0,0.5,1);
        warningIsSheep = false;
        hideMoto = true;

    } else if (get_shot(time, 5.)) {
        float t = time / 2.;
        float bump = 0.02 * verticalBump();
        camPos = vec3(-0.2 - 0.6 * t, 0.88 + 0.35*t + bump, 0.42);
        camTa = vec3(0.5, 1. + 0.2 * t + bump, 0.25);
        panelWarningPos = vec3(3.5, 0.5, 180.);
        camProjectionRatio = 1.5;
        sheepPos = vec3(INF);

    } else if (get_shot(time, 5.)) {
        // sheep still walking
        float shift = smoothstep(0., 5., time);
        camMotoSpace = 0.;
        float motion = time*.1;
        camPos = vec3(3.-motion, 1., 2. - motion);
        sheepPos = vec3(1., 0.5, 3. - motion);
        // panelWarningPos = vec3(-1.5, 0.5, 2.5);
        camTa = sheepPos+vec3(0,0.5,1);
        hideMoto = true;
        headRot = vec2(0., 0.2);
        eyeDir = vec3(0.,0.1,1.);

    } else if (get_shot(time, 5.)) {
        // moto still moto-ing
        float shift = smoothstep(0., 5., time);
        camPos = vec3(3. - 2.*shift, 0.5, -2.);
        camTa = vec3(0., 1.5, 1.);
        panelWarningPos = vec3(3., 0.5, -250.);

    } else if (get_shot(time, 5.)) {
        // sheep face, looking down
        camMotoSpace = 0.;
        hideMoto = true;
        // animationSpeed *= 0.;
        float motion = time*.1;

        float shift = smoothstep(0., 5., time);
        headRot = vec2(0., 0.5);
        eyeDir = vec3(0.,0.3,1.);

        headRot.x += sin(time*2.)*.2;
        eyeDir.x += sin(time*2.)*.2;

        camPos = vec3(1., 0.6, 6. - shift - motion);
        camTa = vec3(1., 0.8, 7.);
        sheepPos = vec3(1., 0.5, 7. - shift - motion);
        // camProjectionRatio = 1.5 + shift*2.;

    } else if (get_shot(time, 5.)) {
        // moto face scary
        float shift = smoothstep(0., 5., time);
        camPos = vec3(4. - shift, 0.8, 0.);
        camTa = vec3(0., 1.4, 0.);
        camProjectionRatio = 1.5 + shift;
        sheepPos = vec3(0., 100., 0.);

    } else if (get_shot(time, 5.)) {
        // sheep face looking up
        camMotoSpace = 0.;
        hideMoto = true;

        float motion = time*.1;
        float shift = smoothstep(0., 5., time);
        float headShift = smoothstep(2., 4., time);
        headRot = vec2(0., 0.4 - headShift*.5);
        eyeDir = vec3(0.,0.1-headShift*0.2,1.);
        camPos = vec3(1., 0.9, 6. - shift - motion);
        camTa = vec3(1., 0.8, 7. - motion);
        sheepPos = vec3(1., 0.5, 7. - motion);
        camProjectionRatio = 1.5 + shift*2.;
        eyesSurprise = 0.; // smoothstep(4.5, 4.8, time)*.2;
        squintEyes = smoothstep(3.5, 3.7, time);
        eyeDir.x += .15-smoothstep(4., 4.2, time)*.1;

    } else if (get_shot(time, 5.)) {
        // moto face scary 2
        float shift = time/10.;
        vec2 noise = valueNoise2(500.*time)*shift;
        camPos = vec3(3. - shift*1.2, 0.5, 0.);
        camPos.x += noise.x*.05;
        camPos.z += noise.y*.05;
        camTa = vec3(0., 0.5 + shift, 0.);
        camProjectionRatio = 2.;

    } else if (get_shot(time, 2.5)) {
        sheepScaredShot(time);

    } else if (get_shot(time, 2.5)) {
        motoFaceImpactShot(time+5.);

    } else if (get_shot(time, 2.5)) {
        sheepScaredShot(time+2.5);

    } else if (get_shot(time, 2.5)) {
        motoFaceImpactShot(time+7.5);


    } else if (get_shot(time, 10.)) {
        globalFade *= smoothstep(1., 4., time);
        globalFade *= smoothstep(9., 7., time);

        // looking at ground
        camMotoSpace = 0.;
        sheepPos = vec3(0., 100., 0.);
        float motion = time*.5;
        camPos = vec3(2.5, 1.5, -6. + motion);
        camTa = vec3(1., 0., -9. + motion);
        driverIsSleeping = 1;
        // sheepOnMoto = true;
        hideMoto = true;

    } else if (get_shot(time, 5.)) {
        globalFade *= smoothstep(0., 1., time);
        vec2 p = vec2(0.95, 0.5);
        p.x += mix(-1., 1., valueNoise2(0.5*time).y);
        p.x += mix(-0.01, 0.01, valueNoise2(600.*time).y);
        p.y += 0.05 * verticalBump();
        camPos = vec3(p, -1.5);
        camTa = vec3(p.x, p.y - 0.4, 0.);
        camProjectionRatio = 1.2;
        sheepOnMoto = true;
        driverIsSleeping = 2;

    } else if (get_shot(time, 5.)) {
        // sheep driving
        float trans = smoothstep(3., 0., time);
        camTa = vec3(3., 1. - trans*.8, 0.);
        camPos = vec3(5. - 0.1*time, 1., 0.);
        camPos.y += 0.05 * verticalBump();
        // camTa.y += 0.05 * verticalBump();
        // wheelie = smoothstep(3., 3.5, time);
        headRot = vec2(0., 0.2);
        driverIsSleeping = 2;
        sheepOnMoto = true;
        camProjectionRatio = 2. - smoothstep(0., 6., time);
        animationSpeed = vec3(0.);
        camProjectionRatio = 3. - time/5.;

    } else if (get_shot(time, 10.)) {
        // sheep driving + wheelie
        camTa = vec3(0., 1., 0.);
        camPos = vec3(5. - 0.1*time, 0.5, -1.-0.5*time);
        wheelie = smoothstep(1., 1.5, time);
        headRot = vec2(0., 0.2);
        driverIsSleeping = 2;
        sheepOnMoto = true;
        camProjectionRatio = 2. - smoothstep(0., 8., time);
        animationSpeed = vec3(0.);

        globalFade *= smoothstep(8., 5., time);

    } else if (get_shot(time, 5.)) {
        camPos = vec3(2.5, 1.5, -4.5);
        camMotoSpace = 0.;
        globalFade = 0.;
        shouldDrawLogo = smoothstep(0., 1., time) * smoothstep(5., 4., time);

    }

/*
    } else if (get_shot(time, 5.)) {
        // OLD - sheep walking + /!\ warning
        float shift = smoothstep(0., 5., time);
        camMotoSpace = 0.;
        float motion = time*.1;
        camPos = vec3(3., 1., 3. + motion);
        sheepPos = vec3(1., 0.5, 3.7 - motion);
        vec3 signPos = vec3(0., 1.5, 2.);
        panelWarningPos = vec3(-1.5, 0.5, 2.5);
        warningIsSheep = false;
        camTa = mix(sheepPos+vec3(0,0.5,1), signPos, smoothstep(2.5, 2.7, time));
        hideMoto = true;

    } else if (get_shot(time, 5.)) {
        // OLD - moto + sheep warning sign
        float shift = smoothstep(0., 5., time);
        camPos = vec3(3. - 2.*shift, 0.5, -2.);
        camTa = vec3(0., 1.5, 1.);
        panelWarningPos = vec3(3., 0.5, -250.);

    } else if (get_shot(time, 8.)) {
        // staticRoadShotMotoArrives2(time);
        camTa = vec3(0., 1., 0.);
        camPos = vec3(5. - 0.1*time, 2.-0.2*time, 1-0.5*time);
        wheelie = smoothstep(3., 3.5, time);
        headRot = vec2(0., 0.2);
        driverIsSleeping = true;
        sheepOnMoto = true;
        camProjectionRatio = 2. - smoothstep(0., 6., time);

    } else if (get_shot(time, 5.)) { // moto
        float shift = smoothstep(0., 5., time);
        camPos = vec3(3. - shift, 0.5, -2.);
        camTa = vec3(0., 1.5, 1.);
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
        sheepOnMoto = true;
        driverIsSleeping = true;
    } else if (get_shot(time, 10.)) {
        // staticRoadShotEnd(time);
        camMotoSpace = 0.;
        camPos = vec3(1., 1.5, 1.);
        camTa = vec3(2., 3. + 0.5*time, -10.);
        camProjectionRatio = 1.5;

    } else if (get_shot(time, 10.)) {
        moonShot(time + 20.);
    }
*/

    // camPos = vec3(2, 1, 5);
    // camTa = vec3(2, 1, 0);
    // camMotoSpace = 0.;
    // driverIsSleeping = true;

    PIXEL_ANGLE = camFoV / iResolution.x;

    float shotStartTime = iTime - time;

    // Use mix to skip the beginning/end of the road.
    float t = mod(shotStartTime, 14.)
        + (iTime - shotStartTime);
    if (hideMoto) {
        t = 0.;
    }
    motoDistanceOnCurve = mix(0.3, 0.7, t/20.);
}
