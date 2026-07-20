import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  BOOK_OPENING_DURATION_MS,
  getBookSettleProgress,
  getBookSpreadIndex,
  getIconBookRevealProgress,
  getIconBookTransitionPose,
  getIconMarkOpacity,
  getPageTurnProgress
} from '../bookMotion';
import {
  BOOK_PAGE_TEXTURE_HEIGHT,
  BOOK_PAGE_TEXTURE_WIDTH,
  createBookArtworkDeck,
  drawBookPageArtwork,
  traceBookIconPage,
  type BookPageArtwork,
  type BookPageSide
} from '../bookPageArtwork';

type RecommendationBookPhase = 'opening' | 'message' | 'ready';

interface RecommendationBookSceneProps {
  artworkSeed: string;
  phase: RecommendationBookPhase;
}

interface PageSurface {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

const PAGE_WIDTH = 1.34;
const PAGE_TEXTURE_SCALE = 2;
const PAGE_HEIGHT = 1.92;
const CAMERA_VIEW_HEIGHT = 3.2;

function createPageSurface(): PageSurface {
  const canvas = document.createElement('canvas');
  canvas.width = BOOK_PAGE_TEXTURE_WIDTH * PAGE_TEXTURE_SCALE;
  canvas.height = BOOK_PAGE_TEXTURE_HEIGHT * PAGE_TEXTURE_SCALE;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  context.setTransform(PAGE_TEXTURE_SCALE, 0, 0, PAGE_TEXTURE_SCALE, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, context, texture };
}

function updatePageSurface(
  surface: PageSurface,
  artwork: BookPageArtwork
): void {
  drawBookPageArtwork(surface.context, artwork);
  surface.texture.needsUpdate = true;
}

function createBookMarkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#e8bd5f';
  context.fillStyle = '#f4d47a';
  context.lineWidth = 13;
  context.shadowColor = 'rgba(229, 178, 72, 0.62)';
  context.shadowBlur = 18;

  const drawPage = (direction: -1 | 1) => {
    const x = (value: number) => 360 + value * direction;
    context.beginPath();
    context.moveTo(x(12), 235);
    context.bezierCurveTo(x(72), 176, x(188), 145, x(274), 164);
    context.lineTo(x(292), 373);
    context.bezierCurveTo(x(188), 350, x(78), 386, x(12), 432);
    context.lineTo(x(12), 235);
    context.stroke();

    context.beginPath();
    context.moveTo(x(12), 452);
    context.bezierCurveTo(x(106), 407, x(208), 398, x(312), 421);
    context.lineTo(x(292), 190);
    context.stroke();
  };
  drawPage(-1);
  drawPage(1);

  context.beginPath();
  context.moveTo(360, 254);
  context.lineTo(360, 424);
  context.stroke();

  context.beginPath();
  context.moveTo(360, 50);
  context.bezierCurveTo(368, 94, 374, 102, 424, 112);
  context.bezierCurveTo(374, 120, 368, 130, 360, 178);
  context.bezierCurveTo(352, 130, 346, 120, 296, 112);
  context.bezierCurveTo(346, 102, 352, 94, 360, 50);
  context.closePath();
  context.fill();

  context.shadowBlur = 10;
  context.lineWidth = 10;
  context.beginPath();
  context.moveTo(246, 82);
  context.lineTo(268, 104);
  context.moveTo(474, 82);
  context.lineTo(452, 104);
  context.stroke();
  context.beginPath();
  context.arc(360, 24, 7, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createBackingTexture(side: BookPageSide): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  traceBookIconPage(context, side);
  context.fillStyle = '#101115';
  context.fill();
  context.strokeStyle = '#c79b49';
  context.lineWidth = 6;
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createSparkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255, 248, 213, 1)');
  glow.addColorStop(0.16, 'rgba(255, 224, 146, 0.92)');
  glow.addColorStop(0.48, 'rgba(224, 174, 83, 0.26)');
  glow.addColorStop(1, 'rgba(224, 174, 83, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHoverGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  const glow = context.createRadialGradient(128, 64, 0, 128, 64, 118);
  glow.addColorStop(0, 'rgba(213, 174, 91, 0.22)');
  glow.addColorStop(0.46, 'rgba(118, 95, 52, 0.1)');
  glow.addColorStop(1, 'rgba(30, 32, 38, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCircleLine(radius: number, material: THREE.LineBasicMaterial) {
  const points = Array.from({ length: 64 }, (_, index) => {
    const angle = (index / 64) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  });
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

function createArcaneBadge(
  primaryMaterial: THREE.LineBasicMaterial,
  detailMaterial: THREE.LineBasicMaterial
) {
  const field = new THREE.Group();
  const rotor = new THREE.Group();

  field.add(createCircleLine(1.56, primaryMaterial));
  field.add(createCircleLine(1.31, detailMaterial));

  const tickPoints: THREE.Vector3[] = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const innerRadius = index % 3 === 0 ? 1.08 : 1.14;
    tickPoints.push(
      new THREE.Vector3(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius, 0),
      new THREE.Vector3(Math.cos(angle) * 1.24, Math.sin(angle) * 1.24, 0)
    );
  }
  rotor.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(tickPoints),
      detailMaterial
    )
  );

  field.add(rotor);
  return { field, rotor };
}

function createFourPointStarGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.23);
  shape.lineTo(0.032, 0.04);
  shape.lineTo(0.17, 0);
  shape.lineTo(0.032, -0.04);
  shape.lineTo(0, -0.23);
  shape.lineTo(-0.032, -0.04);
  shape.lineTo(-0.17, 0);
  shape.lineTo(-0.032, 0.04);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function createPageGeometry(side: 'left' | 'right'): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, 1, 1);
  geometry.translate(side === 'left' ? -PAGE_WIDTH / 2 : PAGE_WIDTH / 2, 0, 0);
  return geometry;
}

function createPageTransitionMaterial(
  currentTexture: THREE.Texture,
  nextTexture: THREE.Texture,
  side: BookPageSide
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthWrite: false,
    fragmentShader: `
      uniform sampler2D uCurrentMap;
      uniform sampler2D uNextMap;
      uniform float uProgress;
      uniform float uSide;
      varying vec2 vUv;

      void main() {
        float globalX = mix(vUv.x * 0.5, 0.5 + vUv.x * 0.5, uSide);
        float sweepEdge = mix(1.08, -0.08, uProgress);
        float sweepWidth = 0.018;
        float pageArc = sin(vUv.y * 3.14159265);
        float curvedEdge = sweepEdge + (1.0 - pageArc) * 0.022;
        float reveal = smoothstep(
          curvedEdge - sweepWidth,
          curvedEdge + sweepWidth,
          globalX
        );
        float edgeDistance = abs(globalX - curvedEdge);
        float curl = 1.0 - smoothstep(0.0, sweepWidth * 2.2, edgeDistance);
        float edgeHighlight = 1.0 - smoothstep(
          0.0,
          sweepWidth * 0.34,
          edgeDistance
        );

        vec2 currentUv = vUv;
        vec2 nextUv = vUv;
        currentUv.x += curl * pageArc * 0.008;
        nextUv.x -= curl * pageArc * 0.006;

        vec4 currentColor = texture2D(uCurrentMap, currentUv);
        vec4 nextColor = texture2D(uNextMap, nextUv);
        vec4 color = mix(currentColor, nextColor, reveal);
        color.rgb *= 1.0 - curl * 0.14;
        color.rgb += vec3(0.44, 0.29, 0.08) * edgeHighlight * 0.38;

        if (color.a < 0.02) {
          discard;
        }
        gl_FragColor = color;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    transparent: true,
    uniforms: {
      uCurrentMap: { value: currentTexture },
      uNextMap: { value: nextTexture },
      uProgress: { value: 0 },
      uSide: { value: side === 'left' ? 0 : 1 }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `
  });
}

export function RecommendationBookScene({ artworkSeed, phase }: RecommendationBookSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<RecommendationBookPhase>(phase);
  const openingStartedAtRef = useRef(0);
  const contentStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const now = performance.now();
    phaseRef.current = phase;
    if (phase === 'opening') {
      openingStartedAtRef.current = now;
      contentStartedAtRef.current = null;
    } else if (phase === 'message' && contentStartedAtRef.current === null) {
      contentStartedAtRef.current = now;
    } else if (phase === 'ready' && contentStartedAtRef.current === null) {
      contentStartedAtRef.current = now;
    }
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) {
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -CAMERA_VIEW_HEIGHT / 2,
      CAMERA_VIEW_HEIGHT / 2,
      CAMERA_VIEW_HEIGHT / 2,
      -CAMERA_VIEW_HEIGHT / 2,
      0.1,
      100
    );
    camera.position.set(0, 0.02, 5);
    camera.lookAt(0, 0, 0);

    const arcanePrimaryMaterial = new THREE.LineBasicMaterial({
      color: 0xc79b49,
      depthWrite: false,
      opacity: 0.18,
      transparent: true
    });
    const arcaneDetailMaterial = new THREE.LineBasicMaterial({
      color: 0x81718f,
      depthWrite: false,
      opacity: 0.14,
      transparent: true
    });
    const { field: arcaneField, rotor: arcaneRotor } = createArcaneBadge(
      arcanePrimaryMaterial,
      arcaneDetailMaterial
    );
    arcaneField.position.set(0, 0.02, -0.16);
    arcaneField.rotation.z = -0.12;
    scene.add(arcaneField);

    const root = new THREE.Group();
    root.position.y = -0.02;
    scene.add(root);

    const bookMarkTexture = createBookMarkTexture();
    const leftBackingTexture = createBackingTexture('left');
    const rightBackingTexture = createBackingTexture('right');
    const sparkTexture = createSparkTexture();
    const hoverGlowTexture = createHoverGlowTexture();
    const leftSurface = createPageSurface();
    const rightSurface = createPageSurface();
    const nextLeftSurface = createPageSurface();
    const nextRightSurface = createPageSurface();
    const artworkDeck = createBookArtworkDeck(artworkSeed);
    const firstNextArtwork = artworkDeck[1 % artworkDeck.length];
    updatePageSurface(leftSurface, artworkDeck[0].left);
    updatePageSurface(rightSurface, artworkDeck[0].right);
    updatePageSurface(nextLeftSurface, firstNextArtwork.left);
    updatePageSurface(nextRightSurface, firstNextArtwork.right);

    const bookMarkMaterial = new THREE.MeshBasicMaterial({
      alphaTest: 0.08,
      depthWrite: false,
      map: bookMarkTexture,
      opacity: 1,
      transparent: true
    });
    const leftBackingMaterial = new THREE.MeshBasicMaterial({
      alphaTest: 0.08,
      depthWrite: false,
      map: leftBackingTexture,
      transparent: true
    });
    const rightBackingMaterial = new THREE.MeshBasicMaterial({
      alphaTest: 0.08,
      depthWrite: false,
      map: rightBackingTexture,
      transparent: true
    });
    const leftPageMaterial = createPageTransitionMaterial(
      leftSurface.texture,
      nextLeftSurface.texture,
      'left'
    );
    const rightPageMaterial = createPageTransitionMaterial(
      rightSurface.texture,
      nextRightSurface.texture,
      'right'
    );

    const bookMark = new THREE.Mesh(
      new THREE.PlaneGeometry(PAGE_WIDTH * 1.74, PAGE_HEIGHT * 1.24),
      bookMarkMaterial
    );
    bookMark.position.set(0, 0.02, 0.08);
    root.add(bookMark);

    const leftWing = new THREE.Group();
    const leftBacking = new THREE.Mesh(
      createPageGeometry('left'),
      leftBackingMaterial
    );
    leftBacking.position.set(0, -0.035, -0.025);
    leftBacking.scale.set(1.012, 1.012, 1);
    const leftPage = new THREE.Mesh(createPageGeometry('left'), leftPageMaterial);
    leftPage.position.z = 0.01;
    leftWing.add(leftBacking, leftPage);
    root.add(leftWing);

    const rightWing = new THREE.Group();
    const rightBacking = new THREE.Mesh(
      createPageGeometry('right'),
      rightBackingMaterial
    );
    rightBacking.position.set(0, -0.035, -0.025);
    rightBacking.scale.set(1.012, 1.012, 1);
    const rightPage = new THREE.Mesh(createPageGeometry('right'), rightPageMaterial);
    rightPage.position.z = 0.01;
    rightWing.add(rightBacking, rightPage);
    root.add(rightWing);

    const foldMaterial = new THREE.LineBasicMaterial({
      color: 0xc79b49,
      depthWrite: false,
      opacity: 0.8,
      transparent: true
    });
    const centerFold = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, PAGE_HEIGHT * 0.29, 0.04),
        new THREE.Vector3(0, -PAGE_HEIGHT * 0.4, 0.04)
      ]),
      foldMaterial
    );
    root.add(centerFold);

    const iconStarMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xf0c86f,
      depthWrite: false,
      opacity: 0,
      transparent: true
    });
    const iconHaloMaterial = new THREE.SpriteMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xffe5a2,
      depthWrite: false,
      map: sparkTexture,
      opacity: 0,
      transparent: true
    });
    const iconHalo = new THREE.Sprite(iconHaloMaterial);
    iconHalo.position.set(0, 1.17, 0.075);
    iconHalo.scale.setScalar(0.62);
    root.add(iconHalo);

    const iconStar = new THREE.Mesh(
      createFourPointStarGeometry(),
      iconStarMaterial
    );
    iconStar.position.set(0, 1.17, 0.09);
    root.add(iconStar);

    const iconRayMaterial = new THREE.LineBasicMaterial({
      color: 0xd9aa50,
      depthWrite: false,
      opacity: 0,
      transparent: true
    });
    const iconRays = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.35, 1.3, 0.08),
        new THREE.Vector3(-0.25, 1.22, 0.08),
        new THREE.Vector3(0.35, 1.3, 0.08),
        new THREE.Vector3(0.25, 1.22, 0.08)
      ]),
      iconRayMaterial
    );
    root.add(iconRays);

    const hoverGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.15, 0.92),
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        map: hoverGlowTexture,
        opacity: 0.5,
        transparent: true
      })
    );
    hoverGlow.position.set(0, -0.16, -0.24);
    scene.add(hoverGlow);

    const sparkPositions = new Float32Array(18 * 3);
    const sparkBaseY = new Float32Array(18);
    for (let index = 0; index < 18; index += 1) {
      const x = (((index * 73 + 17) % 101) / 100 - 0.5) * 3.8;
      const y = (((index * 47 + 31) % 97) / 96 - 0.5) * 2.45;
      sparkPositions[index * 3] = x;
      sparkPositions[index * 3 + 1] = y;
      sparkPositions[index * 3 + 2] = 0.18 + ((index * 29) % 60) / 100;
      sparkBaseY[index] = y;
    }
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = new THREE.PointsMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xf2cf83,
      depthWrite: false,
      map: sparkTexture,
      opacity: 0.5,
      size: 0.09,
      transparent: true
    });
    const sparkles = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparkles);

    let animationFrame = 0;
    let currentArtworkIndex = 0;
    const renderFrame = (now: number) => {
      const openingElapsed =
        phaseRef.current === 'opening'
          ? Math.max(0, now - openingStartedAtRef.current)
          : BOOK_OPENING_DURATION_MS;
      const settle = getBookSettleProgress(openingElapsed);
      const reveal = getIconBookRevealProgress(openingElapsed);
      const markOpacity = getIconMarkOpacity(openingElapsed);
      const idleBob = phaseRef.current === 'opening' ? 0 : Math.sin(now * 0.0011) * 0.012;

      root.position.x = 0;
      root.position.y = THREE.MathUtils.lerp(-0.1, -0.05, settle) + idleBob;
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(THREE.MathUtils.lerp(0.95, 1, settle));
      bookMarkMaterial.opacity = markOpacity;
      bookMark.visible = markOpacity > 0.01;
      bookMark.scale.setScalar(0.84 + settle * 0.16);

      const contentIsAnimating = phaseRef.current !== 'opening' && !reducedMotion;
      const contentElapsed =
        contentIsAnimating && contentStartedAtRef.current !== null
          ? Math.max(0, now - contentStartedAtRef.current)
          : 0;
      const artworkIndex = getBookSpreadIndex(contentElapsed, artworkDeck.length);
      if (artworkIndex !== currentArtworkIndex) {
        const nextArtworkIndex = (artworkIndex + 1) % artworkDeck.length;
        updatePageSurface(leftSurface, artworkDeck[artworkIndex].left);
        updatePageSurface(rightSurface, artworkDeck[artworkIndex].right);
        updatePageSurface(nextLeftSurface, artworkDeck[nextArtworkIndex].left);
        updatePageSurface(nextRightSurface, artworkDeck[nextArtworkIndex].right);
        currentArtworkIndex = artworkIndex;
      }

      const pageTurn = contentIsAnimating ? getPageTurnProgress(contentElapsed) : 0;
      const transition = getIconBookTransitionPose(pageTurn);
      const wingReveal = THREE.MathUtils.smoothstep(1 - markOpacity, 0.12, 0.56);
      const revealScale = Math.max(0.002, reveal * wingReveal);
      const visibleReveal = THREE.MathUtils.clamp(revealScale, 0, 1);
      const wingScaleX = revealScale * transition.scale;
      const openingTilt = (1 - visibleReveal) * 0.055;
      const transitionTilt = transition.glow * 0.009;
      leftWing.visible = revealScale > 0.004;
      rightWing.visible = revealScale > 0.004;
      leftWing.position.y = transition.lift;
      rightWing.position.y = transition.lift;
      leftWing.rotation.z = -openingTilt - transitionTilt;
      rightWing.rotation.z = openingTilt + transitionTilt;
      leftWing.scale.set(wingScaleX, 0.96 + visibleReveal * 0.04, 1);
      rightWing.scale.set(wingScaleX, 0.96 + visibleReveal * 0.04, 1);
      centerFold.visible = revealScale > 0.04;
      foldMaterial.opacity = visibleReveal * (0.76 - transition.glow * 0.18);
      leftPageMaterial.uniforms.uProgress.value = pageTurn;
      rightPageMaterial.uniforms.uProgress.value = pageTurn;

      const iconReveal = visibleReveal * (1 - markOpacity);
      const starPulse = 0.92 + Math.sin(now * 0.0022) * 0.08;
      iconHalo.visible = iconReveal > 0.01;
      iconHaloMaterial.opacity = iconReveal * (0.2 + starPulse * 0.1);
      iconHalo.scale.setScalar(
        iconReveal * starPulse * (0.62 + transition.glow * 0.08)
      );
      iconStar.visible = iconReveal > 0.01;
      iconStarMaterial.opacity = iconReveal * (0.76 + starPulse * 0.2);
      iconStar.scale.setScalar(
        iconReveal * starPulse * (1 + transition.glow * 0.1)
      );
      iconRayMaterial.opacity = iconReveal * 0.72;
      iconRays.visible = iconReveal > 0.01;

      const sparkPosition = sparkGeometry.attributes.position;
      for (let index = 0; index < sparkBaseY.length; index += 1) {
        sparkPosition.setY(
          index,
          sparkBaseY[index] + Math.sin(now * 0.00055 + index * 1.71) * 0.045
        );
      }
      sparkPosition.needsUpdate = true;
      sparkles.rotation.z = Math.sin(now * 0.00012) * 0.02;
      sparkMaterial.opacity = 0.44 + Math.sin(now * 0.0011) * 0.08;
      arcaneField.rotation.z = -0.08 + now * 0.000012;
      arcaneRotor.rotation.z = -now * 0.000026;
      arcanePrimaryMaterial.opacity = 0.16 + Math.sin(now * 0.00072) * 0.02;
      arcaneDetailMaterial.opacity = 0.13 + Math.sin(now * 0.00061 + 1.4) * 0.018;

      renderer.render(scene, camera);
      canvas.dataset.rendered = 'true';
      canvas.dataset.phase = phaseRef.current;
      canvas.dataset.artworkSpread = String(currentArtworkIndex);
      canvas.dataset.pageTurn = pageTurn.toFixed(3);
      animationFrame = window.requestAnimationFrame(renderFrame);
    };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      camera.left = (-CAMERA_VIEW_HEIGHT * aspect) / 2;
      camera.right = (CAMERA_VIEW_HEIGHT * aspect) / 2;
      camera.top = CAMERA_VIEW_HEIGHT / 2;
      camera.bottom = -CAMERA_VIEW_HEIGHT / 2;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    animationFrame = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      const disposedGeometries = new Set<THREE.BufferGeometry>();
      const disposedMaterials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const renderable = object as THREE.Object3D & {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        if (renderable.geometry && !disposedGeometries.has(renderable.geometry)) {
          renderable.geometry.dispose();
          disposedGeometries.add(renderable.geometry);
        }
        const materials = renderable.material
          ? Array.isArray(renderable.material)
            ? renderable.material
            : [renderable.material]
          : [];
        for (const material of materials) {
          if (!disposedMaterials.has(material)) {
            material.dispose();
            disposedMaterials.add(material);
          }
        }
      });
      bookMarkTexture.dispose();
      leftBackingTexture.dispose();
      rightBackingTexture.dispose();
      sparkTexture.dispose();
      hoverGlowTexture.dispose();
      leftSurface.texture.dispose();
      rightSurface.texture.dispose();
      nextLeftSurface.texture.dispose();
      nextRightSurface.texture.dispose();
      renderer.dispose();
    };
  }, [artworkSeed]);

  return (
    <div aria-hidden="true" className="candidate-memory-three-stage">
      <canvas className="candidate-memory-three-canvas" ref={canvasRef} />
    </div>
  );
}
