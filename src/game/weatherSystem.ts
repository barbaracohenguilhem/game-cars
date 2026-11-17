import * as THREE from 'three';
import { ShiftAtmosphere, WeatherCondition } from './types';

export interface AtmosphereWeatherPalette {
  bgHex: number;
  fogHex: number;
  fogNear: number;
  fogFar: number;
  waterHex: number;
  sunColorHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  rimHex: number;
  rimIntensity: number;
  headlightsOn: boolean;
}

export function computeAtmosphereWeatherPalette(
  atm: ShiftAtmosphere,
  weather: WeatherCondition,
): AtmosphereWeatherPalette {
  // Base Scandinavian palette per time-of-day
  const base: AtmosphereWeatherPalette =
    atm === ShiftAtmosphere.GoldenSunset
      ? {
          bgHex: 0xdecbc0,
          fogHex: 0xdecbc0,
          fogNear: 58,
          fogFar: 128,
          waterHex: 0x3d596b,
          sunColorHex: 0xffb978,
          sunIntensity: 1.64,
          hemiSkyHex: 0xf7dcc4,
          hemiGroundHex: 0x707e6a,
          hemiIntensity: 0.76,
          rimHex: 0xfce1b6,
          rimIntensity: 0.42,
          headlightsOn: false,
        }
      : atm === ShiftAtmosphere.TwilightNeon
        ? {
            bgHex: 0x1b2634,
            fogHex: 0x1b2634,
            fogNear: 54,
            fogFar: 122,
            waterHex: 0x121b26,
            sunColorHex: 0xb8d0e4,
            sunIntensity: 0.98,
            hemiSkyHex: 0x4b6b88,
            hemiGroundHex: 0x233140,
            hemiIntensity: 0.9,
            rimHex: 0xfbbf77,
            rimIntensity: 0.4,
            headlightsOn: true,
          }
        : {
            bgHex: 0xcddbe4,
            fogHex: 0xcddbe4,
            fogNear: 58,
            fogFar: 126,
            waterHex: 0x4e6e82,
            sunColorHex: 0xfff6ea,
            sunIntensity: 1.52,
            hemiSkyHex: 0xe4eff7,
            hemiGroundHex: 0x7d8f76,
            hemiIntensity: 0.78,
            rimHex: 0xd8eaf6,
            rimIntensity: 0.38,
            headlightsOn: false,
          };

  if (weather === WeatherCondition.MorningMist) {
    if (atm === ShiftAtmosphere.TwilightNeon) {
      base.bgHex = 0x223041;
      base.fogHex = 0x293a4d;
      base.fogNear = 36;
      base.fogFar = 96;
      base.hemiIntensity = 0.96;
    } else if (atm === ShiftAtmosphere.GoldenSunset) {
      base.bgHex = 0xe8d9cf;
      base.fogHex = 0xebddd4;
      base.fogNear = 35;
      base.fogFar = 94;
      base.sunIntensity = 1.38;
      base.hemiIntensity = 0.86;
    } else {
      base.bgHex = 0xdbe5ec;
      base.fogHex = 0xe0e9ef;
      base.fogNear = 34;
      base.fogFar = 92;
      base.sunIntensity = 1.28;
      base.hemiIntensity = 0.88;
    }
  } else if (weather === WeatherCondition.LightSnow) {
    if (atm === ShiftAtmosphere.TwilightNeon) {
      base.bgHex = 0x1f2d3d;
      base.fogHex = 0x233245;
      base.fogNear = 44;
      base.fogFar = 110;
      base.hemiSkyHex = 0x5c7f9e;
      base.hemiIntensity = 0.98;
    } else if (atm === ShiftAtmosphere.GoldenSunset) {
      base.bgHex = 0xdfd3d1;
      base.fogHex = 0xe3d7d5;
      base.fogNear = 45;
      base.fogFar = 112;
      base.sunIntensity = 1.42;
      base.hemiSkyHex = 0xf4e4de;
      base.hemiIntensity = 0.86;
    } else {
      base.bgHex = 0xd7e3eb;
      base.fogHex = 0xdce7ef;
      base.fogNear = 44;
      base.fogFar = 112;
      base.waterHex = 0x547285;
      base.sunColorHex = 0xfafcff;
      base.sunIntensity = 1.34;
      base.hemiSkyHex = 0xeef5fa;
      base.hemiIntensity = 0.9;
    }
  } else if (weather === WeatherCondition.FjordDrizzle) {
    if (atm === ShiftAtmosphere.TwilightNeon) {
      base.bgHex = 0x16202c;
      base.fogHex = 0x192533;
      base.fogNear = 42;
      base.fogFar = 106;
      base.sunIntensity = 0.84;
    } else if (atm === ShiftAtmosphere.GoldenSunset) {
      base.bgHex = 0xcbbcb6;
      base.fogHex = 0xcfc1bb;
      base.fogNear = 42;
      base.fogFar = 108;
      base.waterHex = 0x354d5d;
      base.sunIntensity = 1.25;
      base.hemiIntensity = 0.82;
    } else {
      base.bgHex = 0xbecbd4;
      base.fogHex = 0xc3d0d9;
      base.fogNear = 42;
      base.fogFar = 108;
      base.waterHex = 0x3f5b6e;
      base.sunColorHex = 0xf0f4f8;
      base.sunIntensity = 1.18;
      base.hemiSkyHex = 0xd5e1ea;
      base.hemiIntensity = 0.86;
    }
  }

  return base;
}

function createSnowflakeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.32, 'rgba(245, 250, 255, 0.88)');
    grad.addColorStop(0.7, 'rgba(225, 238, 250, 0.25)');
    grad.addColorStop(1, 'rgba(225, 238, 250, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    // Subtle 6-point crystalline cross highlights
    ctx.save();
    ctx.translate(32, 32);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createMistWispTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(0.45, 'rgba(244, 248, 252, 0.26)');
    grad.addColorStop(0.78, 'rgba(235, 242, 248, 0.07)');
    grad.addColorStop(1, 'rgba(235, 242, 248, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const MIST_VERT_SHADER = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vLocalUv;
  void main() {
    vLocalUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const MIST_FRAG_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uScale;
  uniform vec2 uWind;
  uniform vec3 uMistColor;
  varying vec3 vWorldPos;
  varying vec2 vLocalUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * valueNoise(p);
      p = p * 2.04 + vec2(17.1, 31.7);
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 coord = vWorldPos.xz * uScale + uWind * uTime;
    float n1 = fbm(coord);
    float n2 = fbm(coord * 1.45 - uWind * (uTime * 0.65) + vec2(4.2, 8.9));
    float density = smoothstep(0.32, 0.78, n1 * 0.62 + n2 * 0.38);

    float edgeDist = length(vLocalUv - vec2(0.5));
    float radialFade = smoothstep(0.50, 0.22, edgeDist);
    float alpha = density * radialFade * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uMistColor, alpha);
  }
`;

function wrapModulo(val: number, span: number): number {
  const half = span * 0.5;
  let v = ((val + half) % span + span) % span - half;
  return v;
}

export class WeatherOverlaySystem {
  public readonly root: THREE.Group;

  private readonly mistGeo: THREE.PlaneGeometry;
  private readonly mistLowMat: THREE.ShaderMaterial;
  private readonly mistHighMat: THREE.ShaderMaterial;
  private readonly mistLowMesh: THREE.Mesh;
  private readonly mistHighMesh: THREE.Mesh;

  private readonly wispTex: THREE.CanvasTexture;
  private readonly wispGeo: THREE.BufferGeometry;
  private readonly wispMat: THREE.PointsMaterial;
  private readonly wispPoints: THREE.Points;
  private readonly wispCount = 56;
  private readonly wispBaseX: Float32Array;
  private readonly wispBaseY: Float32Array;
  private readonly wispBaseZ: Float32Array;
  private readonly wispPhase: Float32Array;
  private readonly wispSpeed: Float32Array;
  private readonly wispPositions: Float32Array;

  private readonly snowTex: THREE.CanvasTexture;
  private readonly snowGeo: THREE.BufferGeometry;
  private readonly snowMat: THREE.PointsMaterial;
  private readonly snowPoints: THREE.Points;
  private readonly snowCount = 340;
  private readonly snowBaseX: Float32Array;
  private readonly snowBaseY: Float32Array;
  private readonly snowBaseZ: Float32Array;
  private readonly snowPhase: Float32Array;
  private readonly snowFallSpeed: Float32Array;
  private readonly snowSwayAmp: Float32Array;
  private readonly snowPositions: Float32Array;

  private readonly rainGeo: THREE.BufferGeometry;
  private readonly rainMat: THREE.LineBasicMaterial;
  private readonly rainLines: THREE.LineSegments;
  private readonly rainCount = 220;
  private readonly rainBaseX: Float32Array;
  private readonly rainBaseY: Float32Array;
  private readonly rainBaseZ: Float32Array;
  private readonly rainSpeed: Float32Array;
  private readonly rainPositions: Float32Array;

  private readonly volumeSpan = 48;
  private readonly volumeHeight = 14.5;

  private currentWeather: WeatherCondition = WeatherCondition.Clear;
  private currentAtm: ShiftAtmosphere = ShiftAtmosphere.SunnyHarbor;

  constructor() {
    this.root = new THREE.Group();

    // 1. World-locked Volumetric Nordic Morning Mist Shader Layers
    this.mistGeo = new THREE.PlaneGeometry(92, 92);
    this.mistLowMat = new THREE.ShaderMaterial({
      vertexShader: MIST_VERT_SHADER,
      fragmentShader: MIST_FRAG_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.42 },
        uScale: { value: 0.085 },
        uWind: { value: new THREE.Vector2(0.08, 0.05) },
        uMistColor: { value: new THREE.Color(0xe6eff5) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mistHighMat = new THREE.ShaderMaterial({
      vertexShader: MIST_VERT_SHADER,
      fragmentShader: MIST_FRAG_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.22 },
        uScale: { value: 0.055 },
        uWind: { value: new THREE.Vector2(-0.045, 0.065) },
        uMistColor: { value: new THREE.Color(0xedf4f8) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mistLowMesh = new THREE.Mesh(this.mistGeo, this.mistLowMat);
    this.mistLowMesh.rotation.x = -Math.PI / 2;
    this.mistLowMesh.position.y = 0.36;
    this.mistLowMesh.renderOrder = 5;
    this.mistLowMesh.frustumCulled = false;

    this.mistHighMesh = new THREE.Mesh(this.mistGeo, this.mistHighMat);
    this.mistHighMesh.rotation.x = -Math.PI / 2;
    this.mistHighMesh.position.y = 0.94;
    this.mistHighMesh.renderOrder = 6;
    this.mistHighMesh.frustumCulled = false;

    this.root.add(this.mistLowMesh, this.mistHighMesh);

    // 1B. Soft Canal Mist Wisps
    this.wispTex = createMistWispTexture();
    this.wispBaseX = new Float32Array(this.wispCount);
    this.wispBaseY = new Float32Array(this.wispCount);
    this.wispBaseZ = new Float32Array(this.wispCount);
    this.wispPhase = new Float32Array(this.wispCount);
    this.wispSpeed = new Float32Array(this.wispCount);
    this.wispPositions = new Float32Array(this.wispCount * 3);

    for (let i = 0; i < this.wispCount; i++) {
      this.wispBaseX[i] = (Math.random() - 0.5) * this.volumeSpan;
      this.wispBaseY[i] = 0.52 + Math.random() * 0.95;
      this.wispBaseZ[i] = (Math.random() - 0.5) * this.volumeSpan;
      this.wispPhase[i] = Math.random() * Math.PI * 2;
      this.wispSpeed[i] = 0.65 + Math.random() * 0.75;
    }

    this.wispGeo = new THREE.BufferGeometry();
    this.wispGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.wispPositions, 3),
    );
    this.wispMat = new THREE.PointsMaterial({
      map: this.wispTex,
      color: 0xeaf2f7,
      size: 5.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.wispPoints = new THREE.Points(this.wispGeo, this.wispMat);
    this.wispPoints.frustumCulled = false;
    this.wispPoints.renderOrder = 7;
    this.root.add(this.wispPoints);

    // 2. Gentle Nordic Light Snow
    this.snowTex = createSnowflakeTexture();
    this.snowBaseX = new Float32Array(this.snowCount);
    this.snowBaseY = new Float32Array(this.snowCount);
    this.snowBaseZ = new Float32Array(this.snowCount);
    this.snowPhase = new Float32Array(this.snowCount);
    this.snowFallSpeed = new Float32Array(this.snowCount);
    this.snowSwayAmp = new Float32Array(this.snowCount);
    this.snowPositions = new Float32Array(this.snowCount * 3);

    for (let i = 0; i < this.snowCount; i++) {
      this.snowBaseX[i] = (Math.random() - 0.5) * this.volumeSpan;
      this.snowBaseY[i] = Math.random() * this.volumeHeight;
      this.snowBaseZ[i] = (Math.random() - 0.5) * this.volumeSpan;
      this.snowPhase[i] = Math.random() * Math.PI * 2;
      this.snowFallSpeed[i] = 1.65 + Math.random() * 1.25;
      this.snowSwayAmp[i] = 0.25 + Math.random() * 0.45;
    }

    this.snowGeo = new THREE.BufferGeometry();
    this.snowGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.snowPositions, 3),
    );
    this.snowMat = new THREE.PointsMaterial({
      map: this.snowTex,
      color: 0xf8fbff,
      size: 0.46,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.snowPoints = new THREE.Points(this.snowGeo, this.snowMat);
    this.snowPoints.frustumCulled = false;
    this.snowPoints.renderOrder = 9;
    this.root.add(this.snowPoints);

    // 3. Fjord Drizzle Streaks
    this.rainBaseX = new Float32Array(this.rainCount);
    this.rainBaseY = new Float32Array(this.rainCount);
    this.rainBaseZ = new Float32Array(this.rainCount);
    this.rainSpeed = new Float32Array(this.rainCount);
    this.rainPositions = new Float32Array(this.rainCount * 2 * 3);

    for (let i = 0; i < this.rainCount; i++) {
      this.rainBaseX[i] = (Math.random() - 0.5) * this.volumeSpan;
      this.rainBaseY[i] = Math.random() * this.volumeHeight;
      this.rainBaseZ[i] = (Math.random() - 0.5) * this.volumeSpan;
      this.rainSpeed[i] = 13.5 + Math.random() * 5.0;
    }

    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.rainPositions, 3),
    );
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xd3e4f2,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.renderOrder = 9;
    this.root.add(this.rainLines);

    this.applyWeatherStyle(WeatherCondition.Clear, ShiftAtmosphere.SunnyHarbor);
  }

  public applyWeatherStyle(
    weather: WeatherCondition,
    atm: ShiftAtmosphere,
  ): void {
    this.currentWeather = weather;
    this.currentAtm = atm;

    const isMist = weather === WeatherCondition.MorningMist;
    const isSnow = weather === WeatherCondition.LightSnow;
    const isRain = weather === WeatherCondition.FjordDrizzle;

    this.mistLowMesh.visible = isMist || isRain;
    this.mistHighMesh.visible = isMist;
    this.wispPoints.visible = isMist;
    this.snowPoints.visible = isSnow;
    this.rainLines.visible = isRain;

    // Color-tune overlays cleanly for Twilight, Sunset, and Sunny Harbor
    const lowMistHex =
      atm === ShiftAtmosphere.TwilightNeon
        ? 0x5c7591
        : atm === ShiftAtmosphere.GoldenSunset
          ? 0xf0e0d4
          : 0xe6eff5;
    const highMistHex =
      atm === ShiftAtmosphere.TwilightNeon
        ? 0x67819e
        : atm === ShiftAtmosphere.GoldenSunset
          ? 0xf4e6db
          : 0xeef5f9;

    this.mistLowMat.uniforms.uMistColor.value.setHex(lowMistHex);
    this.mistHighMat.uniforms.uMistColor.value.setHex(highMistHex);

    if (isMist) {
      this.mistLowMat.uniforms.uOpacity.value =
        atm === ShiftAtmosphere.TwilightNeon ? 0.28 : 0.44;
      this.mistHighMat.uniforms.uOpacity.value =
        atm === ShiftAtmosphere.TwilightNeon ? 0.14 : 0.23;
      this.wispMat.color.setHex(highMistHex);
      this.wispMat.opacity = atm === ShiftAtmosphere.TwilightNeon ? 0.14 : 0.24;
    } else if (isRain) {
      // Subtle low shoreline haze during coastal fjord drizzle
      this.mistLowMat.uniforms.uOpacity.value =
        atm === ShiftAtmosphere.TwilightNeon ? 0.12 : 0.18;
    }

    if (isSnow) {
      this.snowMat.color.setHex(
        atm === ShiftAtmosphere.TwilightNeon
          ? 0xdceaf8
          : atm === ShiftAtmosphere.GoldenSunset
            ? 0xfff3eb
            : 0xf8fbff,
      );
      this.snowMat.opacity = atm === ShiftAtmosphere.TwilightNeon ? 0.8 : 0.9;
    }

    if (isRain) {
      this.rainMat.color.setHex(
        atm === ShiftAtmosphere.TwilightNeon
          ? 0x92b8d8
          : atm === ShiftAtmosphere.GoldenSunset
            ? 0xeddcc9
            : 0xd3e4f2,
      );
      this.rainMat.opacity = atm === ShiftAtmosphere.TwilightNeon ? 0.48 : 0.42;
    }
  }

  public update(
    dt: number,
    clockSec: number,
    centerX: number,
    centerZ: number,
    weather: WeatherCondition,
    atm: ShiftAtmosphere,
  ): void {
    if (weather !== this.currentWeather || atm !== this.currentAtm) {
      this.applyWeatherStyle(weather, atm);
    }

    if (weather === WeatherCondition.Clear) return;

    const span = this.volumeSpan;
    const h = this.volumeHeight;

    if (
      weather === WeatherCondition.MorningMist ||
      weather === WeatherCondition.FjordDrizzle
    ) {
      this.mistLowMesh.position.x = centerX;
      this.mistLowMesh.position.z = centerZ;
      this.mistLowMat.uniforms.uTime.value = clockSec;
    }

    if (weather === WeatherCondition.MorningMist) {
      this.mistHighMesh.position.x = centerX;
      this.mistHighMesh.position.z = centerZ;
      this.mistHighMat.uniforms.uTime.value = clockSec;

      const posAttr = this.wispGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.wispCount; i++) {
        const wx =
          centerX +
          wrapModulo(this.wispBaseX[i] + clockSec * this.wispSpeed[i] - centerX, span);
        const wz =
          centerZ +
          wrapModulo(
            this.wispBaseZ[i] + clockSec * (this.wispSpeed[i] * 0.45) - centerZ,
            span,
          );
        const wy =
          this.wispBaseY[i] + Math.sin(clockSec * 0.7 + this.wispPhase[i]) * 0.12;
        const idx = i * 3;
        this.wispPositions[idx] = wx;
        this.wispPositions[idx + 1] = wy;
        this.wispPositions[idx + 2] = wz;
      }
      posAttr.needsUpdate = true;
    }

    if (weather === WeatherCondition.LightSnow) {
      const posAttr = this.snowGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.snowCount; i++) {
        this.snowBaseY[i] -= this.snowFallSpeed[i] * dt;
        if (this.snowBaseY[i] < 0) {
          this.snowBaseY[i] += h;
        }
        const swayX =
          Math.sin(clockSec * 1.45 + this.snowPhase[i]) * this.snowSwayAmp[i];
        const swayZ =
          Math.cos(clockSec * 1.15 + this.snowPhase[i] * 1.3) *
          this.snowSwayAmp[i];
        const sx =
          centerX +
          wrapModulo(
            this.snowBaseX[i] + clockSec * 0.55 + swayX - centerX,
            span,
          );
        const sz =
          centerZ +
          wrapModulo(
            this.snowBaseZ[i] + clockSec * 0.32 + swayZ - centerZ,
            span,
          );
        const sy = 0.25 + this.snowBaseY[i];

        const idx = i * 3;
        this.snowPositions[idx] = sx;
        this.snowPositions[idx + 1] = sy;
        this.snowPositions[idx + 2] = sz;
      }
      posAttr.needsUpdate = true;
    }

    if (weather === WeatherCondition.FjordDrizzle) {
      const posAttr = this.rainGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.rainCount; i++) {
        this.rainBaseY[i] -= this.rainSpeed[i] * dt;
        if (this.rainBaseY[i] < 0) {
          this.rainBaseY[i] += h;
        }
        const rx =
          centerX + wrapModulo(this.rainBaseX[i] + clockSec * 2.1 - centerX, span);
        const rz =
          centerZ + wrapModulo(this.rainBaseZ[i] + clockSec * 1.2 - centerZ, span);
        const ry = 0.22 + this.rainBaseY[i];

        const idx = i * 6;
        // Streak head (bottom)
        this.rainPositions[idx] = rx;
        this.rainPositions[idx + 1] = ry;
        this.rainPositions[idx + 2] = rz;
        // Streak tail (wind-slanted above)
        this.rainPositions[idx + 3] = rx - 0.14;
        this.rainPositions[idx + 4] = ry + 0.84;
        this.rainPositions[idx + 5] = rz - 0.08;
      }
      posAttr.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.mistGeo.dispose();
    this.mistLowMat.dispose();
    this.mistHighMat.dispose();

    this.wispTex.dispose();
    this.wispGeo.dispose();
    this.wispMat.dispose();

    this.snowTex.dispose();
    this.snowGeo.dispose();
    this.snowMat.dispose();

    this.rainGeo.dispose();
    this.rainMat.dispose();
  }
}
