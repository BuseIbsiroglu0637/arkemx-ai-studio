"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import "./ece-avatar.css";
import { createOfficeScene } from "./office-scene";

type EceTone = "neutral" | "positive" | "curious" | "serious";
type EceAvatarProps = {
  setting?: "portrait" | "office";
  /** Edge TTS gerçekten çalarken true olmalı. */
  speaking?: boolean;
  /** Ollama cevap hazırlarken true olmalı. */
  thinking?: boolean;
  /** Gelecek aşamada yanıtın iletişim tonundan üretilecek. */
  tone?: EceTone;
  /** Ana ekranda bir kez el sallamak için. */
  greeting?: boolean;
  /** Butonla selamlamayı tekrar oynatmak için artırılır. */
  greetingSignal?: number;
  /** Ana ekranda avatar altındaki uzun açıklamayı gizler. */
  showIntro?: boolean;
};

/** 0..1 aralığında, yumuşak başlayıp biten hareket zarfı. */
function smoothPulse(t: number, start: number, duration: number): number {
  const progress = (t - start) / duration;
  if (progress <= 0 || progress >= 1) return 0;
  return Math.sin(Math.PI * progress) ** 2;
}

/** Ani sıçrama olmadan hedef kemik açısına yaklaş. */
function approach(current: number, target: number, delta: number, speed = 4): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-delta * speed));
}

function smoothStep(start: number, end: number, t: number): number {
  const x = THREE.MathUtils.clamp((t - start) / (end - start), 0, 1);
  return x * x * (3 - 2 * x);
}

// Bu VRM'de parmaklar T-pozunda -X yönünde uzanıyor.
// Avuç yönü önkol ve bilek dönüşünün birleşimiyle ayarlanır.
// Model değiştirilirse bu işaretin yeniden kalibre edilmesi gerekebilir.
const PALM_TURN_TOWARD_CAMERA = -0.55;
// Nötr poz: T-pozuna göre kolların yaklaşık dikey biçimde aşağı bırakılması.
// Bu modelde sol/sağ işaretler ters; küçük fark doğal bir asimetri sağlar.
const LEFT_SHOULDER_REST_Z = -1.40;
const RIGHT_SHOULDER_REST_Z = 1.43;
const LEFT_ELBOW_REST_Z = 0.14;
const RIGHT_ELBOW_REST_Z = -0.16;
const GREETING_LENGTH_SECONDS = 4.2;

/**
 * ARKEMX Ece — Doğal Davranış Motoru v2.4.
 * VRM 1.0 iskeletine göre ayarlanmıştır (Ece.vrm).
 * Tek seferlik selamlama, avuç içini kullanıcıya çevirme,
 * gevşek omuzlar / hafif bükülü dirseklerle doğal bekleme, göz kırpma ve hafif jestler.
 * Sohbet/Edge TTS API'lerine, Karar Merkezi'ne ve SQLite'a dokunmaz.
 */
export default function EceAvatar({
  setting = "portrait",
  speaking = false,
  thinking = false,
  tone = "neutral",
  greeting = false,
  greetingSignal = 0,
  showIntro = true,
}: EceAvatarProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ speaking, thinking, tone, greeting, greetingSignal });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    stateRef.current = { speaking, thinking, tone, greeting, greetingSignal };
  }, [speaking, thinking, tone, greeting, greetingSignal]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setError("3D görüntü açılamadı. Tarayıcıda WebGL desteğini kontrol et.");
      return;
    }

    let disposed = false;
    let animationFailed = false;
    let frameId = 0;
    let currentVrm: VRM | null = null;
    let lastFrameTime = performance.now();
    let elapsedSeconds = 0;
    let thinkingBlend = 0;
    let speakingBlend = 0;
    let greetingStartAt: number | null = null;
    let greetingPlayed = false;
    let lastGreetingSignal = greetingSignal;
    let nextBlinkAt = 1.7;
    let blinkStartedAt: number | null = null;
    let nextGestureAt = 2.5;
    let gestureStartedAt = -10;
    let nextLookAt = 4;
    let lookStartedAt = -10;
    let lookDirection = 1;
    let smileBlend = 0;
    let mouthBlend = 0;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches;
    const onMotionPreference = () => {
      reducedMotion = motionPreference.matches;
      if (reducedMotion) greetingStartAt = null;
    };
    motionPreference.addEventListener("change", onMotionPreference);
    // Cache bone references and reuse temporaries; do not allocate per animation frame.
    const bones = new Map<VRMHumanBoneName, THREE.Object3D | null>();
    const targetRotation = new THREE.Quaternion();
    const targetEuler = new THREE.Euler();
    function pose(name: VRMHumanBoneName, x: number, y: number, z: number, dt: number, speed = 7) {
      const bone = bones.get(name);
      if (!bone) return;
      targetRotation.setFromEuler(targetEuler.set(x, y, z, "ZYX"));
      bone.quaternion.slerp(targetRotation, 1 - Math.exp(-dt * speed));
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "ece-avatar-canvas";
    viewport.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const office = setting === "office" ? createOfficeScene() : null;
    if (office) {
      scene.add(office);
      scene.background = new THREE.Color(0x34313e);
    }
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 1.3, 2.6);
    camera.lookAt(0, 1.3, 0);

    const gazeTarget = new THREE.Object3D();
    scene.add(gazeTarget);
    scene.add(new THREE.HemisphereLight(0xfff5ec, 0x716581, 1.15));
    const light = new THREE.DirectionalLight(0xfff2e6, 1.1);
    light.position.set(1.5, 2.8, 2.5);
    scene.add(light);

    function resize() {
      if (disposed) return;
      const width = Math.max(1, viewport!.clientWidth);
      const height = Math.max(1, viewport!.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      animationFailed = true;
      cancelAnimationFrame(frameId);
      if (!disposed) setError("3D görüntüleme durdu. Tarayıcı GPU bağlantısını kaybetti.");
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport);
    resize();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      "/avatars/ece.vrm",
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM | undefined;
        if (!vrm) {
          if (!disposed) setError("Avatar dosyası VRM olarak okunamadı.");
          return;
        }
        if (disposed) {
          VRMUtils.deepDispose(vrm.scene);
          return;
        }
        currentVrm = vrm;
        for (const [name, entry] of Object.entries(vrm.humanoid.normalizedHumanBones)) {
          bones.set(name as VRMHumanBoneName, entry.node);
        }
        if (vrm.lookAt) vrm.lookAt.target = gazeTarget;
        scene.add(vrm.scene);
        vrm.scene.traverse((obj) => { obj.frustumCulled = false; });

        // Kol ve gövde kemikleri; VRM 1.0 için normalize edilmiş iskelet.
        // T-pozundan doğal duruşa ilk anda geçiş.
        const leftArm = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
        const rightArm = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
        if (leftArm) leftArm.rotation.z = LEFT_SHOULDER_REST_Z;
        if (rightArm) rightArm.rotation.z = RIGHT_SHOULDER_REST_Z;
        const leftForearm = vrm.humanoid.getNormalizedBoneNode("leftLowerArm");
        const rightForearm = vrm.humanoid.getNormalizedBoneNode("rightLowerArm");
        if (leftForearm) leftForearm.rotation.z = LEFT_ELBOW_REST_Z;
        if (rightForearm) rightForearm.rotation.z = RIGHT_ELBOW_REST_Z;
        if (office) {
          vrm.scene.scale.multiplyScalar(1.45);
          pose("leftLowerArm", 0, -1.65, LEFT_ELBOW_REST_Z, 1, 100);
          pose("rightLowerArm", 0, 1.65, RIGHT_ELBOW_REST_Z, 1, 100);
          pose("leftUpperLeg", -Math.PI / 2, 0, -0.035, 1, 100);
          pose("rightUpperLeg", -Math.PI / 2, 0, 0.035, 1, 100);
          pose("leftLowerLeg", Math.PI / 2, 0, 0, 1, 100);
          pose("rightLowerLeg", Math.PI / 2, 0, 0, 1, 100);
        }
        vrm.update(0);
        if (office) {
          vrm.scene.updateMatrixWorld(true);
          const hips = vrm.humanoid.getNormalizedBoneNode("hips");
          if (hips) vrm.scene.position.y += 0.58 - hips.getWorldPosition(new THREE.Vector3()).y;
          vrm.update(0);
        }

        const bounds = new THREE.Box3().setFromObject(vrm.scene);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        if (Number.isFinite(size.y) && size.y > 0.1) {
          const faceHeight = bounds.min.y + size.y * 0.72;
          const distance = Math.max(1.8, size.y * 1.5);
          camera.position.set(center.x, faceHeight, center.z + distance);
          camera.lookAt(center.x, faceHeight, center.z);
        }
        if (office) {
          camera.fov = 35;
          camera.position.set(0.25, 1.33, 3.05);
          camera.lookAt(0, 1.02, 0.1);
          camera.updateProjectionMatrix();
        }
        gazeTarget.position.copy(camera.position);
        setLoaded(true);
      },
      undefined,
      () => {
        if (!disposed) setError("Ece modeli yüklenemedi. public/avatars/ece.vrm dosyasını kontrol et.");
      }
    );

    function animate(now: number) {
      if (disposed || animationFailed) return;
      frameId = requestAnimationFrame(animate);

      if (document.hidden) {
        lastFrameTime = now;
        return;
      }
      const elapsedMs = now - lastFrameTime;
      if (elapsedMs < 1000 / 60) return;
      lastFrameTime = now;
      // Keep gesture duration tied to wall time even when GPU rendering is slow.
      const elapsed = Math.min(elapsedMs / 1000, 0.25);
      const delta = Math.min(elapsed, 0.1);
      elapsedSeconds += elapsed;
      const t = elapsedSeconds;

      try {
        if (currentVrm) {
          const vrm = currentVrm;
          const {
            speaking: voiceActive,
            thinking: waitingForReply,
            tone: currentTone,
            greeting: greetingRequested,
            greetingSignal: requestedGreetingSignal,
          } = stateRef.current;

          // Ana sayfa ilk açıldığında bir kez; "Tekrar selamla" sinyali gelirse yeniden.
          // VRM gerçekten yüklendikten sonra başlar; sekme gizlenince zaman durur.
          if (requestedGreetingSignal !== lastGreetingSignal) {
            lastGreetingSignal = requestedGreetingSignal;
            greetingPlayed = true;
            if (greetingStartAt === null) greetingStartAt = reducedMotion ? null : t;
          } else if (greetingRequested && !greetingPlayed) {
            greetingPlayed = true;
            if (greetingStartAt === null) greetingStartAt = reducedMotion ? null : t;
          }

          const waveElapsed = greetingStartAt === null ? Infinity : t - greetingStartAt;
          const greetingActive = waveElapsed >= 0 && waveElapsed < GREETING_LENGTH_SECONDS;
          // Kolu yavaşça kaldır, iki küçük selamlama yap, daha uzun sürede dinlenmeye dön.
          const lift = greetingActive
            ? smoothStep(0.15, 1.20, waveElapsed) * (1 - smoothStep(2.85, 4.15, waveElapsed))
            : 0;
          const waveWindow = greetingActive
            ? smoothStep(1.25, 1.50, waveElapsed) * (1 - smoothStep(2.55, 2.85, waveElapsed))
            : 0;
          // Yaklaşık iki küçük bilek salınımı. Omuz sallanmaz.
          const wave = greetingActive
            ? waveWindow * Math.sin((waveElapsed - 1.40) * Math.PI * 4 / 1.25)
            : 0;
          if (waveElapsed >= GREETING_LENGTH_SECONDS) greetingStartAt = null;

          const mode = greetingActive ? "greeting" : voiceActive ? "speaking" : waitingForReply ? "thinking" : "idle";
          renderer.domElement.dataset.motion = mode;
          renderer.domElement.dataset.greetingProgress = String(waveElapsed);
          thinkingBlend = approach(thinkingBlend, mode === "thinking" ? 1 : 0, delta, 2.6);
          speakingBlend = approach(speakingBlend, mode === "speaking" ? 1 : 0, delta, 3.0);
          const humanoid = vrm.humanoid;
          const chest = humanoid.getNormalizedBoneNode("chest");
          const spine = humanoid.getNormalizedBoneNode("spine");
          const neck = humanoid.getNormalizedBoneNode("neck");
          const head = humanoid.getNormalizedBoneNode("head");

          if (t >= nextGestureAt) {
            gestureStartedAt = t;
            nextGestureAt = t + 4.5 + Math.random() * 5;
          }
          if (t >= nextLookAt) {
            lookStartedAt = t;
            lookDirection = Math.random() < 0.5 ? -1 : 1;
            nextLookAt = t + 5 + Math.random() * 6;
          }
          const talkGesture = reducedMotion || mode !== "speaking"
            ? 0 : smoothPulse(t, gestureStartedAt, 1.8);
          const quietLook = reducedMotion || greetingActive
            ? 0 : smoothPulse(t, lookStartedAt, mode === "thinking" ? 2.8 : 1.4);
          const breathing = reducedMotion ? 0 : Math.sin(t * 1.25);
          const tinySway = reducedMotion ? 0 : Math.sin(t * 0.38);
          const conversationalGesture = talkGesture * 0.09 * speakingBlend;
          // One complete target pose per bone avoids independently lagging Euler axes.
          pose("leftUpperArm", 0.025, 0, LEFT_SHOULDER_REST_Z + conversationalGesture * 0.55, delta);
          pose("leftLowerArm", 0, office ? -1.65 : 0, LEFT_ELBOW_REST_Z + conversationalGesture * 0.3, delta);
          pose("leftHand", 0, 0, -0.035, delta);
          pose("rightUpperArm", -0.035 - 0.12 * lift, 0,
            RIGHT_SHOULDER_REST_Z - 0.43 * lift - conversationalGesture, delta, 5);
          // Turn the palm toward the camera: the thumb stays on the head side.
          // Positive roll shows the back of this model's right hand instead.
          pose("rightLowerArm", -0.90 * lift, office ? 1.65 * (1 - lift) : 0,
            RIGHT_ELBOW_REST_Z - 1.88 * lift - conversationalGesture * 0.5, delta, 6);
          pose("rightHand", PALM_TURN_TOWARD_CAMERA * lift, 0.075 * wave,
            0.035 + 0.13 * wave, delta, 9);
          for (const side of ["left", "right"] as const) {
            const handOpen = side === "right" ? lift : 0;
            // Ece's normalized finger joints bend toward the palm with these signs.
            // The opposite signs hyperextend the fingers toward the back of the hand.
            const direction = side === "left" ? 1 : -1;
            for (const [index, finger] of ["Index", "Middle", "Ring", "Little"].entries()) {
              const curl = (0.12 + index * 0.035) * (1 - handOpen) + 0.025;
              for (const [joint, amount] of [["Proximal", 1], ["Intermediate", 0.8], ["Distal", 0.45]] as const) {
                pose(`${side}${finger}${joint}` as VRMHumanBoneName, 0, 0, direction * curl * amount, delta);
              }
            }
          }
          // Look briefly aside, then return to the camera; never follow the mouse continuously.
          gazeTarget.position.x = approach(gazeTarget.position.x,
            camera.position.x + lookDirection * quietLook * 0.18, delta, 5);
          gazeTarget.position.y = approach(gazeTarget.position.y,
            camera.position.y - 0.09 * thinkingBlend * quietLook, delta, 5);
          gazeTarget.position.z = camera.position.z;

          // Nefes alıp verme ve ağırlık aktarımı gözle fark edilen ama abartısız.
          if (spine) {
            spine.rotation.x = approach(spine.rotation.x, 0.005 * breathing, delta, 2);
          }
          if (chest) {
            chest.rotation.x = approach(chest.rotation.x, 0.010 * breathing, delta, 2);
            chest.rotation.z = approach(chest.rotation.z,
              0.008 * tinySway + 0.012 * thinkingBlend, delta, 2);
          }
          if (neck) {
            neck.rotation.z = approach(neck.rotation.z,
              0.035 * thinkingBlend + 0.014 * quietLook, delta, 3);
            neck.rotation.y = approach(neck.rotation.y, 0.008 * tinySway, delta, 2);
          }
          if (head) {
            head.rotation.y = approach(head.rotation.y,
              0.026 * quietLook + 0.021 * thinkingBlend
              + 0.011 * (reducedMotion ? 0 : Math.sin(t * 0.54)), delta, 3);
            head.rotation.x = approach(head.rotation.x,
              0.055 * thinkingBlend + 0.010 * talkGesture + 0.014 * lift, delta, 3);
            head.rotation.z = approach(head.rotation.z,
              0.018 * lift + 0.011 * thinkingBlend, delta, 3);
          }
          vrm.scene.rotation.y = approach(vrm.scene.rotation.y,
            0.005 * tinySway, delta, 2);

          // Göz kırpmalar sabit aralıklı değildir; yaklaşık 3–5 sn arasında değişir.
          let blink = 0;
          if (!reducedMotion) {
            if (t >= nextBlinkAt) {
              blinkStartedAt = t;
              nextBlinkAt = t + 2.8 + Math.random() * 3.6;
            }
            if (blinkStartedAt !== null) {
              const phase = (t - blinkStartedAt) / 0.19;
              if (phase >= 1) blinkStartedAt = null;
              else blink = Math.sin(Math.PI * phase) ** 1.4;
            }
          }

          const manager = vrm.expressionManager;
          if (manager) {
            const setExpression = (name: string, value: number) => {
              if (manager.getExpression(name)) manager.setValue(name, THREE.MathUtils.clamp(value, 0, 1));
            };
            setExpression("blink", blink);
            // Jest sırasında gülümseme; ciddi durumda yüz ifadesi daha sakin.
            const happyTarget = currentTone === "serious" ? 0
              : currentTone === "positive" ? 0.24 : 0.085;
            smileBlend = approach(smileBlend, happyTarget + 0.22 * lift, delta, 2.2);
            setExpression("happy", smileBlend);
            setExpression("relaxed", currentTone === "serious" ? 0 : 0.06);
            setExpression("surprised", currentTone === "curious" ? 0.08 : 0);
            // Konuşma sesi başladığında sınırlı ağız açıklığı; fonem senkronu değildir.
            const syllables = 0.5 + 0.5 * Math.sin(t * 11.2 + 0.25 * Math.sin(t * 3.4));
            const mouthTarget = !reducedMotion && voiceActive ? 0.11 + 0.24 * syllables : 0;
            mouthBlend = approach(mouthBlend, mouthTarget, delta, 10);
            setExpression("aa", mouthBlend);
            setExpression("ih", 0);
            setExpression("ou", 0);
          }
          vrm.update(delta);
        }
        renderer.render(scene, camera);
      } catch (failure) {
        animationFailed = true;
        cancelAnimationFrame(frameId);
        console.error("Ece davranış animasyonu durduruldu:", failure);
        if (!disposed) setError("3D animasyon durduruldu. F12 > Console'daki hataya bak.");
      }
    }
    frameId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      motionPreference.removeEventListener("change", onMotionPreference);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
      }
      if (office) VRMUtils.deepDispose(office);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [setting]);

  const status = error
    ? error
    : !loaded
      ? "3D karakter yükleniyor..."
      : speaking
        ? "Ece konuşuyor"
        : thinking
          ? "Ece düşünüyor"
          : "Ece sohbete hazır";

  return (
    <section className="ece-avatar-stage" aria-label={setting === "office" ? "Ece masasında, ofisinde oturuyor" : "Ece'nin üç boyutlu karakteri"}>
      <div className="ece-avatar-viewport" ref={viewportRef} aria-hidden="true" />
      {!showIntro && (error || !loaded) && <p className="ece-avatar-load-state" role={error ? "alert" : "status"}>{status}</p>}
      {showIntro && <div className="ece-avatar-welcome">
        <span className="ece-avatar-kicker">ARKEMX · YÖNETİCİ OFİSİ</span>
        <h2>Ece burada.</h2>
        <p>
          Hoş geldin! Aklındaki bir fikri konuşabiliriz. İstersen önce
          birlikte düşünelim; hemen proje oluşturmak zorunda değilsin.
        </p>
        <span className="ece-avatar-state" role="status">
          <span className="ece-avatar-indicator" />
          {status}
        </span>
      </div>}
    </section>
  );
}
