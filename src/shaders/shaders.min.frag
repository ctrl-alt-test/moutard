#version 150

uniform float iTime;
uniform sampler2D tex;
int sceneID=0;
float camMotoSpace,camProjectionRatio=1.,wheelie=0.,globalFade=1.,shouldDrawLogo=0.;
vec3 camPos,camTa,sheepPos=vec3(0),panelWarningPos=vec3(6,0,0);
bool warningIsSheep=true;
const vec3 roadWidthInMeters=vec3(3.5,5,8);
out vec4 fragColor;
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
float fBm(vec2 p)
{
  return valueNoise(p)*2.-1.;
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
float Torus2(vec3 p)
{
  vec2 t=vec2(.14,.05);
  return length(vec2(length(p.xy)-t.x,p.z))-t.y;
}
mat2 Rotation(float angle)
{
  float c=cos(angle);
  angle=sin(angle);
  return mat2(c,angle,-angle,c);
}
float Triangle(vec3 p,vec2 h,float r)
{
  return max(abs(p.z)-h.y,smax(smax(p.x*.9+p.y*.5,-p.x*.9+p.y*.5,r),-p.y,r)-h.x*.5);
}
float UnevenCapsule2d(vec2 p)
{
  p.x=abs(p.x);
  float a=sqrt(.99),k=dot(p,vec2(.1,a));
  return k<0.?
    length(p)-.06:
    k>a*.8?
      length(p-vec2(0,.8))-.14:
      dot(p,vec2(a,-.1))-.06;
}
vec2 MinDist(vec2 d1,vec2 d2)
{
  return d1.x<d2.x?
    d1:
    d2;
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
const vec2 roadP1=vec2(0,-1)*1e3,roadP2=vec2(0,1)*1e3;
vec4 ToSplineLocalSpace(vec2 p,float splineWidth)
{
  return vec4(distanceToSegment(p),0,tOnSegment(p),1);
}
vec2 panelWarning(vec3 p)
{
  p-=panelWarningPos;
  float pan=Triangle(p-vec3(0,3,-5),vec2(1.7,.1),.3);
  if(pan>8.)
    return vec2(1e6,4);
  pan=smax(pan,-Triangle(p-vec3(0,3,-5.1),vec2(1.6,.1),.3),.001);
  float tube=Box3(p-vec3(0,2,-5.1),vec3(.11,2,.08),0.);
  p.y=abs(p.y-3.65)-.3;
  tube=min(tube,Box3(p-vec3(0,0,-5.05),vec3(.35,.1,.05),0.));
  vec2 dmat=vec2(tube,13);
  return MinDist(dmat,vec2(pan,15));
}
vec2 blood(vec3 p)
{
  if(sceneID!=2)
    return vec2(1e6,4);
  p-=vec3(0,1.2,-2.5);
  float d=p.y+smoothstep(1.5,8.,length(p.xz))+1.;
  return d<.4?
    d-=pow((noise(p*.9)*.5+noise(p*1.6)*.3+noise(p*2.7)*.1)*.5+.5,3.)*.45,vec2(d,14):
    vec2(d,4);
}
float roadBumpHeight(float d)
{
  d=clamp(abs(d/roadWidthInMeters.x),0.,1.);
  return.2*(1.-d*d*d);
}
vec2 terrainShape(vec3 p,vec4 splineUV)
{
  float isRoad=1.-smoothstep(roadWidthInMeters.x,roadWidthInMeters.y,abs(splineUV.x)),height=mix(valueNoise(p.xz*5.)*.1+.5*fBm(p.xz*2./5.),0.,isRoad*isRoad);
  if(isRoad>0.)
    height+=roadBumpHeight(splineUV.x)+pow(valueNoise(mod(p.xz*50,100)),.01)*.1;
  return vec2(p.y-height,4);
}
float tree(vec3 globalP,vec3 localP,vec2 id,vec4 splineUV)
{
  float h1=hash21(id),h2=hash11(h1);
  if(globalP.y+1.-20.>0.)
    return 1e6;
  float d=3.5;
  if(abs(splineUV.x)<roadWidthInMeters.x)
    return d;
  float treeClearance=roadWidthInMeters.y+5.;
  if(abs(ToSplineLocalSpace(id,treeClearance).x)<treeClearance)
    return d;
  treeClearance=mix(7.,20.,h1);
  float treeWidth=max(3.5,treeClearance*mix(.3,.4,h2*h2));
  localP.y-=-1.+.5*treeClearance;
  localP.xz+=(vec2(h1,h2)-.5)*1.5;
  d=min(d,Ellipsoid(localP,.5*vec3(treeWidth,treeClearance,treeWidth)));
  id+=vec2(2.*atan(localP.z,localP.x),localP.y);
  return d+.2*fBm(2.*id)+.5;
}
vec2 treesShape(vec3 p,vec4 splineUV)
{
  vec2 id=round(p.xz/10.)*10.;
  vec3 localP=p;
  localP.xz-=id;
  return vec2(tree(p,localP,id,splineUV),3);
}
vec3 motoPos;
const vec3 headLightOffsetFromMotoRoot=vec3(.53,.98,0),breakLightOffsetFromMotoRoot=vec3(-.8,.75,0);
float motoPitch;
void computeMotoPosition()
{
  vec4 motoDirAndTurn=vec4(0,0,-1,0);
  float rightOffset=.5*sin(iTime);
  motoPos.xz+=vec2(-motoDirAndTurn.z,motoDirAndTurn)*rightOffset;
  motoPos.y+=roadBumpHeight(abs(rightOffset))+.1;
  motoPitch=atan(motoDirAndTurn.y,length(motoDirAndTurn.zx));
  if(wheelie>0.)
    motoPitch+=mix(0.,.5,wheelie),motoPos.y+=mix(0.,.4,wheelie);
}
vec3 motoToWorldForCamera(vec3 v)
{
  v.xz*=Rotation(1.57);
  return v+motoPos;
}
vec3 motoToWorld(vec3 v,bool isPos)
{
  v.xy*=Rotation(-motoPitch);
  v.xz*=Rotation(1.57);
  if(isPos)
    v+=motoPos;
  return v;
}
vec3 worldToMoto(vec3 v)
{
  v-=motoPos;
  v.xz*=Rotation(-1.57);
  v.xy*=Rotation(motoPitch);
  return v;
}
vec2 driverShape(vec3 p)
{
  float wind=0.;
  if(sceneID==2)
    p-=vec3(.4,.5,-2.5),p.yz*=Rotation(1.5),p.xz*=Rotation(.4);
  else if(sceneID==3)
    return vec2(1e6,2);
  else
     wind=fBm((p.xy+iTime)*12.),p=worldToMoto(p)-vec3(-.35,.78,0);
  float d=length(p);
  if(d>1.2)
    return vec2(d,2);
  vec3 simP=p;
  simP.z=abs(simP.z);
  if(d<.8)
    {
      vec3 pBody=p;
      pBody.z=max(abs(pBody.z)-.02,0);
      pBody.xy*=Rotation(3.1);
      pBody.yz*=Rotation(-.1);
      d=smin(d,Capsule(pBody,.12,.12),.4);
      pBody.y+=.2;
      pBody.xy*=Rotation(-.6);
      d=smin(d,Capsule(pBody,.12,.11),.08);
      pBody.y+=.2;
      pBody.xy*=Rotation(-.3);
      pBody.yz*=Rotation(-.2);
      d=smin(d,Capsule(pBody,.12,.12),.08);
      pBody.y+=.1;
      pBody.yz*=Rotation(1.7);
      d=smin(d,Capsule(pBody,.12,.1),.06);
      pBody=p;
      pBody.y-=.48;
      pBody.x-=.25;
      pBody.xy*=Rotation(-.7);
      d=min(d,length(vec2(max(abs(pBody.y)-.07,0),abs(length(pBody.xz)-.05)))-.04);
    }
  {
    vec3 pArm=simP-vec3(.23,.45,.18);
    pArm.yz*=Rotation(-.6);
    pArm.xy*=Rotation(.2);
    float arms=Capsule(pArm,.29,.06);
    d=smin(d,arms,.02);
    pArm.y+=.32;
    pArm.xy*=Rotation(1.5);
    arms=Capsule(pArm,.28,.04);
    d=smin(d,arms,.02);
  }
  d+=.005*wind;
  {
    vec3 pLeg=simP-vec3(0,0,.13);
    if(sceneID!=2)
      pLeg.xy*=Rotation(1.55),pLeg.yz*=Rotation(-.4);
    float h2=Capsule(pLeg,.35,.09);
    d=smin(d,h2,.04);
    pLeg.y+=.4;
    pLeg.xy*=Rotation(-1.5);
    h2=Capsule(pLeg,.4,.06);
    d=smin(d,h2,.04);
    pLeg.y+=.45;
    pLeg.xy*=Rotation(1.75);
    pLeg.yz*=Rotation(.25);
    h2=Capsule(pLeg,.2,.03);
    d=smin(d,h2,.02);
  }
  d+=.002*wind;
  {
    vec3 pHead=p-vec3(.39,.6,0);
    float head=length(pHead*vec3(1.2,1,1.3-pHead.y))-.15;
    if(head<d)
      return vec2(head,0);
  }
  return vec2(d,2);
}
vec2 wheelShape(vec3 p,float wheelRadius,float tireRadius,float innerRadius,vec3 innerPart)
{
  wheelRadius=Torus(p.yzx,vec2(wheelRadius,tireRadius));
  if(wheelRadius<.25)
    {
      p.z=abs(p.z);
      float h;
      h=Segment3(p,vec3(0),vec3(0,0,1),h);
      wheelRadius=min(min(-smin(-wheelRadius,h-innerRadius,.04),-min(min(min(.15-h,h-.08),p.z-.04),-p.z+.05)),Ellipsoid(p,innerPart));
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
    handle=min(handle,max(length(pFork.xz)-.003,max(pFork.y,-pFork.y-.2)));
    fork=min(fork,handle);
    d=MinDist(d,vec2(fork,17));
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
    d=MinDist(d,vec2(headBlock,0));
    headBlock=Box3(p-vec3(.4,.82,0),vec3(.04,.1,.08),.02);
    d=MinDist(d,vec2(headBlock,0));
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
    d=MinDist(d,vec2(tank,17));
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
    d=MinDist(d,vec2(motorBlock,0));
  }
  {
    vec3 pExhaust=p-vec3(0,0,.2);
    float exhaust=Segment3(pExhaust,vec3(.24,.25,0),vec3(-.7,.3,.05),boundingSphere);
    if(exhaust<.6)
      exhaust=-min(-exhaust+mix(.04,.08,mix(boundingSphere,smoothstep(.5,.7,boundingSphere),.5)),p.x-.7*p.y+.9),exhaust=min(exhaust,Segment3(pExhaust,vec3(.24,.25,0),vec3(.32,.55,-.02),boundingSphere)-.04),exhaust=min(exhaust,Segment3(pExhaust,vec3(.22,.32,-.02),vec3(-.4,.37,.02),boundingSphere)-.04);
    d=MinDist(d,vec2(exhaust,17));
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
        seat=-smin(min(-seat,seatSaddleCut),seatSaddleCut,.08);
        pSaddle=pSeat+vec3(0,-.55,0);
        pSaddle.xy*=Rotation(.5);
        seatSaddleCut=Ellipsoid(pSaddle,vec3(.8,.4,.4));
        seat=-min(-seat,-seatSaddleCut);
      }
    d=MinDist(d,vec2(seat,17));
  }
  return d;
}
vec3 eyeDir=vec3(0,-.2,1),animationSpeed=vec3(1.5);
const vec3 animationAmp=vec3(1,.2,.25);
vec2 headRot=vec2(0,-.4);
float blink=0.,squintEyes=0.,sheepTears=-1.,headDist=0.;
float sunglasses(vec3 p)
{
  if(sceneID!=3)
    return 1e6;
  p-=vec3(0,.3,-.9);
  vec3 framePos=p;
  float h,middle=Segment3(p-vec3(0,-.1,-.4),vec3(-.3,0,0),vec3(.3,0,0),h)-.04;
  framePos.x=abs(framePos.x)-.5;
  h=Segment3(framePos,vec3(.3,0,0),vec3(.2,-.1,-.4),h)-.04;
  h=min(h,middle);
  framePos=p-vec3(0,-.25,-.4);
  framePos.x=abs(framePos.x)-.4;
  middle=length(framePos*vec3(.3,.4,1))-.1;
  return min(h,middle);
}
vec2 sheep(vec3 p,bool shiftPos)
{
  if(shiftPos)
    if(sceneID==3)
      {
        p=p-motoPos-vec3(0,1.2,-.3);
        p.yz*=Rotation(.5);
        if(wheelie>0.)
          p.yz*=Rotation(wheelie*.4),p.y-=mix(0.,.35,wheelie),p.z-=mix(0.,.2,wheelie);
      }
    else
       p-=sheepPos;
  p/=.15;
  float tb=iTime*animationSpeed.x;
  vec3 bodyMove=vec3(cos(tb*PI),cos(tb*PI*2.)*.1,0)*.025*animationAmp.x;
  tb=length(p*vec3(1,1,.825)-vec3(0,1.5,2.55)-bodyMove)-2.;
  if(tb>=3.)
    return vec2(tb*.15,9);
  float n=pow(noise((p-bodyMove+vec3(.05,0,.5))*2.)*.5+.5,.75)*2.-1.;
  tb=tb+.05-n*.2;
  n=mod(iTime*animationSpeed.x,2.);
  float a=smoothstep(0.,.5,n),b=smoothstep(.5,1.,n),c=smoothstep(1.,1.5,n),d=smoothstep(1.5,2.,n);
  vec4 legsRot=vec4(b*(1.-b),d*(1.-d),a*(1.-a),c*(1.-c)),legsPos=(n*.5-vec4(b,d,a,c))*animationAmp.x;
  bodyMove=p;
  bodyMove.x-=.8;
  bodyMove.z-=2.+legsPos.x;
  bodyMove.yz=Rotation(legsRot.x)*bodyMove.yz;
  a=cappedCone(bodyMove-vec3(0),.7,.3,.2);
  b=cappedCone(bodyMove-vec3(0,-.8,0),.2,.35,.3);
  bodyMove=p;
  bodyMove.x+=1.;
  bodyMove.z-=2.+legsPos.y;
  bodyMove.yz=Rotation(legsRot.y)*bodyMove.yz;
  a=min(a,cappedCone(bodyMove-vec3(0),.7,.3,.2));
  b=min(b,cappedCone(bodyMove-vec3(0,-.8,0),.2,.35,.3));
  bodyMove=p;
  bodyMove.x-=1.;
  bodyMove.z-=4.+legsPos.z;
  bodyMove.yz=Rotation(legsRot.z)*bodyMove.yz;
  a=min(a,cappedCone(bodyMove-vec3(0),.7,.3,.2));
  b=min(b,cappedCone(bodyMove-vec3(0,-.8,0),.2,.35,.3));
  bodyMove=p;
  bodyMove.x+=1.;
  bodyMove.z-=4.+legsPos.w;
  bodyMove.yz=Rotation(legsRot.w)*bodyMove.yz;
  a=min(a,cappedCone(bodyMove-vec3(0),.7,.3,.2));
  b=min(b,cappedCone(bodyMove-vec3(0,-.8,0),.2,.35,.3));
  bodyMove=p+vec3(0,-2,-1.2);
  bodyMove.xz=Rotation((smoothstep(0.,1.,abs(mod(iTime,1.)*2.-1.))*animationSpeed.y-.5)*.25*animationAmp.y+headRot.x)*bodyMove.xz;
  bodyMove.zy=Rotation(sin(iTime*animationSpeed.y)*.25*animationAmp.y-headRot.y)*bodyMove.zy;
  c=smin(length(bodyMove-vec3(0,-1.3,-1.2))-1.,length(bodyMove-vec3(0))-.5,1.8);
  d=sunglasses(bodyMove);
  vec3 pp=bodyMove*vec3(.7,1,.7);
  n=smin(length(bodyMove-vec3(0,.35,-.1))-.55-(cos(bodyMove.z*8.+bodyMove.y*4.5+bodyMove.x*4.)+cos(bodyMove.z*4.+bodyMove.y*6.5+bodyMove.x*8.))*.05,tb,.1);
  pp=bodyMove;
  pp.yz=Rotation(-.6)*pp.yz;
  pp.x=abs(p.x)-.8;
  pp*=vec3(.3,1,.4);
  pp-=vec3(0,-.05-pow(pp.x,2.)*5.,-.1);
  float ears=smax(length(pp)-.15,-length(pp-vec3(0,-.1,0))+.12,.01);
  pp.y*=.3;
  pp.y-=-.11;
  float earsClip=length(pp)-.16;
  pp=bodyMove;
  pp.x=abs(bodyMove.x)-.4;
  float eyes=length(pp*vec3(1)-vec3(0,0,-1))-.3,eyeCap=abs(eyes)-.02,blink=mix(smoothstep(.95,.96,blink)*.3+cos(iTime*10.)*.02,.1,squintEyes);
  eyeCap=smin(smax(eyeCap,smin(-abs(bodyMove.y+bodyMove.z*.025)+.25-blink,-bodyMove.z-1.,.2),.01),c,.02);
  c=min(c,eyeCap);
  pp.x=abs(bodyMove.x)-.2;
  pp.xz=Rotation(-.45)*pp.xz;
  c=smin(smax(c,-length(pp-vec3(-.7,-1.2,-2.05))+.14,.1),Torus2(pp-vec3(-.7,-1.2,-1.94)),.05);
  if(sheepTears<0.)
    eyeCap=1e6;
  else
    {
      pp=bodyMove;
      pp.x=abs(bodyMove.x)-.25;
      float shift=sheepTears*.02;
      eyeCap=smin(length(pp-vec3(0,-.15-shift*.5,-1.1-shift))-.01-shift*.1-(noise(pp*10.)*.5+.5)*.1,c+.01,.1);
    }
  blink=smin(tb,capsule(p-vec3(0,-.1,cos(p.y-.7)*.5),vec3(cos(iTime*animationSpeed.z)*animationAmp.z,.2,5))-(cos(p.z*8.+p.y*4.5+p.x*4.)+cos(p.z*4.+p.y*6.5+p.x*3.))*.02,.1);
  vec2 dmat=MinDist(MinDist(vec2(tb,9),vec2(blink,9)),vec2(n,9));
  dmat.x=smax(dmat.x,-earsClip,.15);
  dmat=MinDist(MinDist(MinDist(MinDist(MinDist(MinDist(MinDist(dmat,vec2(a,10)),vec2(c,10)),vec2(eyeCap,16)),vec2(eyes,11)),vec2(b,12)),vec2(ears,10)),vec2(d,0));
  headDist=c;
  dmat.x*=.15;
  return dmat;
}
vec2 sceneSDF(vec3 p)
{
  vec4 splineUV=ToSplineLocalSpace(p.xz,roadWidthInMeters.z);
  vec2 d=motoShape(p);
  d=MinDist(MinDist(MinDist(MinDist(MinDist(d,driverShape(p)),terrainShape(p,splineUV)),treesShape(p,splineUV)),blood(p)),panelWarning(p));
  return MinDist(d,sheep(p,true));
}
float fastAO(vec3 pos,vec3 nor,float maxDist,float falloff)
{
  float occ1=.5*maxDist-sceneSDF(pos+nor*maxDist*.5).x;
  maxDist=.95*(maxDist-sceneSDF(pos+nor*maxDist).x);
  return clamp(1.-falloff*1.5*(occ1+maxDist),0.,1.);
}
float shadow(vec3 ro,vec3 rd)
{
  float res=1.,t=.08;
  for(int i=0;i<64;i++)
    {
      float h=sceneSDF(ro+rd*t).x;
      res=min(res,10.*h/t);
      t+=h;
      if(res<1e-4||t>50.)
        break;
    }
  return clamp(res,0.,1.);
}
float trace(vec3 ro,vec3 rd)
{
  float t=.1;
  for(int i=0;i<250;i++)
    {
      float d=sceneSDF(ro+rd*t).x;
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
vec3 rayMarchScene(vec3 ro,vec3 rd)
{
  float t=trace(ro,rd);
  vec3 p=ro+rd*t;
  vec2 dmat=sceneSDF(p),eps=vec2(1e-4,0);
  vec3 n=normalize(vec3(dmat.x-sceneSDF(p-eps.xyy).x,dmat.x-sceneSDF(p-eps.yxy).x,dmat.x-sceneSDF(p-eps.yyx).x)),sunDir=normalize(vec3(3.5,3,-1)),fogColor=mix(vec3(.5,.6,.7),vec3(.4,.6,.8),min(1.,rd.y*4.));
  float ao=fastAO(p,n,.15,1.)*fastAO(p,n,1.,.1)*.5,shad=shadow(p,sunDir);
  shad=mix(.4,1.,shad);
  float fre=1.+dot(rd,n);
  vec3 diff=vec3(1,.8,.7)*max(dot(n,sunDir),0.)*pow(vec3(shad),vec3(1,1.2,1.5)),bnc=vec3(1,.8,.7)*.1*max(dot(n,-sunDir),0.)*ao,sss=vec3(.5)*mix(fastAO(p,rd,.3,.75),fastAO(p,sunDir,.3,.75),.5),spe=vec3(1)*max(dot(reflect(rd,n),sunDir),0.),envm=vec3(0),amb=vec3(.4,.45,.5)*ao,emi=vec3(0);
  sunDir=vec3(0);
  if(t>=5e2)
    return mix(mix(vec3(.4,.5,.6),vec3(.7),pow(smoothstep(.15,1.,rd.y),.4)),fogColor,mix(.15,1.,pow(smoothstep(0.,1.,fBm(.015*iTime+rd.xz/(.05+rd.y)*.5)+1.),2.)));
  if(dmat.y==4)
    if(abs(p.x)<roadWidthInMeters.x)
      {
        vec2 laneUV=p.xz/3.5;
        float tireTrails=sin((laneUV.x-.125)*4.*PI)*.5+.5;
        tireTrails=mix(mix(tireTrails,smoothstep(0.,1.,tireTrails),.25),fBm(laneUV*vec2(50,5)),.2);
        vec3 color=vec3(mix(vec3(.2),vec3(.3),tireTrails));
        sss*=0.;
        sunDir=color;
        spe*=mix(0.,.1,tireTrails);
      }
    else
       sss*=.3,sunDir=vec3(.1,.15,.1),spe*=0.;
  else if(dmat.y==2||dmat.y==1)
    sunDir=vec3(.01),spe*=.02,sss*=0.;
  else if(dmat.y==0)
    sunDir=vec3(.01),spe*=pow(spe,vec3(15))*fre*2.,sss*=0.;
  else if(dmat.y==17)
    sunDir=vec3(.1),spe*=pow(spe,vec3(8))*fre*1.5,sss*=0.;
  else if(dmat.y==3)
    sunDir=vec3(.1,.25,.2),sss*=.2,spe*=0.;
  else if(dmat.y==9)
    sunDir=vec3(.4),sss*=fre*.5+.5,emi=vec3(.35),spe=pow(spe,vec3(4))*fre*.25;
  else if(dmat.y==12)
    sunDir=vec3(.025),sss*=0.,spe=pow(spe,vec3(15))*fre*10.;
  else if(dmat.y==11)
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
      float pupil=smoothstep(.1,.12,er);
      sunDir=mix(b*.3,mix(b*((smoothstep(-.9,1.,noise(vec3(er*10.,theta*30.+cos(er*50.+noise(vec3(theta))*50.),0)))+smoothstep(-.9,1.,noise(vec3(er*10.,theta*40.+cos(er*30.+noise(vec3(theta))*50.)*2.,0))))*.5+.5)*smoothstep(.3,.29,er)*(vec3(1,.8,.7)*pow(max(0.,dot(normalize(vec3(3,1,-1)),dir)),8.)*3e2+.5)*pupil+pow(spe,vec3(800))*3,vec3(.8),smoothstep(.29,.3,er)),smoothstep(0.,.05,abs(er-.3)+.01));
      n=mix(normalize(n+(eyeDir+n)*4.),n,smoothstep(.3,.32,er));
      {
        vec3 l1=normalize(vec3(1,1.5,-1)),l2=vec3(-l1.x,l1.y*.5,l1.z);
        envm=(mix(mix(vec3(.3,.3,0),vec3(.1),smoothstep(-.7,.2,t.y)),vec3(.3,.65,1),smoothstep(0.,1.,t.y))+(specular(t,l1,.1)+specular(t,l2,2.)*.1+specular(t,normalize(l1+vec3(.2,0,0)),.3)+specular(t,normalize(l1+vec3(.2,0,.2)),.5)+specular(t,normalize(l2+vec3(.1,0,.2)),8.)*.5)*vec3(1,.9,.8))*mix(.15,.2,pupil)*sqrt(fre)*2.5;
      }
      sceneSDF(p);
      sunDir*=smoothstep(0.,.015,headDist)*.4+.6;
      spe*=0.;
    }
  else if(dmat.y==13)
    sunDir=vec3(.85,.95,1),sss*=0.,spe=pow(spe,vec3(8))*fre*2.;
  else if(dmat.y==14)
    sunDir=vec3(1,.01,.01)*.3,diff*=vec3(3),amb*=vec3(2)*fre*fre,sss*=0.,spe=vec3(1,.3,.3)*pow(spe,vec3(500))*5.;
  else if(dmat.y==15)
    {
      vec3 p=p-panelWarningPos;
      sss*=0.;
      spe=pow(spe,vec3(8))*fre*20.;
      if(n.z>.5)
        {
          vec3 pp=p-vec3(-.3,2.75,0);
          float symbol;
          if(warningIsSheep)
            {
              pp.xy*=.9;
              float dist=5.;
              headRot=vec2(0,-.3);
              animationSpeed=vec3(0);
              for(float x=-.2;x<=.2;x+=.08)
                {
                  vec3 point=vec3(x,pp.yx);
                  point.xz*=Rotation(.1);
                  dist=min(dist,sheep(point,false).x);
                }
              symbol=1.-smoothstep(.001,.01,dist);
            }
          else
             symbol=smoothstep(.13,.1295,length(p-vec3(0,2.55,-4.9)))+smoothstep(.005,0.,UnevenCapsule2d(p.xy-vec2(0,2.85)));
          sunDir=mix(mix(vec3(1.5,0,0),vec3(2),smoothstep(.005,0.,Triangle(p-vec3(0,3,-5),vec2(1.3,.2),.01))),vec3(0),symbol);
        }
      else
         sunDir=vec3(.85,.95,1);
    }
  else if(dmat.y==10)
    sunDir=vec3(1,.7,.5),amb*=vec3(1,.75,.75),sss=pow(sss,vec3(.5,2.5,4)+2.)*3.,spe=pow(spe,vec3(4))*fre*.02;
  else if(dmat.y==16)
    sunDir=vec3(1,.8,.65),amb*=vec3(1,.85,.85),sss=pow(sss,vec3(.8,1.8,3)+2.)*2.,spe=pow(spe,vec3(8))*fre*fre*10.;
  else
     sunDir=vec3(1,0,1);
  diff=sunDir*(amb+diff*.5+bnc*2.+sss*2.)+envm+spe*shad+emi;
  return mix(diff,fogColor,1.-exp(-t*.005));
}
float verticalBump()
{
  return valueNoise2(6.*iTime).x;
}
void sideShotFront()
{
  vec2 p=vec2(.95,.5);
  p.x+=mix(-1.,1.,valueNoise2(.5*iTime).y);
  p.x+=mix(-.01,.01,valueNoise2(6e2*iTime).y);
  p.y+=.05*verticalBump();
  camPos=vec3(p,-1.5);
  camTa=vec3(p.x,p.y+.1,0);
  camProjectionRatio=1.2;
}
void viewFromBehind(float t_in_shot)
{
  camTa=vec3(1,1,0);
  camPos=vec3(-2.-2.5*t_in_shot,.5+.2*t_in_shot,sin(t_in_shot));
  camProjectionRatio=1.;
}
void motoFaceImpactShot(float t_in_shot)
{
  sceneID=1;
  float shift=t_in_shot/10.,impact=smoothstep(9.8,10.,t_in_shot);
  camPos=vec3(3.-impact-shift*1.2,.5,0);
  camPos.xz+=(valueNoise2(5e2*t_in_shot)*shift).xy*.1;
  camTa=vec3(0,1.+shift*.2,0);
  camProjectionRatio=1.5+impact*5.+shift;
  globalFade*=1.-impact;
}
void sheepScaredShot(float t_in_shot)
{
  camMotoSpace=0.;
  animationSpeed*=0.;
  float shift=t_in_shot/5.;
  headRot=vec2(0,-.1);
  eyeDir=vec3(0,-.1,1);
  vec2 noise=valueNoise2(1e2*t_in_shot)*smoothstep(0.,5.,t_in_shot);
  if(t_in_shot>2.)
    sheepTears=t_in_shot;
  if(t_in_shot>=5.)
    noise*=.3,sheepTears=t_in_shot-4.,sheepTears*=4.;
  headRot.xy+=noise.xy*.1;
  camPos=vec3(1,.9,6.-shift);
  camTa=vec3(1,.8,7);
  sheepPos=vec3(1,.5,7);
  camProjectionRatio=1.5+shift*2.;
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
  camMotoSpace=1.;
  sheepPos=vec3(1e6);
  wheelie=0.;
  blink=max(fract(iTime*.333),fract(iTime*.123+.1));
  if(get_shot(time,10.))
    {
      globalFade*=smoothstep(0.,7.,time);
      camMotoSpace=0.;
      float motion=time*.1,vshift=smoothstep(6.,0.,time);
      camPos=vec3(1,.9+vshift*.5,6.-motion);
      camTa=vec3(1,.8+vshift,7.-motion);
      sheepPos=vec3(1,.5,7.-motion);
      camProjectionRatio=1.5;
      motion=smoothstep(6.,6.5,time)*smoothstep(9.,8.5,time);
      headRot=vec2(0,.4-motion*.5);
      eyeDir=vec3(0,.1-motion*.2,1);
    }
  else if(get_shot(time,5.))
    sceneID=1,viewFromBehind(time);
  else if(get_shot(time,5.))
    {
      camMotoSpace=0.;
      float motion=time*.1;
      camPos=vec3(2.5,.5,3.-motion);
      sheepPos=vec3(1,.5,5.-motion);
      camTa=vec3(0,1,4.8-motion);
      camProjectionRatio=1.5;
      headRot=vec2(0,.2);
      eyeDir=vec3(0,.1,1);
    }
  else if(get_shot(time,5.))
    sceneID=1,sideShotFront();
  else if(get_shot(time,5.))
    {
      float shift=smoothstep(3.,3.3,time)*.5,motion=time*.1;
      camMotoSpace=0.;
      camPos=vec3(2.5,1,6);
      sheepPos=vec3(1,.5,5.-motion);
      panelWarningPos=vec3(3.5,.5,2.5);
      camTa=mix(vec3(1,1,5),vec3(1,1.5,1),shift*2.);
      warningIsSheep=false;
      headRot=vec2(0,.5);
    }
  else if(get_shot(time,5.))
    {
      sceneID=1;
      float t=time/2.,bump=.02*verticalBump();
      camPos=vec3(-.2-.6*t,.88+.35*t+bump,.42);
      camTa=vec3(.5,1.+.2*t+bump,.25);
      panelWarningPos=vec3(3.5,.5,-250);
      camProjectionRatio=1.5;
    }
  else if(get_shot(time,3.))
    {
      camMotoSpace=0.;
      float motion=time*.1,shift=smoothstep(0.,5.,time);
      headRot=vec2(0,.5);
      eyeDir=vec3(0,.3,1);
      headRot.x+=sin(time*2.)*.2;
      eyeDir.x+=sin(time*2.)*.2;
      camPos=vec3(1,.6,6.-shift-motion);
      camTa=vec3(1,.8,7);
      sheepPos=vec3(1,.5,7.-shift-motion);
    }
  else if(get_shot(time,2.))
    {
      sceneID=1;
      float shift=time/5.;
      camPos=vec3(4.-shift,.8,0);
      camTa=vec3(-10,0,0);
      camProjectionRatio=1.5+shift;
    }
  else if(get_shot(time,5.))
    {
      camMotoSpace=0.;
      float motion=time*.1,shift=smoothstep(3.5,4.,time),headShift=smoothstep(2.5,3.,time);
      headRot=vec2(0,.4-headShift*.5);
      eyeDir=vec3(0,.1-headShift*.2,1);
      camPos=vec3(1,.9,6.-shift-motion);
      camTa=vec3(1,.8,7.-motion);
      sheepPos=vec3(1,.5,7.-motion);
      camProjectionRatio=1.5+shift*2.;
      squintEyes=smoothstep(3.3,3.5,time);
      eyeDir.x+=.18-smoothstep(4.3,4.5,time)*.18-smoothstep(3.,1.,time)*.4;
    }
  else if(get_shot(time,3.))
    {
      sceneID=1;
      float shift=time/10.;
      vec2 noise=valueNoise2(5e2*time);
      camPos=vec3(3.-shift*1.2,.5,0);
      camPos.z+=noise.y*.05;
      shift=smoothstep(.5,0.,time);
      float shiftUp=smoothstep(2.,2.5,time);
      camTa=vec3(0,.5+shiftUp*.5,shift*.5);
      camProjectionRatio=2.;
    }
  else if(get_shot(time,1.6))
    sheepScaredShot(time);
  else if(get_shot(time,1.4))
    motoFaceImpactShot(time);
  else if(get_shot(time,1.4))
    sheepScaredShot(time+1.5),blink=time*2.,headRot+=vec2(sin(time*40.)*.15,-.1+time*.5);
  else if(get_shot(time,1.4))
    motoFaceImpactShot(time+3.);
  else if(get_shot(time,1.6))
    sheepScaredShot(time+3.4);
  else if(get_shot(time,1.))
    motoFaceImpactShot(time+5.);
  else if(get_shot(time,1.6))
    sheepScaredShot(time+5.),camProjectionRatio=5.5,blink=1.6-time;
  else if(get_shot(time,2.))
    motoFaceImpactShot(time+8.);
  else if(get_shot(time,10.))
    {
      globalFade*=smoothstep(1.,4.,time);
      globalFade*=smoothstep(9.,7.,time);
      camMotoSpace=0.;
      float motion=time*.5;
      camPos=vec3(2.5,1.5,-6.+motion);
      camTa=vec3(1,0,-9.+motion);
      sceneID=2;
    }
  else if(get_shot(time,5.))
    {
      globalFade*=smoothstep(0.,1.,time);
      vec2 p=vec2(.95,.5);
      p.x+=mix(-1.,1.,valueNoise2(.5*time).y);
      p.x+=mix(-.01,.01,valueNoise2(6e2*time).y);
      p.y+=.05*verticalBump();
      camPos=vec3(p,-1.5);
      camTa=vec3(p.x,p.y-.4,0);
      camProjectionRatio=1.2;
      sceneID=3;
    }
  else if(get_shot(time,5.))
    {
      float trans=smoothstep(3.,0.,time);
      camTa=vec3(3,1.-trans*.8,0);
      camPos=vec3(5.-.1*time,1,0);
      camPos.y+=.02*verticalBump();
      headRot=vec2(0,.3);
      sceneID=3;
      camProjectionRatio=2.-smoothstep(0.,6.,time);
      camProjectionRatio=3.-time/5.;
    }
  else if(get_shot(time,10.))
    {
      vec3 shift=mix(vec3(0),vec3(-3.5,0,-3.5),smoothstep(4,6,time));
      camTa=vec3(0,1,0)+shift;
      camPos=vec3(6.-.1*time,.4,-1.-.5*time)+shift;
      wheelie=smoothstep(2.,2.3,time);
      wheelie+=wheelie*sin(time*2.)*.2;
      headRot=vec2(0,.6);
      sceneID=3;
      camProjectionRatio=2.;
      vec2 noise=valueNoise2(5e2*time);
      camTa.xy+=noise*.01;
      globalFade*=smoothstep(8.,5.,time);
    }
  else if(get_shot(time,20.))
    sceneID=3,camTa=vec3(0,1,.7),camPos=vec3(4.-.1*time,1,-3.-.5*time),headRot=vec2(0,.3),camProjectionRatio=3.,shouldDrawLogo=smoothstep(0.,1.,time)*smoothstep(10.,9.,time),globalFade=float(time<10.);
  if(sceneID==3)
    headRot.y+=sin(iTime*4.)*.1,animationSpeed=vec3(0);
  time=iTime-time;
  time=mod(time,14.)+iTime-time;
  if(sceneID==0||sceneID==2)
    time=0.;
  motoPos.xz=mix(.3*roadP2,.7*roadP1,time/20.);
}
float rect(vec2 p,vec2 size)
{
  return smoothstep(0.,8e-9,pow(max(abs(p.x)+.01-size.x,0.),4.)+pow(max(abs(p.y)+.01-size.y,0.),4.)-pow(.01,4.));
}
float base(vec2 p,float t)
{
  float col=1.;
  vec2 size=vec2(mix(0.,.06,t));
  for(float i=0.;i<4.;i++)
    for(float j=0.;j<3.;j++)
      col*=i==3.&&j==1.?
        1.:
        rect(p-vec2(i,j)*.15,size);
  return col;
}
float holes(vec2 p,float t)
{
  float col=1.;
  vec2 size=vec2(mix(0.,.0255,t));
  col=col*rect(p-vec2(.25,2)*.15,size)*rect(p-vec2(.75,1.75)*.15,size)*rect(p-vec2(1.25,1.75)*.15,size)*rect(p-vec2(2.25,1.75)*.15,size)*rect(p-vec2(3.25,2.25)*.15,size)*rect(p-vec2(0,.75)*.15,size)*rect(p-vec2(1.25)*.15,size)*rect(p-vec2(1.75,.75)*.15,size)*rect(p-vec2(2.25,.75)*.15,size)*rect(p-vec2(-.25)*.15,size)*rect(p-vec2(.25,-.25)*.15,size)*rect(p-vec2(1.25,.19)*.15,size)*rect(p-vec2(1.25,-.19)*.15,size)*rect(p-vec2(1.75,-.19)*.15,size)*rect(p-vec2(2.25,.19)*.15,size)*rect(p-vec2(2.75,-.25)*.15,size)*rect(p-vec2(3.25,-.25)*.15,size);
  return 1.-col;
}
vec3 drawLogo(vec2 uv)
{
  if(shouldDrawLogo<=0.)
    return vec3(1);
  uv=uv*.6+vec2(.25,.15);
  float t=shouldDrawLogo;
  return vec3(1.-clamp(base(uv,clamp(t*2.,0.,1.))+holes(uv,clamp(t*2.-1.,0.,1.)),0.,1.));
}
float bloom(vec3 ro,vec3 rd,vec3 lightPosition,vec3 lightDirection,float falloff)
{
  ro=motoToWorld(lightPosition,true)-ro;
  lightPosition=normalize(ro);
  float aligned=max(0.,dot(lightPosition,-motoToWorld(normalize(lightDirection),false)));
  return aligned/(1.+falloff*(1.-dot(rd,lightPosition)))/mix(1.,length(ro),.1);
}
void main()
{
  vec2 iResolution=vec2(1280,720),texCoord=gl_FragCoord.xy/iResolution.xy;
  iResolution=(texCoord*2.-1.)*vec2(1,iResolution.y/iResolution.x);
  selectShot();
  computeMotoPosition();
  vec3 cameraTarget=camTa,cameraUp=vec3(0,1,0),cameraPosition=camPos;
  if(camMotoSpace>.5)
    cameraPosition=motoToWorldForCamera(camPos),cameraTarget=motoToWorldForCamera(camTa);
  else
     cameraTarget=camTa,cameraPosition=camPos;
  cameraTarget=normalize(cameraTarget-cameraPosition);
  if(abs(dot(cameraTarget,cameraUp))>.99)
    cameraUp=vec3(1,0,0);
  vec3 cameraRight=normalize(cross(cameraTarget,cameraUp));
  cameraUp=normalize(cross(cameraRight,cameraTarget));
  iResolution*=mix(1.,length(iResolution),.1);
  cameraRight=normalize(cameraTarget*camProjectionRatio+iResolution.x*cameraRight+iResolution.y*cameraUp);
  cameraTarget=rayMarchScene(cameraPosition,cameraRight);
  if(sceneID==1||sceneID==3)
    cameraTarget+=.3*bloom(cameraPosition,cameraRight,headLightOffsetFromMotoRoot+vec3(.1,-.05,0),vec3(1,-.15,0),1e4)*5.*vec3(1,.9,.8),cameraTarget+=bloom(cameraPosition,cameraRight,breakLightOffsetFromMotoRoot,vec3(-1,-.5,0),2e4)*1.5*vec3(1,0,0);
  cameraTarget=pow(pow(cameraTarget,vec3(1./2.2)),vec3(1,1.05,1.1));
  fragColor.xyz=cameraTarget*globalFade*drawLogo(iResolution);
  fragColor/=1.+pow(length(iResolution),4.)*.6;
}

