
const s = {
  prev:null,
  config:null,
  mixer:null,
  clock:null
};

const $ = q => document.querySelector(q);

function msg(text,type="agent"){
  const d=document.createElement("div");
  d.className=`msg ${type}`;
  d.textContent=text;
  $("#messages").appendChild(d);
  $("#messages").scrollTop=$("#messages").scrollHeight;
  return d;
}

function speak(text){
  if(!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const voices=speechSynthesis.getVoices();
  const preferred=[
    "Microsoft Elvira",
    "Microsoft Dalia",
    "Microsoft Alvaro",
    "Google español"
  ];

  let voice=null;

  for(const name of preferred){
    voice=voices.find(v =>
      v.name.toLowerCase().includes(name.toLowerCase())
    );
    if(voice) break;
  }

  if(!voice){
    voice=voices.find(v =>
      v.lang?.toLowerCase().startsWith("es")
    );
  }

  const u=new SpeechSynthesisUtterance(text);

  if(voice) u.voice=voice;

  u.lang=voice?.lang || "es-ES";
  u.rate=.95;
  u.pitch=1;
  u.volume=1;

  speechSynthesis.speak(u);
}

async function config(){
  const r=await fetch("/api/config");
  s.config=await r.json();

  document.documentElement.style.setProperty(
    "--accent",
    s.config.accent || "#7c3aed"
  );

  ["name","role","brand","audience","tagline"].forEach(k=>{
    $("#"+k).textContent=s.config[k];
  });

  $("#chatName").textContent=s.config.name;

  s.config.capabilities.forEach(x=>{
    const li=document.createElement("li");
    li.textContent=x;
    $("#capabilities").appendChild(li);
  });

  s.config.limits.forEach(x=>{
    const li=document.createElement("li");
    li.textContent=x;
    $("#limits").appendChild(li);
  });

  msg(s.config.welcome);
}

async function init3D(){
  try{
    const THREE=await import(
      "https://cdn.jsdelivr.net/npm/three@0.180.0/+esm"
    );

    const {FBXLoader}=await import(
      "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js/+esm"
    );

    const {OrbitControls}=await import(
      "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js/+esm"
    );

    const v=$("#viewer");

    const scene=new THREE.Scene();

    const camera=new THREE.PerspectiveCamera(
      35,
      v.clientWidth/v.clientHeight,
      .1,
      1000
    );

    // Más cercano y centrado para que el avatar gane presencia.
    camera.position.set(0,1.38,4.15);

    const renderer=new THREE.WebGLRenderer({
      antialias:true,
      alpha:true
    });

    renderer.setSize(v.clientWidth,v.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;

    v.appendChild(renderer.domElement);

    scene.add(
      new THREE.HemisphereLight(
        0xffffff,
        0x111122,
        3
      )
    );

    const light=new THREE.DirectionalLight(
      0xffffff,
      4
    );

    light.position.set(2,4,3);
    scene.add(light);

    const controls=new OrbitControls(
      camera,
      renderer.domElement
    );

    controls.enableDamping=true;
    controls.target.set(0,1.20,0);
    controls.enablePan=false;
    controls.minDistance=2.7;
    controls.maxDistance=5.2;

    s.clock=new THREE.Clock();

    new FBXLoader().load(
      "./avatar.fbx",

      o=>{
        // Un poco más grande que la versión anterior.
        o.scale.setScalar(.0098);

        const box=new THREE.Box3().setFromObject(o);
        const center=box.getCenter(new THREE.Vector3());

        o.position.x-=center.x;
        o.position.z-=center.z;

        // Apoyar el modelo y bajarlo apenas para que se sienta menos flotante.
        o.position.y-=box.min.y;
        o.position.y-=.05;

        scene.add(o);

        if(o.animations?.length){
          s.mixer=new THREE.AnimationMixer(o);
          s.mixer.clipAction(o.animations[0]).play();
        }

        $("#loader").style.display="none";
      },

      undefined,

      ()=>{
        $("#loader").style.display="none";
        $("#fallback").style.display="grid";
      }
    );

    function loop(){
      requestAnimationFrame(loop);

      if(s.mixer){
        s.mixer.update(s.clock.getDelta());
      }

      controls.update();
      renderer.render(scene,camera);
    }

    loop();

    new ResizeObserver(()=>{
      camera.aspect=v.clientWidth/v.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        v.clientWidth,
        v.clientHeight
      );
    }).observe(v);

  }catch(e){
    console.error(e);
    $("#loader").style.display="none";
    $("#fallback").style.display="grid";
  }
}

$("#form").addEventListener("submit",async e=>{
  e.preventDefault();

  const input=$("#input");
  const text=input.value.trim();

  if(!text) return;

  msg(text,"user");
  input.value="";

  const wait=msg(
    `${s.config.name} está pensando...`,
    "system"
  );

  try{
    const r=await fetch("/api/chat",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        message:text,
        previousResponseId:s.prev
      })
    });

    const d=await r.json();

    wait.remove();

    if(!r.ok){
      msg(d.error || "Error","system");
      return;
    }

    s.prev=d.id;
    msg(d.text);
    speak(d.text);

  }catch(err){
    wait.remove();
    msg(
      "No pude conectar con el servidor.",
      "system"
    );
  }
});

$("#reset").addEventListener("click",()=>{
  s.prev=null;
  $("#messages").innerHTML="";
  msg(s.config.welcome);
});

await config();
init3D();
