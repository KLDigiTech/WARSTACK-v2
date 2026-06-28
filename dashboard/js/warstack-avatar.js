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
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 1.4, 3.2);
    this.camera.lookAt(0, 1.0, 0);

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
    const dark    = new THREE.Color(0x1a1a1a);
    const olive   = new THREE.Color(0x3d4a2a);
    const metal   = new THREE.Color(0x2a2a2a);

    const mat = (c, metalness = 0.3, roughness = 0.7) => new THREE.MeshStandardMaterial({
      color: c, metalness, roughness
    });

    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };

    // ── Corps ──
    add(new THREE.BoxGeometry(0.42, 0.54, 0.22), mat(olive),           0,    1.08,  0);
    // Gilet tactique
    add(new THREE.BoxGeometry(0.44, 0.30, 0.26), mat(dark, 0.4, 0.6), 0,    1.22,  0);
    // Poches gilet
    add(new THREE.BoxGeometry(0.12, 0.10, 0.14), mat(dark, 0.3, 0.7), -0.16, 1.30, 0.13);
    add(new THREE.BoxGeometry(0.12, 0.10, 0.14), mat(dark, 0.3, 0.7),  0.16, 1.30, 0.13);

    // ── Bassin / Jambes ──
    add(new THREE.BoxGeometry(0.40, 0.16, 0.20), mat(olive),           0,    0.78,  0);
    add(new THREE.BoxGeometry(0.17, 0.44, 0.18), mat(olive),          -0.12, 0.44,  0);
    add(new THREE.BoxGeometry(0.17, 0.44, 0.18), mat(olive),           0.12, 0.44,  0);
    // Genouillères
    add(new THREE.BoxGeometry(0.19, 0.10, 0.20), mat(dark, 0.5, 0.5), -0.12, 0.38, 0.01);
    add(new THREE.BoxGeometry(0.19, 0.10, 0.20), mat(dark, 0.5, 0.5),  0.12, 0.38, 0.01);
    // Bottes
    add(new THREE.BoxGeometry(0.18, 0.18, 0.22), mat(dark, 0.6, 0.4), -0.12, 0.12, 0.02);
    add(new THREE.BoxGeometry(0.18, 0.18, 0.22), mat(dark, 0.6, 0.4),  0.12, 0.12, 0.02);

    // ── Bras ──
    // Bras gauche
    add(new THREE.BoxGeometry(0.13, 0.38, 0.13), mat(olive),          -0.28, 1.06, 0, 0.15, 0, -0.08);
    add(new THREE.BoxGeometry(0.11, 0.30, 0.11), mat(dark, 0.3, 0.6), -0.30, 0.72, 0, 0.10, 0, -0.05);
    // Bras droit
    add(new THREE.BoxGeometry(0.13, 0.38, 0.13), mat(olive),           0.28, 1.06, 0, 0.15, 0,  0.08);
    add(new THREE.BoxGeometry(0.11, 0.30, 0.11), mat(dark, 0.3, 0.6),  0.30, 0.72, 0, 0.10, 0,  0.05);
    // Gants
    add(new THREE.BoxGeometry(0.11, 0.10, 0.11), mat(dark, 0.5, 0.5), -0.31, 0.56, 0);
    add(new THREE.BoxGeometry(0.11, 0.10, 0.11), mat(dark, 0.5, 0.5),  0.31, 0.56, 0);

    // ── Cou ──
    add(new THREE.CylinderGeometry(0.07, 0.09, 0.10, 8), mat(new THREE.Color(0x8a6a50)), 0, 1.37, 0);

    // ── Tête ──
    const head = new THREE.Group();
    // Visage
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.28, 0.24),
      mat(new THREE.Color(0x8a6a50))
    );
    face.castShadow = true;
    head.add(face);
    // Balaclava / cagoule bas
    const bala = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.16, 0.26),
      mat(dark)
    );
    bala.position.y = -0.07;
    head.add(bala);

    // ── Casque tactique ──
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65),
      mat(primary, 0.5, 0.4)
    );
    helmet.position.y = 0.06;
    head.add(helmet);
    // Rail casque
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.22),
      mat(metal, 0.8, 0.2)
    );
    rail.position.set(0, 0.12, 0.09);
    head.add(rail);
    // Lunettes NVG placeholder
    const nvg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8),
      mat(new THREE.Color(0x003300), 0.2, 0.1)
    );
    nvg.rotation.x = Math.PI / 2;
    nvg.position.set(0, 0.06, 0.16);
    head.add(nvg);

    // Patch division sur casque
    const patchMat = new THREE.MeshStandardMaterial({
      color    : primary,
      emissive : primary,
      emissiveIntensity: 0.6,
    });
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), patchMat);
    patch.position.set(0.14, 0.08, 0.10);
    patch.rotation.y = -0.6;
    head.add(patch);

    head.position.set(0, 1.50, 0);
    group.add(head);
    this.headGroup = head;

    // ── Arme (M4 stylisé) ──
    const weapon = new THREE.Group();
    // Corps arme
    weapon.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.50), mat(metal, 0.8, 0.2)), { castShadow: true }));
    // Chargeur
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.06), mat(dark, 0.6, 0.3));
    mag.position.set(0, -0.09, 0.06);
    weapon.add(mag);
    // Canon
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 8), mat(metal, 0.9, 0.1));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.34);
    weapon.add(barrel);
    // Viseur
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), mat(new THREE.Color(0x1a1a1a), 0.7, 0.2));
    sight.position.set(0, 0.05, 0.06);
    weapon.add(sight);

    weapon.rotation.set(0.2, 0, 0.2);
    weapon.position.set(0.28, 0.88, 0.14);
    group.add(weapon);

    group.position.y = 0.04;
    this.scene.add(group);
    this.model = group;

    // Référence pour animation idle
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