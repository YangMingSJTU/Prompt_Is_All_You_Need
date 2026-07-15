import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  BOOK_OPENING_DURATION_MS,
  BOOK_PAGE_COUNT,
  getBookSettleProgress,
  getCoverOpenProgress,
  getPageOpenProgress,
  getBookSpreadIndex,
  getPageTurnProgress,
  getPageTurnVertex
} from '../bookMotion';
import {
  BOOK_PAGE_TEXTURE_HEIGHT,
  BOOK_PAGE_TEXTURE_WIDTH,
  createBookArtworkDeck,
  drawBookPageArtwork,
  type BookPageArtwork
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

function createPageSurface(mirrored: boolean): PageSurface {
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
  if (mirrored) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
  }
  return { canvas, context, texture };
}

function updatePageSurface(
  surface: PageSurface,
  artwork: BookPageArtwork
): void {
  drawBookPageArtwork(surface.context, artwork);
  surface.texture.needsUpdate = true;
}

function createCoverTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  const leather = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  leather.addColorStop(0, '#59453c');
  leather.addColorStop(0.5, '#3d302b');
  leather.addColorStop(1, '#2c2421');
  context.fillStyle = leather;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = 'rgba(255, 255, 255, 0.022)';
  for (let index = 0; index < 86; index += 1) {
    const x = (index * 71 + 31) % canvas.width;
    const y = (index * 43 + 19) % canvas.height;
    context.fillRect(x, y, 1 + (index % 3), 18 + (index % 17));
  }

  context.strokeStyle = '#b99655';
  context.lineWidth = 5;
  context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
  context.strokeStyle = 'rgba(223, 194, 125, 0.48)';
  context.lineWidth = 2;
  context.strokeRect(49, 49, canvas.width - 98, canvas.height - 98);

  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.strokeStyle = '#d1ad62';
  context.lineCap = 'round';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(-42, 30);
  context.lineTo(38, -48);
  context.moveTo(-26, 48);
  context.lineTo(54, -30);
  context.stroke();
  context.fillStyle = '#ddbd72';
  for (const [x, y, radius] of [
    [-50, -22, 7],
    [20, 40, 6],
    [55, -52, 5]
  ] as const) {
    context.beginPath();
    context.moveTo(x, y - radius);
    context.lineTo(x + radius * 0.35, y - radius * 0.35);
    context.lineTo(x + radius, y);
    context.lineTo(x + radius * 0.35, y + radius * 0.35);
    context.lineTo(x, y + radius);
    context.lineTo(x - radius * 0.35, y + radius * 0.35);
    context.lineTo(x - radius, y);
    context.lineTo(x - radius * 0.35, y - radius * 0.35);
    context.closePath();
    context.fill();
  }
  context.restore();

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

function createCircleLine(radius: number, material: THREE.LineBasicMaterial) {
  const points = Array.from({ length: 96 }, (_, index) => {
    const angle = (index / 96) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  });
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

function createArcaneCircle(
  primaryMaterial: THREE.LineBasicMaterial,
  detailMaterial: THREE.LineBasicMaterial
) {
  const field = new THREE.Group();
  const rotor = new THREE.Group();

  field.add(createCircleLine(1.62, primaryMaterial));
  field.add(createCircleLine(1.5, detailMaterial));
  rotor.add(createCircleLine(1.18, detailMaterial));

  const tickPoints: THREE.Vector3[] = [];
  for (let index = 0; index < 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2;
    const innerRadius = index % 3 === 0 ? 1.32 : 1.39;
    tickPoints.push(
      new THREE.Vector3(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius, 0),
      new THREE.Vector3(Math.cos(angle) * 1.48, Math.sin(angle) * 1.48, 0)
    );
  }
  rotor.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(tickPoints),
      detailMaterial
    )
  );

  for (const offset of [-Math.PI / 2, Math.PI / 2]) {
    const trianglePoints = Array.from({ length: 3 }, (_, index) => {
      const angle = offset + (index / 3) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * 1.08, Math.sin(angle) * 1.08, 0);
    });
    rotor.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(trianglePoints),
        detailMaterial
      )
    );
  }

  field.add(rotor);
  return { field, rotor };
}

function createPageGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, 36, 10);
  geometry.translate(PAGE_WIDTH / 2, 0, 0);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.userData.basePositions = Float32Array.from(
    position.array as ArrayLike<number>
  );
  return geometry;
}

function getBasePagePositions(geometry: THREE.PlaneGeometry): Float32Array {
  const basePositions = geometry.userData.basePositions;
  if (!(basePositions instanceof Float32Array)) {
    throw new Error('Page geometry is missing its base positions');
  }
  return basePositions;
}

function setPageCurl(geometry: THREE.PlaneGeometry, amount: number): void {
  const position = geometry.attributes.position;
  const basePositions = getBasePagePositions(geometry);
  for (let index = 0; index < position.count; index += 1) {
    const x = basePositions[index * 3];
    const y = basePositions[index * 3 + 1];
    const z = basePositions[index * 3 + 2];
    const normalized = Math.min(1, Math.max(0, x / PAGE_WIDTH));
    position.setXYZ(index, x, y, z + Math.sin(Math.PI * normalized) * amount);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function setTurningPageShape(geometry: THREE.PlaneGeometry, progress: number): void {
  const position = geometry.attributes.position;
  const basePositions = getBasePagePositions(geometry);
  for (let index = 0; index < position.count; index += 1) {
    const baseX = basePositions[index * 3];
    const baseY = basePositions[index * 3 + 1];
    const normalizedX = baseX / PAGE_WIDTH;
    const normalizedY = baseY / PAGE_HEIGHT + 0.5;
    const vertex = getPageTurnVertex(normalizedX, normalizedY, progress);
    position.setXYZ(
      index,
      vertex.xRatio * PAGE_WIDTH,
      baseY + vertex.yOffsetRatio * PAGE_WIDTH,
      vertex.zRatio * PAGE_WIDTH
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function setMaterialMap(
  material: THREE.MeshStandardMaterial,
  texture: THREE.Texture
): void {
  if (material.map === texture) {
    return;
  }
  material.map = texture;
  material.needsUpdate = true;
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.05, 5.35);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffedcf, 0x202638, 1.35));
    const lanternLight = new THREE.PointLight(0xffc66b, 18, 8, 2);
    lanternLight.position.set(-2.25, 2.1, 3.4);
    lanternLight.castShadow = true;
    scene.add(lanternLight);
    const rimLight = new THREE.DirectionalLight(0xb8d2e8, 1.8);
    rimLight.position.set(2.8, 1.4, 3.5);
    scene.add(rimLight);

    const arcanePrimaryMaterial = new THREE.LineBasicMaterial({
      color: 0xd7ae5d,
      depthWrite: false,
      opacity: 0.2,
      transparent: true
    });
    const arcaneDetailMaterial = new THREE.LineBasicMaterial({
      color: 0xe7c984,
      depthWrite: false,
      opacity: 0.13,
      transparent: true
    });
    const { field: arcaneField, rotor: arcaneRotor } = createArcaneCircle(
      arcanePrimaryMaterial,
      arcaneDetailMaterial
    );
    arcaneField.position.set(0, 0.02, -0.16);
    arcaneField.rotation.z = -0.12;
    scene.add(arcaneField);

    const root = new THREE.Group();
    root.position.y = -0.02;
    scene.add(root);

    const coverTexture = createCoverTexture();
    const sparkTexture = createSparkTexture();
    const leftSurface = createPageSurface(true);
    const rightSurface = createPageSurface(false);
    const nextLeftSurface = createPageSurface(true);
    const nextRightSurface = createPageSurface(false);
    const artworkDeck = createBookArtworkDeck(artworkSeed);
    const firstNextArtwork = artworkDeck[1 % artworkDeck.length];
    updatePageSurface(leftSurface, artworkDeck[0].left);
    updatePageSurface(rightSurface, artworkDeck[0].right);
    updatePageSurface(nextLeftSurface, firstNextArtwork.left);
    updatePageSurface(nextRightSurface, firstNextArtwork.right);

    const coverMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.18,
      clearcoatRoughness: 0.62,
      map: coverTexture,
      metalness: 0.02,
      roughness: 0.74
    });
    const pageEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xdac9a1,
      metalness: 0,
      roughness: 0.9
    });
    const pageFrontMaterial = new THREE.MeshStandardMaterial({
      map: rightSurface.texture,
      metalness: 0,
      roughness: 0.88,
      side: THREE.FrontSide
    });
    const pageBackMaterial = new THREE.MeshStandardMaterial({
      map: leftSurface.texture,
      metalness: 0,
      roughness: 0.88,
      side: THREE.BackSide
    });
    const rightPageMaterial = new THREE.MeshStandardMaterial({
      map: rightSurface.texture,
      metalness: 0,
      roughness: 0.88,
      side: THREE.FrontSide
    });
    const turningPageFrontMaterial = new THREE.MeshStandardMaterial({
      map: rightSurface.texture,
      metalness: 0,
      roughness: 0.88,
      side: THREE.FrontSide
    });
    const turningPageBackMaterial = new THREE.MeshStandardMaterial({
      map: nextLeftSurface.texture,
      metalness: 0,
      roughness: 0.88,
      side: THREE.BackSide
    });
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xb78b43,
      metalness: 0.64,
      roughness: 0.35
    });

    const coverGeometry = new RoundedBoxGeometry(
      PAGE_WIDTH + 0.11,
      PAGE_HEIGHT + 0.12,
      0.055,
      4,
      0.035
    );
    const backCover = new THREE.Mesh(coverGeometry, coverMaterial);
    backCover.position.set(PAGE_WIDTH / 2, 0, -0.08);
    backCover.castShadow = true;
    backCover.receiveShadow = true;
    root.add(backCover);

    const pageBlock = new THREE.Mesh(
      new RoundedBoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, 0.09, 3, 0.025),
      pageEdgeMaterial
    );
    pageBlock.position.set(PAGE_WIDTH / 2, 0, -0.01);
    pageBlock.castShadow = true;
    pageBlock.receiveShadow = true;
    root.add(pageBlock);

    const rightPageGeometry = createPageGeometry();
    setPageCurl(rightPageGeometry, 0.018);
    const rightPage = new THREE.Mesh(rightPageGeometry, rightPageMaterial);
    rightPage.position.z = 0.055;
    rightPage.castShadow = true;
    rightPage.receiveShadow = true;
    root.add(rightPage);

    const frontCoverPivot = new THREE.Group();
    frontCoverPivot.position.z = 0.095;
    const frontCover = new THREE.Mesh(coverGeometry.clone(), coverMaterial);
    frontCover.position.x = PAGE_WIDTH / 2;
    frontCover.castShadow = true;
    frontCoverPivot.add(frontCover);
    const clasp = new THREE.Mesh(
      new RoundedBoxGeometry(0.1, 0.3, 0.08, 3, 0.025),
      goldMaterial
    );
    clasp.position.set(PAGE_WIDTH + 0.045, 0, 0.025);
    clasp.castShadow = true;
    frontCoverPivot.add(clasp);
    root.add(frontCoverPivot);

    const pagePivots: THREE.Group[] = [];
    const pageMeshes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>[] = [];
    for (let index = 0; index < BOOK_PAGE_COUNT; index += 1) {
      const pivot = new THREE.Group();
      pivot.position.z = 0.058 + index * 0.004;
      const geometry = createPageGeometry();
      const pageFront = new THREE.Mesh(geometry, pageFrontMaterial);
      const pageBack = new THREE.Mesh(geometry, pageBackMaterial);
      pageFront.castShadow = true;
      pageFront.receiveShadow = true;
      pageBack.castShadow = false;
      pageBack.receiveShadow = true;
      pivot.add(pageFront, pageBack);
      root.add(pivot);
      pagePivots.push(pivot);
      pageMeshes.push(pageFront);
    }

    const turningPagePivot = new THREE.Group();
    turningPagePivot.position.z = 0.082;
    const turningPageGeometry = createPageGeometry();
    const turningPageFront = new THREE.Mesh(
      turningPageGeometry,
      turningPageFrontMaterial
    );
    const turningPageBack = new THREE.Mesh(
      turningPageGeometry,
      turningPageBackMaterial
    );
    turningPageFront.castShadow = false;
    turningPageFront.receiveShadow = true;
    turningPageBack.castShadow = false;
    turningPageBack.receiveShadow = true;
    turningPagePivot.add(turningPageFront, turningPageBack);
    turningPagePivot.visible = false;
    root.add(turningPagePivot);

    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.052, PAGE_HEIGHT + 0.09, 20),
      coverMaterial
    );
    spine.position.set(0, 0, -0.02);
    spine.castShadow = true;
    root.add(spine);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.65),
      new THREE.ShadowMaterial({ opacity: 0.34 })
    );
    shadow.position.set(0, -0.08, -0.22);
    shadow.receiveShadow = true;
    scene.add(shadow);

    const sparkPositions = new Float32Array(42 * 3);
    const sparkBaseY = new Float32Array(42);
    for (let index = 0; index < 42; index += 1) {
      const x = (((index * 73 + 17) % 101) / 100 - 0.5) * 4.2;
      const y = (((index * 47 + 31) % 97) / 96 - 0.5) * 2.8;
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
      opacity: 0.58,
      size: 0.075,
      transparent: true
    });
    const sparkles = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparkles);

    let animationFrame = 0;
    let currentArtworkIndex = 0;
    let openingGeometrySettled = false;
    const renderFrame = (now: number) => {
      const openingElapsed =
        phaseRef.current === 'opening'
          ? Math.max(0, now - openingStartedAtRef.current)
          : BOOK_OPENING_DURATION_MS;
      const settle = getBookSettleProgress(openingElapsed);
      const coverOpen = getCoverOpenProgress(openingElapsed);

      root.position.x = THREE.MathUtils.lerp(-PAGE_WIDTH / 2, 0, settle);
      root.position.y = THREE.MathUtils.lerp(-0.2, -0.09, settle);
      root.rotation.x = THREE.MathUtils.lerp(-0.02, -0.16, settle);
      root.rotation.z = THREE.MathUtils.lerp(-0.16, -0.055, settle);
      root.scale.setScalar(THREE.MathUtils.lerp(0.9, 1, settle));

      frontCoverPivot.rotation.y = -Math.PI * coverOpen;
      frontCoverPivot.position.z =
        THREE.MathUtils.lerp(0.095, -0.09, coverOpen) +
        Math.sin(Math.PI * coverOpen) * 0.12;

      pagePivots.forEach((pivot, index) => {
        const progress = getPageOpenProgress(openingElapsed, index);
        const finalOffset = (BOOK_PAGE_COUNT - 1 - index) * 0.018;
        pivot.rotation.y = finalOffset * progress;
        pivot.position.z =
          0.058 + index * 0.004 + Math.sin(Math.PI * progress) * 0.018;
        if (!openingGeometrySettled) {
          setTurningPageShape(pageMeshes[index].geometry, progress);
        }
      });
      openingGeometrySettled = openingElapsed >= BOOK_OPENING_DURATION_MS;

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
      const isTurning = pageTurn > 0.001;
      setMaterialMap(
        rightPageMaterial,
        isTurning ? nextRightSurface.texture : rightSurface.texture
      );
      setMaterialMap(
        pageBackMaterial,
        pageTurn > 0.82 ? nextLeftSurface.texture : leftSurface.texture
      );
      turningPagePivot.visible = pageTurn > 0.001 && pageTurn < 0.999;
      turningPagePivot.rotation.y = 0;
      turningPagePivot.position.z = 0.082;
      setTurningPageShape(turningPageGeometry, pageTurn);

      const sparkPosition = sparkGeometry.attributes.position;
      for (let index = 0; index < sparkBaseY.length; index += 1) {
        sparkPosition.setY(
          index,
          sparkBaseY[index] + Math.sin(now * 0.00055 + index * 1.71) * 0.045
        );
      }
      sparkPosition.needsUpdate = true;
      sparkles.rotation.z = Math.sin(now * 0.00012) * 0.025;
      sparkMaterial.opacity = 0.5 + Math.sin(now * 0.0011) * 0.09;
      arcaneField.rotation.z = -0.12 + now * 0.000018;
      arcaneRotor.rotation.z = -now * 0.000037;
      arcanePrimaryMaterial.opacity = 0.18 + Math.sin(now * 0.00072) * 0.025;
      arcaneDetailMaterial.opacity = 0.11 + Math.sin(now * 0.00061 + 1.4) * 0.02;

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
      camera.aspect = width / height;
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
      coverTexture.dispose();
      sparkTexture.dispose();
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
