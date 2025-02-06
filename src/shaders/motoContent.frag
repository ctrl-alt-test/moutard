vec3 motoPos;
vec3 headLightOffsetFromMotoRoot = vec3(0.53, 0.98, 0.0);
vec3 breakLightOffsetFromMotoRoot = vec3(-1.14, 0.55, 0.0);
float motoYaw;
float motoPitch;
float motoRoll;
float motoDistanceOnCurve;

//
// Moto position functions
//

// Moto local space:
// - The moto is aligned with the X axis.
// - The anchor point is on the ground, roughly at the center (engine).
//        Y
//        ^
//        |
//        |_o<)
//    _--<| /\_  ==>
//   (o)\ |/ (o)
// -------+--------> X
//

void computeMotoPosition()
{
    vec4 motoDirAndTurn = getRoadPositionDirectionAndCurvature(motoDistanceOnCurve, motoPos);

    vec2 motoRight = vec2(-motoDirAndTurn.z, motoDirAndTurn.x);
    float rightOffset = 2.0 + 0.5*sin(time);
    motoPos.xz += motoRight * rightOffset;
    motoPos.y += roadBumpHeight(abs(rightOffset))+.1;

    motoYaw = atan(motoDirAndTurn.z, motoDirAndTurn.x);
    motoPitch = atan(motoDirAndTurn.y, length(motoDirAndTurn.zx));
    motoRoll = 20. * motoDirAndTurn.w;
}

vec3 motoToWorld(vec3 v, bool isPos)
{
    v.xy *= Rotation(-motoPitch);
    v.yz *= Rotation(-motoRoll);
    v.xz *= Rotation(-motoYaw);
    if (isPos)
    {
        v += motoPos;
    }
    return v;
}

vec3 worldToMoto(vec3 v, bool isPos)
{
    if (isPos)
    {
        v -= motoPos;
    }
    v.xz *= Rotation(motoYaw);
    v.yz *= Rotation(motoRoll);
    v.xy *= Rotation(motoPitch);
    return v;
}

vec2 driverShape(vec3 p)
{
    p = worldToMoto(p, true);

    // Place roughly on the seat
    p -= vec3(-0.35, 0.78, 0.0);

    float d = length(p);
    if (d > 1.2 || camShowDriver < 0.5)
        return vec2(d, MOTO_DRIVER_ID);

    vec3 simP = p;
    simP.z = abs(simP.z);

    float wind = fBm((p.xy + time) * 12., 1, 0.5, 0.5);

    // upper body
    if (true && d < 0.8)
    {
        vec3 pBody = p;
        pBody.z = max(abs(pBody.z)-0.02,0);
        pBody.xy *= Rotation(3.1);
        pBody.yz *= Rotation(-0.1);
        d = smin(d, Capsule(pBody, 0.12, 0.12), 0.1);

        pBody.y += 0.2;
        pBody.xy *= Rotation(-0.6);
        d = smin(d, Capsule(pBody, 0.12, 0.11), 0.02);

        pBody.y += 0.2;
        pBody.xy *= Rotation(-0.3);
        pBody.yz *= Rotation(-0.2);
        d = smin(d, Capsule(pBody, 0.12, 0.12), 0.02);

        pBody.y += 0.1;
        pBody.yz *= Rotation(1.7);
        d = smin(d, Capsule(pBody, 0.12, 0.1), 0.015);

        pBody=p;
        pBody.y-=.48;
        pBody.x-=.25;
        pBody.xy *= Rotation(-.7);
        d = min(d, length(vec2(max(abs(pBody.y)-.07,0),abs(length(pBody.xz)-.05)))-.04);
    }
    d += 0.005 * wind;
    
    // arms
    if (true)
    {
        vec3 pArm = simP;

        pArm -= vec3(0.23, 0.45, 0.18);
        pArm.yz *= Rotation(-0.6);
        pArm.xy *= Rotation(0.2);
        float arms = Capsule(pArm, 0.29, 0.06);
        d = smin(d, arms, 0.005);

        pArm.y += 0.32;
        pArm.xy *= Rotation(1.5);
        arms = Capsule(pArm, 0.28, 0.04);
        d = smin(d, arms, 0.005);
    }
    d += 0.01 * wind;

    // lower body
    if (true)
    {
        vec3 pLeg = simP;

        pLeg -= vec3(0.0, 0.0, 0.13);
        pLeg.xy *= Rotation(1.55);
        pLeg.yz *= Rotation(-0.45);
        float h2 = Capsule(pLeg, 0.35, 0.09);
        d = smin(d, h2, 0.01);

        pLeg.y += 0.4;
        pLeg.xy *= Rotation(-1.5);
        float legs = Capsule(pLeg, 0.4, 0.06);
        d = smin(d, legs, 0.01);

        pLeg.y += 0.45;
        pLeg.xy *= Rotation(1.75);
        pLeg.yz *= Rotation(0.25);
        float feet = Capsule(pLeg, 0.2, 0.04);
        d = smin(d, feet, 0.01);
    }
    d += 0.002 * wind;

    // head
    if (true)
    {
        vec3 pHead = p - vec3(0.39, 0.6, 0.0);
        float head = max(
            length(pHead*vec3(1,1,1.2+pHead.y)) - 0.15,
            -pHead.y-.09-pHead.x
        );

        if (head < d)
        {
            return vec2(head, MOTO_DRIVER_HELMET_ID);
        }
    }

    return vec2(d, MOTO_DRIVER_ID);
}

vec2 wheelShape(vec3 p, float wheelRadius, float tireRadius, float innerRadius, vec3 innerPart)
{
    vec2 d = vec2(1e6, MOTO_WHEEL_ID);
    float wheel = Torus(p.yzx, vec2(wheelRadius, tireRadius));

    if (wheel < 0.25)
    {
        p.z = abs(p.z);
        float h;
        float cyl = Segment3(p, vec3(0.0), vec3(0.0, 0.0, 1.0), h);
        wheel = -smin(-wheel, cyl - innerRadius, 0.01);

        /**/
        // Note: the following group of lines is 1 byte smaller written as
        wheel = min(wheel, -min(min(min(0.15 - cyl, cyl - 0.08), p.z - 0.04), -p.z + 0.05));
        /*/
        float breakDisc = cyl - 0.15;
        breakDisc = -min(-breakDisc, cyl - 0.08);
        breakDisc = -min(-breakDisc, -p.z + 0.05);
        breakDisc = -min(-breakDisc, p.z - 0.04);
        wheel = min(wheel, breakDisc);
        /**/
        wheel = min(wheel, Ellipsoid(p, innerPart));
    }
    return vec2(wheel, MOTO_WHEEL_ID);
}

vec2 motoShape(vec3 p)
{
    p = worldToMoto(p, true);

    float boundingSphere = length(p);
    if (boundingSphere > 2.0)
        return vec2(boundingSphere - 1.5, MOTO_ID);

    vec2 d = vec2(1e6, MOTO_ID);

#ifdef DEBUG
    // Show moto coordinates:
    d = MinDist(d, vec2(Box3(p, vec3(1.00, 0.01, 0.01), 0.001), DEBUG_ID));
    d = MinDist(d, vec2(Box3(p, vec3(0.01, 1.00, 0.01), 0.001), DEBUG_ID));
    d = MinDist(d, vec2(Box3(p, vec3(0.01, 0.01, 1.00), 0.001), DEBUG_ID));
#endif

    float h;
    float cyl;

    float frontWheelTireRadius = 0.14/2.0;
    float frontWheelRadius = 0.33 - frontWheelTireRadius;
    float rearWheelTireRadius = 0.3/2.0;
    float rearWheelRadius = 0.32 - rearWheelTireRadius;
    vec3 frontWheelPos = vec3(0.9, frontWheelRadius + frontWheelTireRadius, 0.0);

    // Front wheel
    if (true)
    {
        d = MinDist(d, wheelShape(p - frontWheelPos, frontWheelRadius, frontWheelTireRadius, 0.22, vec3(0.02, 0.02, 0.12)));
    }

    // Rear wheel and its break light
    if (true)
    {
        d = MinDist(d, wheelShape(p - vec3(-0.85, rearWheelRadius + rearWheelTireRadius, 0.0), rearWheelRadius, rearWheelTireRadius, 0.18, vec3(0.2, 0.2, 0.01)));
    
        // Break light
        if (true)
        {
            vec3 pBreak = p - breakLightOffsetFromMotoRoot;
            float breakBlock = Box3(pBreak, vec3(0.02, 0.025, 0.1), 0.02);
            d = MinDist(d, vec2(breakBlock, MOTO_BREAK_LIGHT_ID));
        }
    }

    // Front wheel fork
    if (true)
    {
        float forkThickness = 0.025;
        vec3 pFork = p;
        vec3 pForkTop = vec3(-0.48, 0.66, 0.0);
        vec3 pForkAngle = pForkTop + vec3(-0.14, 0.04, 0.05);
        pFork.z = abs(pFork.z);
        pFork -= frontWheelPos + vec3(0.0, 0.0, frontWheelTireRadius + 2. * forkThickness);
        float fork = Segment3(pFork, pForkTop, vec3(0.0), h) - forkThickness;

        // Join between the fork and the handle
        fork = min(fork, Segment3(pFork, pForkTop, pForkAngle, h) - forkThickness * 0.7);

        // Handle
        float handle = Segment3(pFork, pForkAngle, pForkAngle + vec3(-0.08, -0.07, 0.3), h);
        fork = min(fork, handle - mix(0.035, 0.02, smoothstep(0.25, 0.4, h)));

        // Mirror
        vec3 pMirror = pFork - pForkAngle - vec3(0.0, 0.1, 0.15);
        pMirror.xz *= Rotation(0.2);
        pMirror.xy *= Rotation(-0.2);
        
        float mirror = pMirror.x - 0.02;
        pMirror.xz *= Rotation(0.25);

        mirror = -min(mirror, -Ellipsoid(pMirror, vec3(0.04, 0.05, 0.08)));
        pMirror.x-=.05;
        pMirror.yz *= Rotation(1);
        mirror = min(mirror,max(length(pMirror.xz)-.003,max(pMirror.y,-pMirror.y-.15)));
        fork = min(fork, mirror);

        d = MinDist(d, vec2(fork, MOTO_ID));
    }

    // Head light and junction to the body
    if (true)
    {
        vec3 pHead = p - headLightOffsetFromMotoRoot;
        float headBlock = Ellipsoid(pHead, vec3(0.15, 0.2, 0.15));
        
        if (headBlock < 0.2)
        {
            vec3 pHeadTopBottom = pHead;

            // Top and bottom cuts
            pHeadTopBottom.xy *= Rotation(-0.15);
            headBlock = -min(-headBlock, -Ellipsoid(pHeadTopBottom - vec3(-0.2, -0.05, 0.0), vec3(0.35, 0.16, 0.25)));

            // Left and right cuts
            headBlock = -min(-headBlock, -Ellipsoid(pHead - vec3(-0.2, -0.08, 0.0), vec3(0.35, 0.25, 0.13)));

            // Front cut
            headBlock = -min(-headBlock, -Ellipsoid(pHead - vec3(-0.1, -0.05, 0.0), vec3(0.2, 0.2, 0.3)));

            // Dashboard
            pHead.xy *= Rotation(-0.4);
            headBlock = -min(-headBlock, -Ellipsoid(pHead - vec3(0.1, 0.0, 0.0), vec3(0.2, 0.3, 0.4)));
        }

        d = MinDist(d, vec2(headBlock, MOTO_HEAD_LIGHT_ID));

        float joint = Box3(p - vec3(0.4, 0.82, 0.0), vec3(0.04, 0.1, 0.08), 0.02);
        d = MinDist(d, vec2(joint, MOTO_MOTOR_ID));
    }

    // Fuel tank
    if (true)
    {
        vec3 pTank = p - vec3(0.1, 0.74, 0.0);
        vec3 pTankR = pTank;
        pTankR.xy *= Rotation(0.45);
        pTankR.x += 0.05;
        float tank = Ellipsoid(pTankR, vec3(0.35, 0.2, 0.42));

        if (tank < 0.1)
        {
            // Sides cut
            float tankCut = Ellipsoid(pTankR + vec3(0.0, 0.13, 0.0), vec3(0.5, 0.35, 0.22));
            tank = -min(-tank, -tankCut);
            //tank = -smin(-tank, -tankCut, 0.025);

            // Bottom cut
            float tankCut2 = Ellipsoid(pTank - vec3(0.0, 0.3, 0.0), vec3(0.6, 0.35, 0.4));
            tank = -min(-tank, -tankCut2);
            //tank = -smin(-tank, -tankCut2, 0.01);
        }
        d = MinDist(d, vec2(tank, MOTO_ID));
    }

    // Motor
    if (true)
    {
        vec3 pMotor = p - vec3(-0.08, 0.44, 0.0);
        
        // Main block
        vec3 pMotorSkewd = pMotor;
        pMotorSkewd.x *= 1. - pMotorSkewd.y * 0.4;
        pMotorSkewd.x += pMotorSkewd.y * 0.1;
        float motorBlock = Box3(pMotorSkewd, vec3(0.44, 0.29, 0.11), 0.02);
        
        if (motorBlock < 0.5)
        {
            // Pistons
            vec3 pMotor1 = pMotor - vec3(0.27, 0.12, 0.0);
            vec3 pMotor2 = pMotor - vec3(0.00, 0.12, 0.0);
            pMotor1.xy *= Rotation(-0.35);
            pMotor2.xy *= Rotation(0.35);
            motorBlock = min(motorBlock, Box3(pMotor1, vec3(0.1, 0.12, 0.20), 0.04));
            motorBlock = min(motorBlock, Box3(pMotor2, vec3(0.1, 0.12, 0.20), 0.04));

            // Gear box on the side
            vec3 pGearBox = pMotor - vec3(-0.15, -0.12, -0.125);
            pGearBox.xy *= Rotation(-0.15);
            float gearBox = Segment3(pGearBox, vec3(0.2, 0.0, 0.0), vec3(-0.15, 0.0, 0.0), h);
            gearBox -= mix(0.08, 0.15, h);
            
            pGearBox.x += 0.13;
            float gearBoxCut = -pGearBox.z - 0.05;
            gearBoxCut = min(gearBoxCut, Box3(pGearBox, vec3(0.16, 0.08, 0.1), 0.04));
            gearBox = -min(-gearBox, -gearBoxCut);

            motorBlock = min(motorBlock, gearBox);

            // Pedals
            vec3 pPedals = pMotor - vec3(0.24, -0.13, 0.0);
            float pedals = Segment3(pPedals, vec3(0.0, 0.0, .4), vec3(0.0, 0.0, -.4), h) - 0.02;
            motorBlock = min(motorBlock, pedals);
        }
        d = MinDist(d, vec2(motorBlock, MOTO_MOTOR_ID));
    }

    // Exhaust pipes
    if (true)
    {
        vec3 pExhaust = p;
        pExhaust -= vec3(0.0, 0.0, rearWheelTireRadius + 0.05);
        float exhaust = Segment3(pExhaust, vec3(0.24, 0.25, 0.0), vec3(-0.7, 0.3, 0.05), h);

        if (exhaust < 0.6)
        {
            exhaust -= mix(0.04, 0.08, mix(h, smoothstep(0.5, 0.7, h), 0.5));
            exhaust = -min(-exhaust, p.x - 0.7 * p.y + 0.9);
            exhaust = min(exhaust, Segment3(pExhaust, vec3(0.24, 0.25, 0.0), vec3(0.32, 0.55, -0.02), h) - 0.04);
            exhaust = min(exhaust, Segment3(pExhaust, vec3(0.22, 0.32, -0.02), vec3(-0.4, 0.37, 0.02), h) - 0.04);
        }
        d = MinDist(d, vec2(exhaust, MOTO_ID));
    }

    // Seat
    if (true)
    {
        vec3 pSeat = p - vec3(-0.44, 0.44, 0.0);
        float seat = Ellipsoid(pSeat, vec3(0.8, 0.4, 0.2));
        float seatRearCut = length(p + vec3(1.05, -0.1, 0.0)) - 0.7;
        seat = max(seat, -seatRearCut);

        if (seat < 0.2)
        {
            vec3 pSaddle = pSeat - vec3(0.35, 0.57, 0.0);
            pSaddle.xy *= Rotation(0.4);
            float seatSaddleCut = Ellipsoid(pSaddle, vec3(0.5, 0.15, 0.6));
            seat = -min(-seat, seatSaddleCut);
            seat = -smin(-seat, seatSaddleCut, 0.02);

            vec3 pSeatBottom = pSeat + vec3(0.0, -0.55, 0.0);
            pSeatBottom.xy *= Rotation(0.5);
            float seatBottomCut = Ellipsoid(pSeatBottom, vec3(0.8, 0.4, 0.4));
            seat = -min(-seat, -seatBottomCut);
        }
        d = MinDist(d, vec2(seat, MOTO_ID));
    }

    return d;
}
