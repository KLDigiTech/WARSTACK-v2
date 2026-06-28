import * as THREE from 'https://esm.sh/three@0.160.0';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const AnimationMixer = THREE.AnimationMixer;

const SOLDIER_MODEL_URL = '/assets/models/soldier.glb';

const DIVISION_COLORS = {
  'WARSTACK' : { primary: 0xff0000, rim: 0xff3300, bg: '#1a0000' },
  'Phantom'  : { primary: 0x9B59B6, rim: 0xb07fd4, bg: '#110d1a' },
  'Elite'    : { primary: 0x00BFFF, rim: 0x00dfff, bg: '#001a20' },
  'Veteran'  : { primary: 0xFF6600, rim: 0xff8800, bg: '#1a0d00' },
  'Soldat'   : { primary: 0x95A5A6, rim: 0xb0bfc0, bg: '#0d1112' },
  'Recruit'  : { primary: 0x607D8B, rim: 0x7a9bab, bg: '#0a0f12' },
};

const ANIMATIONS = {
  IDLE    : 'idle',
  SALUTE  : 'salute',
  VICTORY : 'victory',
  INSPECT : 'inspect',
};

export class WARSTACKAvatar {
  constructor(container, options = {}) {
    this.container   = container;
    this.options     = {
      division      : options.division    || 'Recruit',
      autoRotate    : options.autoRotate  !== false,
      mouseLook     : options.mouseLook   !== false,
      animation     : options.animation   || ANIMATIONS.IDLE,
      onLoaded      : options.onLoaded    || null,
      onError       : options.onError     || null,
    };

    this.scene       = null;
    this.camera      = null;
    this.renderer    = null;
    this.mixer       = null;
    this.model       = null;
    this.clock       = new THREE.Clock();
    this.mouse       = { x: 0, y: 0 };
    this.targetRot   = { x: 0, y: 0 };
    this.currentRot  = { x: 0, y: 0 };
    this.autoRotDir  = 1;
    this.mouseActive = false;
    this.mouseTimer  = null;
    this.slots       = {};
    this._raf        = null;
    this._destroyed  = false;

    this._init();
  }

  _init() {
    const w = this.container.clientWidth  || 320;
    const h = this.container.clientHeight || 480;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0x000000, 0.04);

    // Camera
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    this.camera.position.set(0, 1.0, 2.6);
    this.camera.lookAt(0, 0.9, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    this._setupLights();
    this._setupPlatform();
    this._setupEvents();
    this._loadModel();
    this._animate();
  }

  _getDivisionColors() {
    const div = Object.keys(DIVISION_COLORS).find(k =>
      this.options.division?.includes(k)
    ) || 'Recruit';
    return DIVISION_COLORS[div];
  }

  _setupLights() {
    const colors = this._getDivisionColors();

    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    // Key light (front-top)
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(1, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far  = 20;
    this.scene.add(key);

    // Fill light (left)
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-3, 2, 1);
    this.scene.add(fill);

    // Rim light — couleur division
    this.rimLight = new THREE.DirectionalLight(colors.primary, 1.4);
    this.rimLight.position.set(0, 1, -3);
    this.scene.add(this.rimLight);

    // Ground bounce
    const bounce = new THREE.DirectionalLight(colors.primary, 0.3);
    bounce.position.set(0, -2, 1);
    this.scene.add(bounce);

    // Point light sous le socle
    this.glowLight = new THREE.PointLight(colors.primary, 0.8, 3);
    this.glowLight.position.set(0, 0.1, 0);
    this.scene.add(this.glowLight);
  }

  _setupPlatform() {
    const colors = this._getDivisionColors();

    // Socle
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 0.04, 64);
    const mat = new THREE.MeshStandardMaterial({
      color       : colors.primary,
      metalness   : 0.9,
      roughness   : 0.15,
      emissive    : new THREE.Color(colors.primary),
      emissiveIntensity: 0.3,
    });
    this.platform = new THREE.Mesh(geo, mat);
    this.platform.position.y = 0;
    this.platform.receiveShadow = true;
    this.scene.add(this.platform);

    // Ring glow
    const ringGeo = new THREE.TorusGeometry(0.72, 0.015, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color    : colors.primary,
      emissive : new THREE.Color(colors.primary),
      emissiveIntensity: 1.2,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.02;
    this.scene.add(this.ring);

    // Particules autour du socle
    this._setupParticles(colors.primary);
  }

  _setupParticles(color) {
    const count  = 60;
    const geo    = new THREE.BufferGeometry();
    const pos    = new Float32Array(count * 3);
    const radius = 1.2;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r     = radius + (Math.random() - 0.5) * 0.4;
      pos[i * 3]     = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.random() * 2.5;
      pos[i * 3 + 2] = Math.sin(angle) * r;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color       : color,
      size        : 0.02,
      transparent : true,
      opacity     : 0.6,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
    this._particlePos = pos;
    this._particleCount = count;
  }

  _loadModel() {
    const loader = new GLTFLoader();

    // Placeholder — silhouette militaire procédurale en attendant le vrai GLB
    this._buildPlaceholderSoldier();

    // Dès que SOLDIER_MODEL_URL pointe un vrai fichier, décommente :
    // loader.load(
    //   SOLDIER_MODEL_URL,
    //   (gltf) => this._onModelLoaded(gltf),
    //   (progress) => {},
    //   (err) => { if (this.options.onError) this.options.onError(err); }
    // );
  }

  _buildPlaceholderSoldier() {
    const colors  = this._getDivisionColors();
    const group   = new THREE.Group();
    const primary = new THREE.Color(colors.primary);

    // Matériaux
    const matOf = (hex, metal = 0.3, rough = 0.7, emissive = null, emInt = 0) => {
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), metalness: metal, roughness: rough });
      if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emInt; }
      return m;
    };

    const MAT = {
      skin    : matOf(0x8a6a50),
      olive   : matOf(0x3a4228, 0.1, 0.85),
      dark    : matOf(0x1c1c1c, 0.5, 0.5),
      vest    : matOf(0x2a2e1e, 0.3, 0.7),
      boot    : matOf(0x141414, 0.6, 0.4),
      helmet  : matOf(colors.primary, 0.55, 0.4, colors.primary, 0.15),
      metal   : matOf(0x222222, 0.85, 0.15),
      glow    : matOf(colors.primary, 0.2, 0.3, colors.primary, 0.8),
      glove   : matOf(0x111111, 0.4, 0.6),
    };

    const mesh = (geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.rotation.set(rx, ry, rz);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      return m;
    };

    // ── TORSO ── (centre à y=1.15, hauteur 0.52)
    const torso = new THREE.Group();
    // Corps principal
    torso.add(mesh(new THREE.BoxGeometry(0.36, 0.50, 0.20), MAT.olive, 0, 0, 0));
    // Gilet tactique (légèrement plus large + devant)
    torso.add(mesh(new THREE.BoxGeometry(0.38, 0.34, 0.08), MAT.vest, 0, 0.06, 0.12));
    // Poches gilet gauche/droite
    torso.add(mesh(new THREE.BoxGeometry(0.10, 0.09, 0.07), MAT.vest, -0.14, 0.10, 0.16));
    torso.add(mesh(new THREE.BoxGeometry(0.10, 0.09, 0.07), MAT.vest,  0.14, 0.10, 0.16));
    // Ceinture
    torso.add(mesh(new THREE.BoxGeometry(0.37, 0.05, 0.22), MAT.dark, 0, -0.24, 0));
    torso.position.set(0, 1.15, 0);
    group.add(torso);

    // ── PELVIS ──
    group.add(mesh(new THREE.BoxGeometry(0.34, 0.14, 0.20), MAT.olive, 0, 0.82, 0));

    // ── LEGS ── (pivot en haut de la jambe)
    const legGeo  = new THREE.BoxGeometry(0.155, 0.40, 0.175);
    const shinGeo = new THREE.BoxGeometry(0.135, 0.36, 0.155);
    const bootGeo = new THREE.BoxGeometry(0.155, 0.16, 0.210);
    const kneeGeo = new THREE.BoxGeometry(0.160, 0.09, 0.185);

    [-0.10, 0.10].forEach(x => {
      group.add(mesh(legGeo,  MAT.olive, x, 0.56, 0));
      group.add(mesh(kneeGeo, MAT.dark,  x, 0.37, 0.005));
      group.add(mesh(shinGeo, MAT.olive, x, 0.18, 0));
      group.add(mesh(bootGeo, MAT.boot,  x, 0.06, 0.018));
    });

    // ── ARMS ── (légèrement en angle)
    const upArmGeo  = new THREE.BoxGeometry(0.125, 0.36, 0.125);
    const foreGeo   = new THREE.BoxGeometry(0.110, 0.30, 0.110);
    const gloveGeo  = new THREE.BoxGeometry(0.105, 0.10, 0.105);

    // Bras gauche
    const lArm = new THREE.Group();
    lArm.add(mesh(upArmGeo, MAT.olive, 0, 0, 0));
    lArm.add(mesh(foreGeo,  MAT.olive, 0, -0.32, 0));
    lArm.add(mesh(gloveGeo, MAT.glove, 0, -0.48, 0));
    lArm.position.set(-0.25, 1.12, 0);
    lArm.rotation.z =  0.10;
    lArm.rotation.x =  0.08;
    group.add(lArm);

    // Bras droit (tient l'arme — légèrement avancé)
    const rArm = new THREE.Group();
    rArm.add(mesh(upArmGeo, MAT.olive, 0, 0, 0));
    rArm.add(mesh(foreGeo,  MAT.olive, 0, -0.32, 0));
    rArm.add(mesh(gloveGeo, MAT.glove, 0, -0.48, 0));
    rArm.position.set(0.25, 1.12, 0);
    rArm.rotation.z = -0.10;
    rArm.rotation.x =  0.15;
    group.add(rArm);

    // ── NECK ──
    group.add(mesh(new THREE.CylinderGeometry(0.065, 0.080, 0.095, 10), MAT.skin, 0, 1.42, 0));

    // ── HEAD ──
    const head = new THREE.Group();

    // Cagoule / balaclava
    head.add(mesh(new THREE.BoxGeometry(0.235, 0.145, 0.230), MAT.dark, 0, -0.065, 0));
    // Visage (zone découverte — yeux)
    head.add(mesh(new THREE.BoxGeometry(0.200, 0.100, 0.200), MAT.skin, 0, 0.010, 0.025));
    // Crâne
    head.add(mesh(new THREE.BoxGeometry(0.230, 0.140, 0.215), MAT.dark, 0, 0.080, 0));

    // Casque tactique — sphère aplatie
    const helmetGeo = new THREE.SphereGeometry(0.148, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
    head.add(mesh(helmetGeo, MAT.helmet, 0, 0.075, 0));
    // Bord casque
    head.add(mesh(new THREE.CylinderGeometry(0.155, 0.148, 0.022, 20, 1, true, 0, Math.PI * 1.6), MAT.helmet, 0, 0.022, 0.01));
    // Rail picatinny casque (dessus)
    head.add(mesh(new THREE.BoxGeometry(0.030, 0.028, 0.175), MAT.metal, 0, 0.172, 0.005));
    // NVG mount
    head.add(mesh(new THREE.BoxGeometry(0.055, 0.035, 0.040), MAT.metal, 0, 0.140, 0.140));
    // NVG tubes
    [-0.020, 0.020].forEach(x => {
      head.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.060, 8), MAT.dark, x, 0.132, 0.172, Math.PI / 2, 0, 0));
    });
    // Patch division lumineux (côté casque)
    head.add(mesh(new THREE.BoxGeometry(0.006, 0.040, 0.040), MAT.glow, -0.152, 0.115, 0.020));

    head.position.set(0, 1.525, 0);
    this.headGroup = head;
    group.add(head);

    // ── WEAPON (M4 stylisé) ──
    const weapon = new THREE.Group();
    // Receiver / corps
    weapon.add(mesh(new THREE.BoxGeometry(0.052, 0.055, 0.420), MAT.metal, 0, 0, 0));
    // Poignée pistolet
    weapon.add(mesh(new THREE.BoxGeometry(0.035, 0.130, 0.048), MAT.dark, 0.008, -0.085, 0.090, 0.22, 0, 0));
    // Chargeur
    weapon.add(mesh(new THREE.BoxGeometry(0.034, 0.140, 0.058), MAT.dark, 0, -0.094, 0.040, 0.08, 0, 0));
    // Rail & garde-main
    weapon.add(mesh(new THREE.BoxGeometry(0.044, 0.042, 0.190), MAT.metal, 0, 0.010, -0.160));
    // Canon
    weapon.add(mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.220, 8), MAT.metal, 0, 0.010, -0.310, Math.PI / 2, 0, 0));
    // Suppresseur
    weapon.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.080, 8), MAT.dark, 0, 0.010, -0.420, Math.PI / 2, 0, 0));
    // Viseur holographique
    weapon.add(mesh(new THREE.BoxGeometry(0.038, 0.042, 0.058), MAT.metal, 0, 0.052, 0.010));
    weapon.add(mesh(new THREE.BoxGeometry(0.002, 0.002, 0.002), MAT.glow,  0, 0.072, -0.012));

    weapon.rotation.set(0.18, 0, 0.14);
    weapon.position.set(0.245, 0.84, 0.145);
    group.add(weapon);

    group.position.set(0, 0.04, 0);
    this.scene.add(group);
    this.model      = group;
    this.bodyGroup  = group;
    this._idlePhase = 0;

    if (this.options.onLoaded) this.options.onLoaded();
  }

  _onModelLoaded(gltf) {
    if (this._destroyed) return;

    this.model = gltf.scene;
    this.model.position.y = 0.04;
    this.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(this.model);

    if (gltf.animations?.length) {
      this.mixer = new THREE.AnimationMixer(this.model);
      const clip = THREE.AnimationClip.findByName(gltf.animations, this.options.animation)
                || gltf.animations[0];
      if (clip) this.mixer.clipAction(clip).play();
    }

    if (this.options.onLoaded) this.options.onLoaded();
  }

  _setupEvents() {
    this._onMouseMove  = this._handleMouseMove.bind(this);
    this._onTouchMove  = this._handleTouchMove.bind(this);
    this._onResize     = this._handleResize.bind(this);

    this.container.addEventListener('mousemove',  this._onMouseMove);
    this.container.addEventListener('touchmove',  this._onTouchMove, { passive: true });
    window.addEventListener('resize', this._onResize);
  }

  _handleMouseMove(e) {
    const rect  = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    this.mouse.y = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
    this.mouseActive = true;
    clearTimeout(this.mouseTimer);
    this.mouseTimer = setTimeout(() => { this.mouseActive = false; }, 2000);
  }

  _handleTouchMove(e) {
    if (!e.touches[0]) return;
    const rect  = this.container.getBoundingClientRect();
    this.mouse.x = ((e.touches[0].clientX - rect.left) / rect.width  - 0.5) * 2;
    this.mouse.y = ((e.touches[0].clientY - rect.top)  / rect.height - 0.5) * 2;
    this.mouseActive = true;
  }

  _handleResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    if (this._destroyed) return;
    this._raf = requestAnimationFrame(() => this._animate());

    const delta = this.clock.getDelta();
    const time  = this.clock.getElapsedTime();

    if (this.mixer) this.mixer.update(delta);

    // Idle breathing
    this._idlePhase = (this._idlePhase || 0) + delta;
    if (this.model) {
      const breathY  = Math.sin(this._idlePhase * 1.2) * 0.008;
      const breathRz = Math.sin(this._idlePhase * 0.8) * 0.004;
      this.model.position.y = 0.04 + breathY;
      this.model.rotation.z = breathRz;
    }

    // Tête mouse look
    if (this.headGroup) {
      const targetX = this.mouseActive ? -this.mouse.y * 0.18 : 0;
      const targetY = this.mouseActive ?  this.mouse.x * 0.25 : Math.sin(time * 0.4) * 0.05;
      this.headGroup.rotation.x += (targetX - this.headGroup.rotation.x) * 0.06;
      this.headGroup.rotation.y += (targetY - this.headGroup.rotation.y) * 0.06;
    }

    // Auto-rotation body (si souris inactive)
    if (this.model) {
      if (!this.mouseActive && this.options.autoRotate) {
        this.model.rotation.y += delta * 0.4 * this.autoRotDir;
        if (Math.abs(this.model.rotation.y) > 0.6) this.autoRotDir *= -1;
      } else if (this.mouseActive) {
        this.targetRot.y = this.mouse.x * 0.5;
        this.model.rotation.y += (this.targetRot.y - this.model.rotation.y) * 0.08;
      }
    }

    // Ring pulse
    if (this.ring) {
      this.ring.material.emissiveIntensity = 0.8 + Math.sin(time * 2) * 0.4;
    }
    if (this.glowLight) {
      this.glowLight.intensity = 0.6 + Math.sin(time * 1.5) * 0.2;
    }

    // Particules flottantes
    if (this.particles && this._particlePos) {
      const pos = this._particlePos;
      for (let i = 0; i < this._particleCount; i++) {
        pos[i * 3 + 1] += delta * (0.15 + (i % 5) * 0.04);
        if (pos[i * 3 + 1] > 3.0) pos[i * 3 + 1] = 0;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  setDivision(division) {
    this.options.division = division;
    const colors = this._getDivisionColors();
    if (this.rimLight)  this.rimLight.color.setHex(colors.primary);
    if (this.glowLight) this.glowLight.color.setHex(colors.primary);
    if (this.ring)      { this.ring.material.color.setHex(colors.primary); this.ring.material.emissive.setHex(colors.primary); }
    if (this.platform)  { this.platform.material.color.setHex(colors.primary); this.platform.material.emissive.setHex(colors.primary); }
    if (this.particles) this.particles.material.color.setHex(colors.primary);
  }

  // Remplace le modèle sans toucher au reste
  loadModel(url) {
    const loader = new GLTFLoader();
    if (this.model) { this.scene.remove(this.model); this.model = null; }
    loader.load(url, (gltf) => this._onModelLoaded(gltf));
  }

  // Équipe un slot (helmet, uniform, vest...)
  equipSlot(slot, meshUrl, color) {
    this.slots[slot] = { meshUrl, color };
    // TODO: remplacer le mesh du slot correspondant sur le modèle
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    this.container.removeEventListener('mousemove', this._onMouseMove);
    this.container.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('resize', this._onResize);
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

export { ANIMATIONS, DIVISION_COLORS };