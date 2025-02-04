// Rendering code from The Sheep and the Flower

const vec3 skyColor = vec3(0.5, 0.7, 1.);
float sceneSDF_t = 0.;

float fastAO( in vec3 pos, in vec3 nor, float maxDist, float falloff ) {
    float occ1 = .5*maxDist - sceneSDF(pos + nor*maxDist *.5, sceneSDF_t).x;
    float occ2 = .95*(maxDist - sceneSDF(pos + nor*maxDist, sceneSDF_t).x);
    return clamp(1. - falloff*1.5*(occ1 + occ2), 0., 1.);
}

float shadow( vec3 ro, vec3 rd)
{
    float res = 1.0;
    float t = 0.08;
    for( int i=0; i<64; i++ )
    {
        float h = sceneSDF( ro + rd*t, sceneSDF_t ).x;
        res = min( res, 30.0*h/t );
        t += h;
        
        if( res<0.0001 || t>50. ) break;
        
    }
    return clamp( res, 0.0, 1.0 );
}


float trace(vec3 ro, vec3 rd) {
    float t = 0.01;
    for(int i=0; i<128; i++) {
        float d = sceneSDF(ro+rd*t, sceneSDF_t).x;
        t += d;
        if (t > 100. || abs(d) < 0.001) break;
    }
    
    return t;
}

// Specular light effect for the eyes envmap.
float specular(vec3 v, vec3 l, float size)
{
    float spe = max(dot(v, normalize(l + v)), 0.);
    float a = 2000./size;
    float b = 3./size;
    return (pow(spe, a)*(a+2.) + pow(spe, b)*(b+2.)*2.)*0.008;
}

vec3 rayMarchSceneAnat(vec3 ro, vec3 rd, float tMax, int max_steps, out vec3 p
#ifdef ENABLE_STEP_COUNT
, out int steps
#endif
)
{
    // Trace : intersection point + normal
    float t = trace(ro,rd);
    p = ro + rd * t;
    vec2 dmat = sceneSDF(p, t);
    vec2 eps = vec2(0.0001,0.0);
    vec3 n = normalize(vec3(dmat.x - sceneSDF(p - eps.xyy, t).x, dmat.x - sceneSDF(p - eps.yxy, t).x, dmat.x - sceneSDF(p - eps.yyx, t).x));

    // ----------------------------------------------------------------
    // Shade
    // ----------------------------------------------------------------
    vec3 sunDir = normalize(vec3(3.5,3.,-1.));
    
    float ao = fastAO(p, n, .15, 1.) * fastAO(p, n, 1., .1)*.5;
    
    float shad = shadow(p, sunDir);
    float fre = 1.0+dot(rd,n);
    
    vec3 diff = vec3(1.,.8,.7) * max(dot(n,sunDir), 0.) * pow(vec3(shad), vec3(1.,1.2,1.5));
    vec3 bnc = vec3(1.,.8,.7)*.1 * max(dot(n,-sunDir), 0.) * ao;
    vec3 sss = vec3(.5) * mix(fastAO(p, rd, .3, .75), fastAO(p, sunDir, .3, .75), 0.5);
    vec3 spe = vec3(1.) * max(dot(reflect(rd,n), sunDir),0.);
    vec3 envm = vec3(0.);
    
    //sss = vec3(1.) * calcSSS(p,rd);
    vec3 amb = vec3(.4,.45,.5)*1. * ao;
    vec3 emi = vec3(0.);
    
    vec3 albedo = vec3(0.);
    if(dmat.y == GROUND_ID) {
        albedo = vec3(0.1, 0.4, 0.1);
        sss *= 0.;
        spe *= 0.1;

        vec4 splineUV = ToSplineLocalSpace(p.xz, roadWidthInMeters.z);
        float isRoad = 1.0 - smoothstep(roadWidthInMeters.x, roadWidthInMeters.y, abs(splineUV.x));
        vec3 grassColor = vec3(0.22, 0.21, 0.04);
        if (isRoad > 0.99)
        {
            albedo = vec3(0.5);
        }


    } else if (IsMoto(int(dmat.y))) {
        albedo = 0.3*vec3(.85,.95,1.);
        sss *= 0.;
        spe = pow(spe, vec3(8.))*fre*2.;
    } else if (dmat.y == TREE_ID) {
        albedo = vec3(.35,.75,0.2);
        sss *= 0.;
        spe = pow(spe, vec3(8.))*fre*2.;
    } else if (dmat.y == COTON) {
        albedo = vec3(.4);
        sss *= fre*.5+.5;
        emi = vec3(.35);
        spe = pow(spe, vec3(4.))*fre*.25;
    } else if (dmat.y == CLOGS) {
        albedo = vec3(.025);
        sss *= 0.;
        spe = pow(spe, vec3(80.))*fre*10.;
    } else if (dmat.y == EYE) {
        sss *= .5;
        vec3 dir = normalize(eyeDir + (noise(vec3(iTime,iTime*.5,iTime*1.5))*2.-1.)*.01);
        
        // compute eye space -> mat3(eyeDir, t, b)
        vec3 t = cross(dir, vec3(0.,1.,0.));
        vec3 b = cross(dir,t);
        t = cross(b, dir);
        
        vec3 ne = n.z * dir + n.x * t + n.y * b;
        
        // parallax mapping
        vec3 v = rd.z * eyeDir + rd.x * t + rd.y * b;
        vec2 offset = v.xy / v.z * length(ne.xy) / length(ro-p) * .4;
        ne.xy -= offset * smoothstep(0.01,.0, dot(ne,rd));
        
        const float i_irisSize = .3;
        float pupilSize = .2 + eyesSurprise*.5;
        
        // polar coordinate
        float er = length(ne.xy);
        float theta = atan(ne.x, ne.y);
        
        // iris
        vec3 c = mix(vec3(.5,.3,.1) , vec3(.0,.8,1), smoothstep(0.16,i_irisSize,er)*.3+cos(theta*15.)*.04);
        float filaments = smoothstep(-.9,1.,noise(vec3(er*10.,theta*30.+cos(er*50.+noise(vec3(theta))*50.)*1.,0.)))
            + smoothstep(-.9,1.,noise(vec3(er*10.,theta*40.+cos(er*30.+noise(vec3(theta))*50.)*2.,0.)));
        float pupil = smoothstep(pupilSize,pupilSize+0.02, er);
        albedo = c * (filaments*.5+.5) * (smoothstep(i_irisSize,i_irisSize-.01, er)); // brown to green
        albedo *= vec3(1.,.8,.7) * pow(max(0.,dot(normalize(vec3(3.,1.,-1.)), ne)),8.)*300.+.5; // retro reflection
        albedo *= pupil; // pupil
        albedo += pow(spe,vec3(800.))*3; // specular light
        albedo = mix(albedo, vec3(.8), smoothstep(i_irisSize-0.01,i_irisSize, er)); // white eye
        albedo = mix(c*.3, albedo, smoothstep(0.0,0.05, abs(er-i_irisSize-0.0)+0.01)); // black edge
        
        // fake envmap reflection
        n = mix(normalize(n + (eyeDir + n)*4.), n, smoothstep(i_irisSize,i_irisSize+0.02, er));
        {
            vec3 v = reflect(rd, n);
            vec3 l1 = normalize(vec3(1., 1.5, -1.));
            vec3 l2 = vec3(-l1.x, l1.y*.5, l1.z);
            float spot =
                + specular(v, l1, .1)
                + specular(v, l2, 2.) * .1
                + specular(v, normalize(l1 + vec3(0.2, 0., 0.)), .3)
                + specular(v, normalize(l1 + vec3(0.2, 0., 0.2)), .5)
                + specular(v, normalize(l2 + vec3(0.1, 0., 0.2)), 8.) * .5;
    
            envm = (mix(
                mix(vec3(.3,.3,0.), vec3(.1), smoothstep(-.7, .2, v.y)),
                vec3(0.3, 0.65, 1.), smoothstep(-.0, 1., v.y)) + spot * vec3(1., 0.9, .8)) * mix(.15, .2, pupil) *sqrt(fre)*2.5;
        }
        
        // shadow on the edges of the eyes
        sceneSDF(p, sceneSDF_t);
        albedo *= smoothstep(0.,0.015, headDist)*.4+.6;
        spe *= 0.;
    } else if(dmat.y == METAL) {
        albedo = vec3(.85,.95,1.);
        sss *= 0.;
        spe = pow(spe, vec3(8.))*fre*2.;
    } else if(dmat.y == BLACK_METAL) {
        albedo = vec3(1.);
        diff *= vec3(.1)*fre;
        amb *= vec3(.1)*fre;
        bnc *= 0.;
        sss *= 0.;
        spe = pow(spe, vec3(100.))*fre*2.;
    }  else if(dmat.y == BLOOD) {
        albedo = vec3(1.,.01,.01)*.3;
        diff *= vec3(3.);
        amb *= vec3(2.)*fre*fre;
        sss *= 0.;
        spe = vec3(1.,.3,.3) * pow(spe, vec3(500.))*5.;
    } 
    else if (dmat.y == SKIN) {
        albedo = vec3(1.,.7,.5)*1.;
        amb *= vec3(1.,.75,.75);
        sss = pow(sss, vec3(.5,2.5,5.0)+2.)*2.;// * fre;// * pow(fre, 1.);
        spe = pow(spe, vec3(4.))*fre*.02;
    }
    
    // fog
    vec3 col = clamp(mix((albedo * (amb*1. + diff*.5 + bnc*2. + sss*2. ) + envm + spe*shad + emi), skyColor, smoothstep(60.,100.,t)), 0., 1.);
    
    // vignetting
    // fragColor = vec4(col / (1.+pow(length(uv*2.-1.),4.)*.04),1.);
    return col;
}
