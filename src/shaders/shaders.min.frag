#version 150

vec2 iResolution=vec2(1280,720);
uniform float iTime;
uniform sampler2D tex;
float camFoV,camMotoSpace,camProjectionRatio,camShowDriver;
vec3 camPos,camTa,sheepPos=vec3(0);
float wheelie=0.;
bool driverIsSleeping=false,sheepOnMoto=false;
const vec3 roadWidthInMeters=vec3(4,8,8);
out vec4 fragColor;
float PIXEL_ANGLE,time;
const float PI=acos(-1.);
float hash11(float x)
{
  return fract(sin(x)*43758.5453);
}
float hash21(vec2 xy)
{
  return fract(sin(dot(xy,vec2(12.9898,78.233)))*43758.5453);
}
float hash31(vec3 xyz)
{
  return hash21(vec2(hash21(xyz.xy),xyz.z));
}
vec2 hash12(float x)
{
  x=hash11(x);
  return vec2(x,hash11(x));
}
float valueNoise(vec2 p)
{
  vec2 p00=floor(p);
  p-=p00;
  p=p*p*(3.-2.*p);
  return mix(mix(hash21(p00),hash21(p00+vec2(1,0)),p.x),mix(hash21(p00+vec2(0,1)),hash21(p00+vec2(1)),p.x),p.y);
}
float noise(vec3 x)
{
  vec3 i=floor(x);
  x=fract(x);
  x=x*x*x*(x*(x*6.-15.)+10.);
  return mix(mix(mix(hash31(i+vec3(0)),hash31(i+vec3(1,0,0)),x.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),x.x),x.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),x.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1)),x.x),x.y),x.z)*2.-1.;
}
vec2 valueNoise2(float p)
{
  float p0=floor(p);
  p-=p0;
  p=p*p*(3.-2.*p);
  return mix(hash12(p0),hash12(p0+1.),p);
}
float fBm(vec2 p,int iterations,float weight_param,float frequency_param)
{
  float v=0.,weight=1.,frequency=1.,offset=0.;
  for(int i=0;i<iterations;++i)
    {
      float noise=valueNoise(p*frequency+offset)*2.-1.;
      v+=weight*noise;
      weight*=clamp(weight_param,0.,1.);
      frequency*=1.+2.*clamp(frequency_param,0.,1.);
      offset+=1.;
    }
  return v;
}
float smin(float d1,float d2,float k)
{
  float h=clamp(.5+.5*(d2-d1)/k,0.,1.);
  return mix(d2,d1,h)-k*h*(1.-h);
}
float capsule(vec3 p,vec3 a)
{
  p-=a;
  a=vec3(0,2,4.9)-a;
  return length(p-a*clamp(dot(p,a)/dot(a,a),0.,1.))-.2;
}
float cappedCone(vec3 p,float h,float r1,float r2)
{
  vec2 q=vec2(length(p.xz),p.y),k1=vec2(r2,h),k2=vec2(r2-r1,2.*h),ca=vec2(q.x-min(q.x,q.y<0.?
    r1:
    r2),abs(q.y)-h);
  q=q-k1+k2*clamp(dot(k1-q,k2)/dot(k2,k2),0.,1.);
  return(q.x<0.&&ca.y<0.?
    -1.:
    1.)*sqrt(min(dot(ca,ca),dot(q,q)));
}
float smax(float a,float b,float k)
{
  k*=1.4;
  float h=max(k-abs(a-b),0.);
  return max(a,b)+h*h*h/(6.*k*k);
}
float Box3(vec3 p,vec3 size,float corner)
{
  p=abs(p)-size+corner;
  return length(max(p,0.))+min(max(max(p.x,p.y),p.z),0.)-corner;
}
float Ellipsoid(vec3 p,vec3 r)
{
  float k0=length(p/r);
  return k0*(k0-1.)/length(p/(r*r));
}
float Segment3(vec3 p,vec3 a,vec3 b,out float h)
{
  p-=a;
  a=b-a;
  h=clamp(dot(p,a)/dot(a,a),0.,1.);
  return length(p-a*h);
}
float Capsule(vec3 p,float h,float r)
{
  p.y+=clamp(-p.y,0.,h);
  return length(p)-r;
}
float Torus(vec3 p,vec2 t)
{
  return length(vec2(length(p.xz)-t.x,p.y))-t.y;
}
mat2 Rotation(float angle)
{
  float c=cos(angle);
  angle=sin(angle);
  return mat2(c,angle,-angle,c);
}
vec2 MinDist(vec2 d1,vec2 d2)
{
  return d1.x<d2.x?
    d1:
    d2;
}
void setupCamera(vec2 uv,vec3 cameraPosition,vec3 cameraTarget,out vec3 ro,out vec3 rd)
{
  vec3 cameraUp=vec3(0,1,0);
  cameraTarget=normalize(cameraTarget-cameraPosition);
  if(abs(dot(cameraTarget,cameraUp))>.99)
    cameraUp=vec3(1,0,0);
  vec3 cameraRight=normalize(cross(cameraTarget,cameraUp));
  cameraUp=normalize(cross(cameraRight,cameraTarget));
  uv*=mix(1.,length(uv),.1);
  ro=cameraPosition;
  rd=normalize(cameraTarget*camProjectionRatio+uv.x*cameraRight+uv.y*cameraUp);
}
float distanceToSegment(vec2 p)
{
  vec2 B=roadP2,A=roadP1,AB=B-A;
  return length(p-mix(A,B,clamp(dot(p-A,AB)/dot(AB,AB),0.,1.)));
}
float tOnSegment(vec2 p)
{
  vec2 A=roadP1,AB=roadP2-A;
  return clamp(dot(p-A,AB)/dot(AB,AB),0.,1.);
}
const vec2 roadP1=vec2(-1)*2e2,roadP2=vec2(1)*2e2;
vec4 ToSplineLocalSpace(vec2 p,float splineWidth)
{
  return vec4(distanceToSegment(p),0,tOnSegment(p),1);
}
vec2 GetPositionOnSpline(vec2 spline_t_and_index,out vec3 directionAndCurvature)
{
  directionAndCurvature=normalize(vec3(-1,-1,0));
  return mix(roadP2,roadP1,spline_t_and_index.x);
}
vec2 blood(vec3 p)
{
  p-=vec3(1,1.2,0);
  float d=p.y+smoothstep(1.5,8.,length(p.xz))+1.;
  return d<.4?
    d-=pow((noise(p*.9)*.5+noise(p*1.6)*.3+noise(p*2.7)*.1)*.5+.5,3.)*.45,vec2(d,22):
    vec2(d,10);
}
float roadBumpHeight(float d)
{
  d=clamp(abs(d/roadWidthInMeters.x),0.,1.);
  return.2*(1.-d*d*d);
}
vec4 getRoadPositionDirectionAndCurvature(float t,out vec3 position)
{
  vec4 directionAndCurvature;
  position.xz=GetPositionOnSpline(vec2(t),directionAndCurvature.xzw);
  position.y=0.;
  directionAndCurvature.y=0.;
  directionAndCurvature.xyz=normalize(directionAndCurvature.xyz);
  return directionAndCurvature;
}
vec2 terrainShape(vec3 p,vec4 splineUV)
{
  float height=0.;
  if(1.-smoothstep(roadWidthInMeters.x,roadWidthInMeters.y,abs(splineUV.x))>0.)
    {
      vec3 directionAndCurvature;
      vec2 positionOnSpline=GetPositionOnSpline(splineUV.yw,directionAndCurvature);
      height+=roadBumpHeight(splineUV.x)+pow(valueNoise(mod(p.xz*40,100)),.01)*.1;
    }
  return vec2(p.y-height,10);
}
float tree(vec3 globalP,vec3 localP,vec2 id,vec4 splineUV,float current_t)
{
  float h1=hash21(id),h2=hash11(h1);
  if(globalP.y+1.-20.>0.)
    return 1e6;
  float d=3.5;
  if(h1>=1.)
    return d;
  if(abs(splineUV.x)<roadWidthInMeters.x)
    return d;
  float treeClearance=roadWidthInMeters.y+5.;
  if(abs(ToSplineLocalSpace(id,treeClearance).x)<treeClearance)
    return d;
  treeClearance=mix(5.,20.,1.-h1*h1);
  float treeWidth=treeClearance*mix(.3,.5,h2*h2);
  localP.y-=-1.+.5*treeClearance;
  localP.xz+=(vec2(h1,h2)-.5)*1.5;
  d=min(d,Ellipsoid(localP,.5*vec3(treeWidth,treeClearance,treeWidth)));
  if(1.-smoothstep(50.,2e2,current_t)>0.)
    {
      vec2 pNoise=vec2(2.*atan(localP.z,localP.x),localP.y)+id;
      d+=.2*fBm(2.*pNoise,2,.7,.5)+1.;
    }
  return d;
}
vec2 treesShape(vec3 p,vec4 splineUV,float current_t)
{
  vec2 id=round(p.xz/10.)*10.;
  vec3 localP=p;
  localP.xz-=id;
  return vec2(tree(p,localP,id,splineUV,current_t),9);
}
vec3 motoPos,headLightOffsetFromMotoRoot=vec3(.53,.98,0),breakLightOffsetFromMotoRoot=vec3(-1,.75,0);
float motoYaw,motoPitch,motoRoll,motoDistanceOnCurve;
void computeMotoPosition()
{
  vec4 motoDirAndTurn=getRoadPositionDirectionAndCurvature(motoDistanceOnCurve,motoPos);
  float rightOffset=2.+.5*sin(time);
  motoPos.xz+=vec2(-motoDirAndTurn.z,motoDirAndTurn)*rightOffset;
  motoPos.y+=roadBumpHeight(abs(rightOffset))+.1;
  motoYaw=atan(motoDirAndTurn.z,motoDirAndTurn.x);
  motoPitch=atan(motoDirAndTurn.y,length(motoDirAndTurn.zx));
  if(wheelie>0.)
    motoPitch+=mix(0.,.5,wheelie),motoPos.y+=mix(0.,.35,wheelie);
  motoRoll=20.*motoDirAndTurn.w;
}
vec3 motoToWorld(vec3 v,bool isPos)
{
  v.xy*=Rotation(-motoPitch);
  v.yz*=Rotation(-motoRoll);
  v.xz*=Rotation(-motoYaw);
  if(isPos)
    v+=motoPos;
  return v;
}
vec3 worldToMoto(vec3 v)
{
  v-=motoPos;
  v.xz*=Rotation(motoYaw);
  v.yz*=Rotation(motoRoll);
  v.xy*=Rotation(motoPitch);
  return v;
}
vec2 driverShape(vec3 p)
{
  if(driverIsSleeping)
    p-=vec3(.4,.5,-2.5),p.yz*=Rotation(1.2);
  else
     p=worldToMoto(p)-vec3(-.35,.78,0);
  float d=length(p);
  if(d>1.2||camShowDriver<.5)
    return vec2(d,6);
  vec3 simP=p;
  simP.z=abs(simP.z);
  float wind=fBm((p.xy+time)*12.,1,.5,.5);
  if(d<.8)
    {
      vec3 pBody=p;
      pBody.z=max(abs(pBody.z)-.02,0);
      pBody.xy*=Rotation(3.1);
      pBody.yz*=Rotation(-.1);
      d=smin(d,Capsule(pBody,.12,.12),.1);
      pBody.y+=.2;
      pBody.xy*=Rotation(-.6);
      d=smin(d,Capsule(pBody,.12,.11),.02);
      pBody.y+=.2;
      pBody.xy*=Rotation(-.3);
      pBody.yz*=Rotation(-.2);
      d=smin(d,Capsule(pBody,.12,.12),.02);
      pBody.y+=.1;
      pBody.yz*=Rotation(1.7);
      d=smin(d,Capsule(pBody,.12,.1),.015);
      pBody=p;
      pBody.y-=.48;
      pBody.x-=.25;
      pBody.xy*=Rotation(-.7);
      d=min(d,length(vec2(max(abs(pBody.y)-.07,0),abs(length(pBody.xz)-.05)))-.04);
    }
  d+=.005*wind;
  {
    vec3 pArm=simP-vec3(.23,.45,.18);
    pArm.yz*=Rotation(-.6);
    pArm.xy*=Rotation(.2);
    float arms=Capsule(pArm,.29,.06);
    d=smin(d,arms,.005);
    pArm.y+=.32;
    pArm.xy*=Rotation(1.5);
    arms=Capsule(pArm,.28,.04);
    d=smin(d,arms,.005);
  }
  d+=.01*wind;
  {
    vec3 pLeg=simP-vec3(0,0,.13);
    if(!driverIsSleeping)
      pLeg.xy*=Rotation(1.55),pLeg.yz*=Rotation(-.45);
    float h2=Capsule(pLeg,.35,.09);
    d=smin(d,h2,.01);
    pLeg.y+=.4;
    pLeg.xy*=Rotation(-1.5);
    h2=Capsule(pLeg,.4,.06);
    d=smin(d,h2,.01);
    pLeg.y+=.45;
    pLeg.xy*=Rotation(1.75);
    pLeg.yz*=Rotation(.25);
    h2=Capsule(pLeg,.2,.04);
    d=smin(d,h2,.01);
  }
  d+=.002*wind;
  {
    vec3 pHead=p-vec3(.39,.6,0);
    float head=max(length(pHead*vec3(1,1,1.2+pHead.y))-.15,-pHead.y-.09-pHead.x);
    if(head<d)
      return vec2(head,7);
  }
  return vec2(d,6);
}
vec2 wheelShape(vec3 p,float wheelRadius,float tireRadius,float innerRadius,vec3 innerPart)
{
  wheelRadius=Torus(p.yzx,vec2(wheelRadius,tireRadius));
  if(wheelRadius<.25)
    {
      p.z=abs(p.z);
      float h;
      h=Segment3(p,vec3(0),vec3(0,0,1),h);
      wheelRadius=min(min(-smin(-wheelRadius,h-innerRadius,.01),-min(min(min(.15-h,h-.08),p.z-.04),-p.z+.05)),Ellipsoid(p,innerPart));
    }
  return vec2(wheelRadius,1);
}
vec2 motoShape(vec3 p)
{
  p=worldToMoto(p);
  float boundingSphere=length(p);
  if(boundingSphere>2.)
    return vec2(boundingSphere-1.5,0);
  vec2 d=vec2(1e6,0);
  vec3 frontWheelPos=vec3(.9,.33,0);
  d=MinDist(d,wheelShape(p-frontWheelPos,.26,.07,.22,vec3(.02,.02,.12)));
  d=MinDist(d,wheelShape(p-vec3(-.85,.32,0),.17,.15,.18,vec3(.2,.2,.01)));
  {
    vec3 pFork=p,pForkTop=vec3(-.48,.66,0),pForkAngle=pForkTop+vec3(-.14,.04,.05);
    pFork.z=abs(pFork.z);
    pFork-=frontWheelPos+vec3(0,0,.12);
    float fork=Segment3(pFork,pForkTop,vec3(0),boundingSphere)-.025;
    fork=min(fork,Segment3(pFork,pForkTop,pForkAngle,boundingSphere)-.0175);
    float handle=Segment3(pFork,pForkAngle,pForkAngle+vec3(-.08,-.07,.3),boundingSphere);
    fork=min(fork,handle-mix(.035,.02,smoothstep(.25,.4,boundingSphere)));
    pFork=pFork-pForkAngle-vec3(0,.1,.15);
    pFork.xz*=Rotation(.2);
    pFork.xy*=Rotation(-.2);
    handle=pFork.x-.02;
    pFork.xz*=Rotation(.25);
    handle=-min(handle,-Ellipsoid(pFork,vec3(.04,.05,.08)));
    pFork.x-=.05;
    pFork.yz*=Rotation(1);
    handle=min(handle,max(length(pFork.xz)-.003,max(pFork.y,-pFork.y-.15)));
    fork=min(fork,handle);
    d=MinDist(d,vec2(fork,0));
  }
  {
    vec3 pHead=p-headLightOffsetFromMotoRoot;
    float headBlock=Ellipsoid(pHead,vec3(.15,.2,.15));
    if(headBlock<.2)
      {
        vec3 pHeadTopBottom=pHead;
        pHeadTopBottom.xy*=Rotation(-.15);
        headBlock=-min(min(min(-headBlock,-Ellipsoid(pHeadTopBottom-vec3(-.2,-.05,0),vec3(.35,.16,.25))),-Ellipsoid(pHead-vec3(-.2,-.08,0),vec3(.35,.25,.13))),-Ellipsoid(pHead-vec3(-.1,-.05,0),vec3(.2,.2,.3)));
        pHead.xy*=Rotation(-.4);
        headBlock=-min(-headBlock,-Ellipsoid(pHead-vec3(.1,0,0),vec3(.2,.3,.4)));
      }
    d=MinDist(d,vec2(headBlock,5));
    headBlock=Box3(p-vec3(.4,.82,0),vec3(.04,.1,.08),.02);
    d=MinDist(d,vec2(headBlock,2));
  }
  {
    vec3 pTank=p-vec3(.1,.74,0),pTankR=pTank;
    pTankR.xy*=Rotation(.45);
    pTankR.x+=.05;
    float tank=Ellipsoid(pTankR,vec3(.35,.2,.42));
    if(tank<.1)
      {
        float tankCut=Ellipsoid(pTankR+vec3(0,.13,0),vec3(.5,.35,.22));
        tank=-min(min(-tank,-tankCut),-Ellipsoid(pTank-vec3(0,.3,0),vec3(.6,.35,.4)));
      }
    d=MinDist(d,vec2(tank,0));
  }
  {
    vec3 pMotor=p-vec3(-.08,.44,0),pMotorSkewd=pMotor;
    pMotorSkewd.x*=1.-pMotorSkewd.y*.4;
    pMotorSkewd.x+=pMotorSkewd.y*.1;
    float motorBlock=Box3(pMotorSkewd,vec3(.44,.29,.11),.02);
    if(motorBlock<.5)
      {
        vec3 pMotor1=pMotor-vec3(.27,.12,0),pMotor2=pMotor-vec3(0,.12,0);
        pMotor1.xy*=Rotation(-.35);
        pMotor2.xy*=Rotation(.35);
        motorBlock=min(min(motorBlock,Box3(pMotor1,vec3(.1,.12,.2),.04)),Box3(pMotor2,vec3(.1,.12,.2),.04));
        pMotor1=pMotor-vec3(-.15,-.12,-.125);
        pMotor1.xy*=Rotation(-.15);
        float gearBox=Segment3(pMotor1,vec3(.2,0,0),vec3(-.15,0,0),boundingSphere);
        gearBox-=mix(.08,.15,boundingSphere);
        pMotor1.x+=.13;
        float gearBoxCut=min(-pMotor1.z-.05,Box3(pMotor1,vec3(.16,.08,.1),.04));
        gearBox=-min(-gearBox,-gearBoxCut);
        motorBlock=min(motorBlock,gearBox);
        gearBoxCut=Segment3(pMotor-vec3(.24,-.13,0),vec3(0,0,.4),vec3(0,0,-.4),boundingSphere)-.02;
        motorBlock=min(motorBlock,gearBoxCut);
      }
    d=MinDist(d,vec2(motorBlock,2));
  }
  {
    vec3 pExhaust=p-vec3(0,0,.2);
    float exhaust=Segment3(pExhaust,vec3(.24,.25,0),vec3(-.7,.3,.05),boundingSphere);
    if(exhaust<.6)
      exhaust=-min(-exhaust+mix(.04,.08,mix(boundingSphere,smoothstep(.5,.7,boundingSphere),.5)),p.x-.7*p.y+.9),exhaust=min(exhaust,Segment3(pExhaust,vec3(.24,.25,0),vec3(.32,.55,-.02),boundingSphere)-.04),exhaust=min(exhaust,Segment3(pExhaust,vec3(.22,.32,-.02),vec3(-.4,.37,.02),boundingSphere)-.04);
    d=MinDist(d,vec2(exhaust,0));
  }
  {
    vec3 pSeat=p-vec3(-.44,.44,0);
    float seat=Ellipsoid(pSeat,vec3(.8,.4,.2)),seatRearCut=length(p+vec3(1.05,-.1,0))-.7;
    seat=max(seat,-seatRearCut);
    if(seat<.2)
      {
        vec3 pSaddle=pSeat-vec3(.35,.57,0);
        pSaddle.xy*=Rotation(.4);
        float seatSaddleCut=Ellipsoid(pSaddle,vec3(.5,.15,.6));
        seat=-smin(min(-seat,seatSaddleCut),seatSaddleCut,.02);
        pSaddle=pSeat+vec3(0,-.55,0);
        pSaddle.xy*=Rotation(.5);
        seatSaddleCut=Ellipsoid(pSaddle,vec3(.8,.4,.4));
        seat=-min(-seat,-seatSaddleCut);
      }
    d=MinDist(d,vec2(seat,0));
  }
  return d;
}
const vec3 eyeDir=vec3(1,0,1),animationSpeed=vec3(1),animationAmp=vec3(1,.2,.25);
const vec2 headRot=vec2(0);
float headDist=0.;
vec2 sheep(vec3 p)
{
  p=p-motoPos-vec3(-.25,1.2,-.3);
  p.xz*=Rotation(-.7);
  p.yz*=Rotation(.5);
  if(wheelie>0.)
    p.yz*=Rotation(wheelie*.4),p.y-=mix(0.,.35,wheelie),p.z-=mix(0.,.2,wheelie);
  p/=.15;
  float tb=iTime*animationSpeed.x;
  vec3 bodyMove=vec3(cos(tb*PI),cos(tb*PI*2.)*.1,0)*.025*animationAmp.x;
  tb=length(p*vec3(1,1,.825)-vec3(0,1.5,2.55)-bodyMove)-2.;
  if(tb<3.)
    {
      float n=pow(noise((p-bodyMove+vec3(.05,0,.5))*2.)*.5+.5,.75)*2.-1.;
      tb=tb+.05-n*.2;
      n=mod(iTime*animationSpeed.x,2.);
      float a=smoothstep(0.,.5,n),b=smoothstep(.5,1.,n),c=smoothstep(1.,1.5,n),d=smoothstep(1.5,2.,n);
      vec4 legsRot=vec4(b*(1.-b),d*(1.-d),a*(1.-a),c*(1.-c)),legsPos=(n*.5-vec4(b,d,a,c))*animationAmp.x;
      vec3 pl=p;
      pl.x-=.8;
      pl.z-=2.+legsPos.x;
      pl.yz=Rotation(legsRot.x)*pl.yz;
      a=cappedCone(pl-vec3(0),.7,.3,.2);
      b=cappedCone(pl-vec3(0,-.8,0),.2,.35,.3);
      pl=p;
      pl.x+=1.;
      pl.z-=2.+legsPos.y;
      pl.yz=Rotation(legsRot.y)*pl.yz;
      a=min(a,cappedCone(pl-vec3(0),.7,.3,.2));
      b=min(b,cappedCone(pl-vec3(0,-.8,0),.2,.35,.3));
      pl=p;
      pl.x-=1.;
      pl.z-=4.+legsPos.z;
      pl.yz=Rotation(legsRot.z)*pl.yz;
      a=min(a,cappedCone(pl-vec3(0),.7,.3,.2));
      b=min(b,cappedCone(pl-vec3(0,-.8,0),.2,.35,.3));
      pl=p;
      pl.x+=1.;
      pl.z-=4.+legsPos.w;
      pl.yz=Rotation(legsRot.w)*pl.yz;
      a=min(a,cappedCone(pl-vec3(0),.7,.3,.2));
      b=min(b,cappedCone(pl-vec3(0,-.8,0),.2,.35,.3));
      pl=p+vec3(0,-2,-1.2);
      pl.xz=Rotation((smoothstep(0.,1.,abs(mod(iTime,1.)*2.-1.))*animationSpeed.y-.5)*.25*animationAmp.y+headRot.x)*pl.xz;
      pl.zy=Rotation(sin(iTime*animationSpeed.y)*.25*animationAmp.y-headRot.y)*pl.zy;
      c=smin(length(pl-vec3(0,-1.3,-1.2))-1.,length(pl-vec3(0))-.5,1.8);
      vec3 pp;
      d=smin(length(pl-vec3(0,.35,-.1))-.55-(cos(pl.z*8.+pl.y*4.5+pl.x*4.)+cos(pl.z*4.+pl.y*6.5+pl.x*8.))*.05,tb,.1);
      pp=pl;
      pp.yz=Rotation(-.6)*pp.yz;
      pp.x=abs(p.x)-.8;
      pp*=vec3(.3,1,.4);
      pp-=vec3(0,-.05-pow(pp.x,2.)*5.,-.1);
      n=smax(length(pp)-.15,-length(pp-vec3(0,-.1,0))+.12,.01);
      pp.y*=.3;
      pp.y-=-.11;
      float earsClip=length(pp)-.16;
      pp=pl;
      pp.x=abs(pl.x)-.4;
      float eyes=length(pp*vec3(1,1,.8)-vec3(0,0,-1))-.3,eyeCap=smin(smax(abs(eyes)-.01,smin(-abs(pl.y+pl.z*.025)+.25-smoothstep(.95,.96,0.)*.3+cos(iTime)*.02,-pl.z-.64,.2),.01),c,.02);
      c=min(c,eyeCap);
      pp.x=abs(pl.x)-.2;
      pp.xz=Rotation(-.45)*pp.xz;
      c=smin(smax(c,-length(pp-vec3(-.7,-1.2,-2.05))+.14,.1),Torus(pp-vec3(-.7,-1.2,-1.94),vec2(.14,.05)),.05);
      eyeCap=smin(tb,capsule(p-vec3(0,-.1,cos(p.y-.7)*.5),vec3(cos(iTime*animationSpeed.z)*animationAmp.z,.2,5))-(cos(p.z*8.+p.y*4.5+p.x*4.)+cos(p.z*4.+p.y*6.5+p.x*3.))*.02,.1);
      vec2 dmat=MinDist(MinDist(vec2(tb,16),vec2(eyeCap,16)),vec2(d,16));
      dmat.x=smax(dmat.x,-earsClip,.15);
      dmat=MinDist(MinDist(MinDist(MinDist(MinDist(dmat,vec2(a,17)),vec2(c,17)),vec2(eyes,18)),vec2(b,19)),vec2(n,17));
      headDist=c;
      dmat.x*=.15;
      return dmat;
    }
  return vec2(tb*.15,16);
}
vec2 sceneSDF(vec3 p,float current_t)
{
  vec4 splineUV=ToSplineLocalSpace(p.xz,roadWidthInMeters.z);
  vec2 d=motoShape(p);
  d=MinDist(d,driverShape(p));
  d=MinDist(d,terrainShape(p,splineUV));
  d=MinDist(MinDist(d,treesShape(p,splineUV,current_t)),blood(p));
  return MinDist(d,sheep(p));
}
float fastAO(vec3 pos,vec3 nor,float maxDist,float falloff)
{
  float occ1=.5*maxDist-sceneSDF(pos+nor*maxDist*.5,0.).x;
  maxDist=.95*(maxDist-sceneSDF(pos+nor*maxDist,0.).x);
  return clamp(1.-falloff*1.5*(occ1+maxDist),0.,1.);
}
float shadow(vec3 ro,vec3 rd)
{
  float res=1.,t=.08;
  for(int i=0;i<64;i++)
    {
      float h=sceneSDF(ro+rd*t,0.).x;
      res=min(res,10.*h/t);
      t+=h;
      if(res<1e-4||t>50.)
        break;
    }
  return clamp(res,0.,1.);
}
vec3 sky(vec3 V,vec3 fogColor)
{
  float cloud=smoothstep(0.,1.,fBm(.015*time+V.xz/(.01+V.y)*.5,5,.55,.7)+1.);
  cloud=mix(.15,1.,cloud*cloud);
  return mix(mix(vec3(.6,.8,1),vec3(.01,.35,1),pow(smoothstep(.15,1.,V.y),.4)),fogColor,cloud);
}
float trace(vec3 ro,vec3 rd)
{
  float t=.1;
  for(int i=0;i<250;i++)
    {
      float d=sceneSDF(ro+rd*t,0.).x;
      t+=d;
      if(t>5e2||abs(d)<.001)
        break;
    }
  return t;
}
float specular(vec3 v,vec3 l,float size)
{
  float spe=max(dot(v,normalize(l+v)),0.),a=2e3/size;
  size=3./size;
  return(pow(spe,a)*(a+2.)+pow(spe,size)*(size+2.)*2.)*.008;
}
vec3 rayMarchScene(vec3 ro,vec3 rd,out vec3 p)
{
  float t=trace(ro,rd);
  p=ro+rd*t;
  vec2 dmat=sceneSDF(p,t),eps=vec2(1e-4,0);
  vec3 n=normalize(vec3(dmat.x-sceneSDF(p-eps.xyy,t).x,dmat.x-sceneSDF(p-eps.yxy,t).x,dmat.x-sceneSDF(p-eps.yyx,t).x)),sunDir=normalize(vec3(3.5,3,-1)),fogColor=mix(vec3(.6,.7,.8),vec3(.5,.8,1.5),rd.y);
  float ao=fastAO(p,n,.15,1.)*fastAO(p,n,1.,.1)*.5,shad=shadow(p,sunDir);
  shad=mix(.7,1.,shad);
  float fre=1.+dot(rd,n);
  vec3 diff=vec3(1,.8,.7)*max(dot(n,sunDir),0.)*pow(vec3(shad),vec3(1,1.2,1.5)),bnc=vec3(1,.8,.7)*.1*max(dot(n,-sunDir),0.)*ao,sss=vec3(.5)*mix(fastAO(p,rd,.3,.75),fastAO(p,sunDir,.3,.75),.5),spe=vec3(1)*max(dot(reflect(rd,n),sunDir),0.),envm=vec3(0),amb=vec3(.4,.45,.5)*ao,emi=vec3(0);
  sunDir=vec3(0);
  if(t>=5e2)
    return sky(rd,fogColor);
  if(dmat.y==10)
    {
      sunDir=vec3(.1,.4,.1);
      sss*=0.;
      spe*=.1;
      vec4 splineUV=ToSplineLocalSpace(p.xz,roadWidthInMeters.z);
      if(1.-smoothstep(roadWidthInMeters.x,roadWidthInMeters.y,abs(splineUV.x))>.99)
        sunDir=vec3(.5);
    }
  else if(int(dmat.y)<=7)
    sunDir=.2*vec3(.85,.95,1),sss*=0.,spe=pow(spe,vec3(8))*fre*2.;
  else if(dmat.y==9)
    sunDir=vec3(.35,.75,.2),sss*=.1,bnc*=0.,spe*=0.;
  else if(dmat.y==16.)
    sunDir=vec3(.4),sss*=fre*.5+.5,emi=vec3(.35),spe=pow(spe,vec3(4))*fre*.25;
  else if(dmat.y==19.)
    sunDir=vec3(.025),sss*=0.,spe=pow(spe,vec3(80))*fre*10.;
  else if(dmat.y==18.)
    {
      sss*=.5;
      vec3 dir=normalize(eyeDir+(noise(vec3(iTime,iTime*.5,iTime*1.5))*2.-1.)*.01),t=cross(dir,vec3(0,1,0)),b=cross(dir,t);
      t=cross(b,dir);
      dir=n.z*dir+n.x*t+n.y*b;
      t=rd.z*eyeDir+rd.x*t+rd.y*b;
      vec2 offset=t.xy/t.z*length(dir.xy)/length(ro-p)*.4;
      dir.xy-=offset*smoothstep(.01,0.,dot(dir,rd));
      float er=length(dir.xy),theta=atan(dir.x,dir.y);
      b=mix(vec3(.5,.3,.1),vec3(0,.8,1),smoothstep(.16,.3,er)*.3+cos(theta*15.)*.04);
      float pupil=smoothstep(.3,.32,er);
      sunDir=mix(b*.3,mix(b*((smoothstep(-.9,1.,noise(vec3(er*10.,theta*30.+cos(er*50.+noise(vec3(theta))*50.),0)))+smoothstep(-.9,1.,noise(vec3(er*10.,theta*40.+cos(er*30.+noise(vec3(theta))*50.)*2.,0))))*.5+.5)*smoothstep(.3,.29,er)*(vec3(1,.8,.7)*pow(max(0.,dot(normalize(vec3(3,1,-1)),dir)),8.)*3e2+.5)*pupil+pow(spe,vec3(800))*3,vec3(.8),smoothstep(.29,.3,er)),smoothstep(0.,.05,abs(er-.3)+.01));
      n=mix(normalize(n+(eyeDir+n)*4.),n,smoothstep(.3,.32,er));
      {
        vec3 l1=normalize(vec3(1,1.5,-1)),l2=vec3(-l1.x,l1.y*.5,l1.z);
        envm=(mix(mix(vec3(.3,.3,0),vec3(.1),smoothstep(-.7,.2,t.y)),vec3(.3,.65,1),smoothstep(0.,1.,t.y))+(specular(t,l1,.1)+specular(t,l2,2.)*.1+specular(t,normalize(l1+vec3(.2,0,0)),.3)+specular(t,normalize(l1+vec3(.2,0,.2)),.5)+specular(t,normalize(l2+vec3(.1,0,.2)),8.)*.5)*vec3(1,.9,.8))*mix(.15,.2,pupil)*sqrt(fre)*2.5;
      }
      sceneSDF(p,0.);
      sunDir*=smoothstep(0.,.015,headDist)*.4+.6;
      spe*=0.;
    }
  else if(dmat.y==20.)
    sunDir=vec3(.85,.95,1),sss*=0.,spe=pow(spe,vec3(8))*fre*2.;
  else if(dmat.y==21.)
    sunDir=vec3(1),diff*=vec3(.1)*fre,amb*=vec3(.1)*fre,bnc*=0.,sss*=0.,spe=pow(spe,vec3(100))*fre*2.;
  else if(dmat.y==22.)
    sunDir=vec3(1,.01,.01)*.3,diff*=vec3(3),amb*=vec3(2)*fre*fre,sss*=0.,spe=vec3(1,.3,.3)*pow(spe,vec3(500))*5.;
  else if(dmat.y==17.)
    sunDir=vec3(1,.7,.5),amb*=vec3(1,.75,.75),sss=pow(sss,vec3(.5,2.5,5)+2.)*2.,spe=pow(spe,vec3(4))*fre*.02;
  diff=sunDir*(amb+diff*.5+bnc*2.+sss*2.)+envm+spe*shad+emi;
  return mix(diff,fogColor,1.-exp(-t*.015));
}
float verticalBump()
{
  return valueNoise2(6.*time).x;
}
void sideShotFront()
{
  vec2 p=vec2(.95,.5);
  p.x+=mix(-.5,1.,valueNoise2(.5*time).y);
  p.x+=mix(-.01,.01,valueNoise2(6e2*time).y);
  p.y+=.05*verticalBump();
  camPos=vec3(p,1.5);
  camTa=vec3(p.x,p.y+.1,0);
  camProjectionRatio=1.2;
}
void sideShotRear()
{
  vec2 p=vec2(-1,.5);
  p.x+=mix(-.2,.2,valueNoise2(.5*time).y);
  p.x+=mix(-.01,.01,valueNoise2(6e2*time).y);
  p.y+=.05*verticalBump();
  camPos=vec3(p,1.5);
  camTa=vec3(p.x,p.y+.1,0);
  camProjectionRatio=1.2;
}
void fpsDashboardShot()
{
  camPos=vec3(.1,1.12,0);
  camPos.z+=mix(-.02,.02,valueNoise2(.1*time).x);
  camPos.y+=.01*valueNoise2(5.*time).y;
  camTa=vec3(5,1,0);
  camProjectionRatio=.7;
}
void dashBoardUnderTheShoulderShot(float t)
{
  t/=4.;
  float bump=.02*verticalBump();
  camPos=vec3(-.2-.6*t,.88+.35*t+bump,.42);
  camTa=vec3(.5,1.+.2*t+bump,.25);
  camProjectionRatio=1.5;
}
void frontWheelCloseUpShot()
{
  camPos=vec3(-.1,.5,.5);
  camTa=vec3(.9,.35,.2);
  vec2 vibration=.005*valueNoise2(40.*time);
  vibration.x+=.02*verticalBump()+mix(-.01,.01,valueNoise2(1e2*time).y);
  camPos.yz+=vibration;
  camTa.yz+=vibration;
  camProjectionRatio=1.6;
  camShowDriver=0.;
}
void overTheHeadShot()
{
  camPos=vec3(-1.8,1.7,0);
  camTa=vec3(.05,1.45,0);
  float bump=.01*verticalBump();
  camPos.y+=bump;
  camTa.y+=bump;
  camProjectionRatio=3.;
}
void viewFromBehind(float t_in_shot)
{
  camTa=vec3(1,1,0);
  camPos=vec3(-2.-2.5*t_in_shot,.5+.2*t_in_shot,sin(t_in_shot));
  camProjectionRatio=1.;
}
void moonShot(float t_in_shot)
{
  camMotoSpace=0.;
  camPos=vec3(0,18,0);
  camTa=vec3(-1,18.3,1.-.02*t_in_shot);
  camProjectionRatio=1.5;
}
bool get_shot(inout float time,float duration)
{
  if(time<duration)
    return true;
  time-=duration;
  return false;
}
void selectShot()
{
  float time=iTime;
  camProjectionRatio=1.;
  camMotoSpace=1.;
  camShowDriver=1.;
  camFoV=atan(1./camProjectionRatio);
  sheepPos=vec3(0,1.2,0);
  wheelie=0.;
  float seedOffset=0.;
  if(get_shot(time,4.5))
    camMotoSpace=0.,camPos=vec3(1,1,0),camTa=vec3(0,1,5),camProjectionRatio=1.5;
  else if(get_shot(time,8.))
    camTa=vec3(0,1,0),camPos=vec3(5.-.1*time,2.-.2*time,1-.5*time),camProjectionRatio=1.,wheelie=smoothstep(3.,3.5,time),driverIsSleeping=true;
  else if(get_shot(time,6.))
    seedOffset=10.,sideShotRear();
  else if(get_shot(time,5.))
    sideShotFront();
  else if(get_shot(time,4.))
    seedOffset=4.,frontWheelCloseUpShot();
  else if(get_shot(time,8.))
    seedOffset=2.,overTheHeadShot();
  else if(get_shot(time,8.))
    fpsDashboardShot();
  else if(get_shot(time,8.))
    dashBoardUnderTheShoulderShot(time);
  else if(get_shot(time,8.))
    viewFromBehind(time);
  else if(get_shot(time,8.))
    camTa=vec3(0,1.5,0),camPos=vec3(1.+2.5*time,1.5,-2),camProjectionRatio=1.;
  else if(get_shot(time,4.))
    sideShotFront();
  else if(get_shot(time,4.))
    overTheHeadShot();
  else if(get_shot(time,4.))
    sideShotRear();
  else if(get_shot(time,4.))
    frontWheelCloseUpShot();
  else if(get_shot(time,8.))
    fpsDashboardShot();
  else if(get_shot(time,8.))
    dashBoardUnderTheShoulderShot(time);
  else if(get_shot(time,6.))
    viewFromBehind(time),sheepOnMoto=true,driverIsSleeping=true;
  else if(get_shot(time,10.))
    camMotoSpace=0.,camPos=vec3(1,1.5,0),camTa=vec3(2,3.+.5*time,-10),camProjectionRatio=1.5;
  else if(get_shot(time,10.))
    moonShot(time+20.);
  PIXEL_ANGLE=camFoV/iResolution.x;
  seedOffset=iTime-time;
  motoDistanceOnCurve=mix(.1,.9,(mod(seedOffset,14.)+iTime-seedOffset)/20.);
}
float bloom(vec3 ro,vec3 rd,vec3 lightPosition,vec3 lightDirection,float falloff)
{
  ro=motoToWorld(lightPosition,true)-ro;
  lightPosition=normalize(ro);
  float aligned=max(0.,dot(lightPosition,-motoToWorld(normalize(lightDirection),false)));
  return aligned/(1.+falloff*(1.-dot(rd,lightPosition)))/mix(1.,length(ro),0.);
}
void main()
{
  vec2 texCoord=gl_FragCoord.xy/iResolution.xy,uv=(texCoord*2.-1.)*vec2(1,iResolution.y/iResolution.x);
  time=iTime;
  selectShot();
  computeMotoPosition();
  vec3 ro,rd,cameraTarget=camTa,cameraPosition=camPos;
  if(camMotoSpace>.5)
    cameraPosition=motoToWorld(camPos,true),cameraTarget=motoToWorld(camTa,true);
  else
     getRoadPositionDirectionAndCurvature(.7,cameraPosition),cameraTarget=cameraPosition+camTa,cameraPosition+=camPos;
  setupCamera(uv,cameraPosition,cameraTarget,ro,rd);
  cameraTarget=rayMarchScene(ro,rd,cameraTarget);
  cameraTarget+=.3*bloom(ro,rd,headLightOffsetFromMotoRoot+vec3(.1,-.05,0),vec3(1,-.15,0),1e4)*5.*vec3(1,.9,.8);
  cameraTarget+=bloom(ro,rd,breakLightOffsetFromMotoRoot,vec3(-1,-.5,0),1e5)*2.*vec3(1,0,0);
  fragColor=vec4(mix(cameraTarget,texture(tex,texCoord).xyz,.3)+vec3(hash21(fract(uv+iTime)),hash21(fract(uv-iTime)),hash21(fract(uv.yx+iTime)))*.04-.02,1);
  fragColor/=1.+pow(length(uv),4.)*.1;
}

