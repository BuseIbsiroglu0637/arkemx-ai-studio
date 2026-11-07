"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import "./ece-avatar.css";

type EceTone = "neutral" | "positive" | "curious" | "serious";
type EceAvatarProps = {
  /** Edge TTS gerçekten çalarken true olmalı. */
  speaking?: boolean;
  /** Ollama cevap hazırlarken true olmalı. */
  thinking?: boolean;
  /** Gelecek aşamada yanıtın iletişim tonundan üretilecek. */
  tone?: EceTone;
};

/** 0..1 aralığında, yumuşak başlayıp biten hareket zarfı. */
function smoothPulse(t: number, start: number, duration: number): number {
  const progress = (t - start) / duration;
  if (progress <= 0 || progress >= 1) return 0;
  return Math.sin(Math.PI * progress) ** 2;
}

/** Her durum geçişinde ani sıçramaları önlemek için. */
function approach(current: number, target: number, delta: number, speed = 4): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-delta * speed));
}

/**
 * ARKEMX Ece — Davranış Motoru v1.3.
 * Doğal bekleme + belirgin düşünme duruşu + konuşma jestleri.
 * Ses üretmez, Ollama veya Karar Merkezi verilerini değiştirmez.
 */
export default function EceAvatar({
  speaking = false,
  thinking = false,
  tone = "neutral",
}: EceAvatarProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ speaking, thinking, tone });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    stateRef.current = { speaking, thinking, tone };
  }, [speaking, thinking, tone]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
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
    let thinkingBlend = 0; // düşünme pozuna yumuşak geçiş (0..1)
    const targetFrameMilliseconds = 1000 / 24;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "ece-avatar-canvas";
    viewport.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 1.3, 2.6);
    camera.lookAt(0, 1.3, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
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
        scene.add(vrm.scene);
        vrm.scene.traverse((obj) => { obj.frustumCulled = false; });

        // Kol ve gövde kemikleri; VRM 1.0 için normalize edilmiş iskelet.
        // T-pozundan doğal duruşa ilk anda geçiş.
        const leftArm = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
        const rightArm = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
        if (leftArm) leftArm.rotation.z = -1.25;
        if (rightArm) rightArm.rotation.z = 1.25;
        vrm.update(0);

        const bounds = new THREE.Box3().setFromObject(vrm.scene);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        if (Number.isFinite(size.y) && size.y > 0.1) {
          const faceHeight = bounds.min.y + size.y * 0.72;
          const distance = Math.max(1.8, size.y * 1.5);
          camera.position.set(center.x, faceHeight, center.z + distance);
          camera.lookAt(center.x, faceHeight, center.z);
        }
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
      if (elapsedMs < targetFrameMilliseconds) return;
      lastFrameTime = now;
      const delta = Math.min(elapsedMs / 1000, 0.05);
      elapsedSeconds += delta;
      const t = elapsedSeconds;

      try {
        if (currentVrm) {
          const vrm = currentVrm;
          const { speaking: voiceActive, thinking: waitingForReply, tone: currentTone } = stateRef.current;
          const mode = voiceActive ? "speaking" : waitingForReply ? "thinking" : "idle";
          // Mod aniden değişse bile kol/baş hareketleri yumuşak ilerlesin.
          thinkingBlend = approach(thinkingBlend, mode === "thinking" ? 1 : 0, delta, 2.8);
          const humanoid = vrm.humanoid;
          const leftArm = humanoid.getNormalizedBoneNode("leftUpperArm");
          const rightArm = humanoid.getNormalizedBoneNode("rightUpperArm");
          const leftForearm = humanoid.getNormalizedBoneNode("leftLowerArm");
          const rightForearm = humanoid.getNormalizedBoneNode("rightLowerArm");
          const chest = humanoid.getNormalizedBoneNode("chest");
          const neck = humanoid.getNormalizedBoneNode("neck");
          const head = humanoid.getNormalizedBoneNode("head");

          // 12 saniyelik döngü: 0..5 sn sakin; 5..6.5 sn küçük jest;
          // 6.5..12 sn yine sakin. Sürekli el kol sallama yok.
          const idleGesture = !reducedMotion && mode === "idle"
            ? smoothPulse(t % 12, 5, 1.6)
            : 0;
          // 8. saniyeye dek hareketsiz kal, kısa bakıştan sonra tekrar dur.
          const idleLook = !reducedMotion && mode === "idle"
            ? smoothPulse(t % 13, 8.2, 2)
            : 0;
          // Konuşurken de el kol hareketleri sürekli değil; cümle aralarında kısa jest.
          const talkGesture = !reducedMotion && mode === "speaking"
            ? smoothPulse(t % 6, 1.4, 1.8)
            : 0;
          const gesture = idleGesture * 0.12 + talkGesture * 0.2;
          const breathing = reducedMotion ? 0 : Math.sin(t * 1.35);
          // Düşünme pozunda uzunca sabit kal, yalnızca çok küçük bir baş hareketi yap.
          const thoughtfulNod = reducedMotion ? 0 : thinkingBlend * 0.012 * Math.sin(t * 0.8);

          // VRM normalize T-pozunda kollar yana açıktır. Z rotasyonu kolları indirir.
          // Kullanıcının VRM modelinde işaretler ters görünürse iki işareti değiştir.
          if (leftArm) {
            leftArm.rotation.z = approach(leftArm.rotation.z, -1.25 + gesture, delta);
            leftArm.rotation.x = approach(leftArm.rotation.x, 0.08, delta);
          }
          if (rightArm) {
            // Sağ kolu hafifçe gövdeye kaldır: düşünme pozunu görünür kılar.
            // Değerler bu VRM modelinde denenecek; gerekirse model bazında inceltilir.
            rightArm.rotation.z = approach(rightArm.rotation.z, 1.25 - gesture * 0.8 - 0.42 * thinkingBlend, delta, 2.5);
            rightArm.rotation.x = approach(rightArm.rotation.x, -0.08 - 0.25 * thinkingBlend, delta, 2.5);
          }
          if (leftForearm) leftForearm.rotation.z = approach(leftForearm.rotation.z, 0.12 + gesture * 0.5, delta);
          if (rightForearm) {
            rightForearm.rotation.z = approach(rightForearm.rotation.z, -0.12 - gesture * 0.5 - 0.30 * thinkingBlend, delta, 2.5);
            rightForearm.rotation.x = approach(rightForearm.rotation.x, -0.55 * thinkingBlend, delta, 2.5);
          }
          if (chest) {
            chest.rotation.x = approach(chest.rotation.x, 0.012 * breathing, delta, 2);
            chest.rotation.z = approach(chest.rotation.z, 0.008 * idleGesture + 0.025 * thinkingBlend, delta, 2);
          }
          if (neck) {
            neck.rotation.z = approach(neck.rotation.z, 0.11 * thinkingBlend + 0.012 * idleLook, delta, 2);
          }
          if (head) {
            head.rotation.y = approach(head.rotation.y, 0.035 * thinkingBlend + 0.045 * idleLook, delta, 2);
            head.rotation.x = approach(head.rotation.x, 0.10 * thinkingBlend + thoughtfulNod, delta, 2);
          }

          // Sürekli sallanmak yerine yalnızca jest sırasında hafifçe dön.
          vrm.scene.rotation.y = approach(vrm.scene.rotation.y, 0.016 * idleGesture, delta, 2);

          const manager = vrm.expressionManager;
          if (manager) {
            const blinkPhase = t % 4.6;
            const setExpression = (name: string, value: number) => {
              if (manager.getExpression(name)) manager.setValue(name, value);
            };
            setExpression("blink", !reducedMotion && blinkPhase < 0.17
              ? Math.sin(Math.PI * blinkPhase / 0.17) : 0);
            // tone varsayılan olarak neutral; otomatik duygu analizi henüz yok.
            setExpression("happy", currentTone === "positive" ? 0.28 : 0);
            setExpression("surprised", currentTone === "curious" ? 0.12 : 0);
            setExpression("relaxed", mode === "thinking" || currentTone === "serious" ? 0 : 0.12);
            // v1: Sese bağlı yaklaşık ağız hareketi; gerçek fonem senkronu değil.
            const mouth = voiceActive && !reducedMotion
              ? 0.18 + 0.42 * Math.abs(Math.sin(t * 9.5)) : 0;
            setExpression("aa", mouth);
            setExpression("ih", mouth * 0.12);
            setExpression("ou", mouth * 0.08);
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
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

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
    <section className="ece-avatar-stage" aria-label="Ece'nin üç boyutlu karakteri">
      <div className="ece-avatar-viewport" ref={viewportRef} aria-hidden="true" />
      <div className="ece-avatar-welcome">
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
      </div>
    </section>
  );
}
